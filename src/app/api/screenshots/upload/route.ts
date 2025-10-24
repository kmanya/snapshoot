import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { processScreenshotWithQwenAPI } from '@/lib/ai/qwen-api'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs/promises'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR)
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Qwen API is configured
    if (!process.env.QWEN_API_KEY) {
      return NextResponse.json(
        { error: 'No AI processing available. Configure Qwen API key.' },
        { status: 503 }
      )
    }

    await ensureUploadDir()

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const folderId = formData.get('folder_id') as string | null

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Create a processing job
    const jobId = uuidv4()
    const job = await prisma.processingJob.create({
      data: {
        id: jobId,
        userId: session.user.id,
        status: 'uploaded',
        total: files.length,
        processed: 0,
        failed: 0,
        estimatedTime: `${files.length * 7} seconds`,
        results: JSON.stringify([]),
        errors: JSON.stringify([])
      }
    })

    // Upload files and prepare for processing
    const fileData: Array<{
      entryId: string
      filename: string
      path: string
    }> = []
    const uploadErrors: Array<{ file: string; error: string }> = []

    for (const file of files) {
      try {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          uploadErrors.push({ file: file.name, error: 'Invalid file type' })
          continue
        }

        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          uploadErrors.push({ file: file.name, error: 'File too large (max 10MB)' })
          continue
        }

        // Save file
        const fileId = uuidv4()
        const extension = path.extname(file.name)
        const fileName = `${fileId}${extension}`
        const filePath = path.join(UPLOAD_DIR, fileName)
        
        const buffer = Buffer.from(await file.arrayBuffer())
        await fs.writeFile(filePath, buffer)

        fileData.push({
          entryId: uuidv4(),
          filename: file.name,
          path: filePath
        })
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error)
        uploadErrors.push({ file: file.name, error: 'Upload failed' })
      }
    }

    if (fileData.length === 0) {
      return NextResponse.json(
        { error: 'No valid files uploaded' },
        { status: 400 }
      )
    }

    // Start background processing
    processScreenshotsInBackground(
      jobId,
      fileData,
      session.user.id,
      folderId
    ).catch(console.error)

    return NextResponse.json({
      job_id: jobId,
      total: files.length,
      uploaded: fileData.length,
      upload_errors: uploadErrors,
      estimated_time: `${fileData.length * 7} seconds`,
      message: `Files uploaded successfully! Processing will take approximately ${fileData.length * 7} seconds.`
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}

async function processScreenshotsInBackground(
  jobId: string,
  fileData: Array<{ entryId: string; filename: string; path: string }>,
  userId: string,
  folderId: string | null
) {
  // Update job status to processing
  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      status: 'processing',
      startedAt: new Date()
    }
  })

  let processed = 0
  const results: any[] = []
  const errors: any[] = []

  for (const file of fileData) {
    try {
      console.log(`Processing ${file.filename}...`)
      
      // Process with AI
      const aiResult = await processScreenshotWithQwenAPI(file.path)
      
      // Create screenshot entry in database
      const screenshot = await prisma.screenshot.create({
        data: {
          id: file.entryId,
          userId,
          folderId,
          fileName: file.filename,
          title: aiResult.title,
          summary: aiResult.summary,
          keywords: JSON.stringify(aiResult.keywords),
          fullText: aiResult.full_text,
          path: `/uploads/${path.basename(file.path)}`, // Store relative path for web access
          concepts: JSON.stringify(aiResult.concepts),
          conceptExplanation: aiResult.concept_explanation,
          codeExplanation: aiResult.code_explanation,
          prerequisites: JSON.stringify(aiResult.prerequisites),
          nextTopics: JSON.stringify(aiResult.next_topics),
          difficulty: aiResult.difficulty,
          isProcessing: false
        }
      })

      processed++
      results.push({
        id: screenshot.id,
        filename: file.filename,
        title: screenshot.title,
        success: true
      })

      // Update job progress
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          processed,
          results: JSON.stringify(results)
        }
      })

      // Rate limiting: wait between requests
      if (processed < fileData.length) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    } catch (error: any) {
      console.error(`Failed to process ${file.filename}:`, error)
      errors.push({
        file: file.filename,
        error: error.message || 'Processing failed'
      })

      // Update job with error
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          errors: JSON.stringify(errors)
        }
      })
    }
  }

  // Mark job as completed
  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      processed,
      failed: fileData.length - processed,
      results: JSON.stringify(results),
      errors: JSON.stringify(errors)
    }
  })

  console.log(`Processing complete: ${processed}/${fileData.length} successful`)
}
