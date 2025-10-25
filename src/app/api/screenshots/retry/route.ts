import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { processScreenshotWithQwenAPI } from '@/lib/ai/qwen-api'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { failedFiles, folderId } = body

    if (!failedFiles || !Array.isArray(failedFiles) || failedFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files provided for retry' },
        { status: 400 }
      )
    }

    // Create a new processing job for retries
    const job = await prisma.processingJob.create({
      data: {
        userId: session.user.id,
        status: 'uploaded',
        total: failedFiles.length,
        processed: 0,
        failed: 0,
        estimatedTime: `${failedFiles.length * 7} seconds`,
        results: JSON.stringify([]),
        errors: JSON.stringify([])
      }
    })

    // Start background processing
    processRetryInBackground(job.id, failedFiles, session.user.id, folderId)
      .catch(error => {
        console.error('Background retry processing error:', error)
      })

    return NextResponse.json({
      success: true,
      job_id: job.id,
      message: `Retrying ${failedFiles.length} screenshot${failedFiles.length > 1 ? 's' : ''}...`
    })
  } catch (error) {
    console.error('Retry error:', error)
    return NextResponse.json(
      { error: 'Failed to start retry' },
      { status: 500 }
    )
  }
}

async function processRetryInBackground(
  jobId: string,
  failedFiles: Array<{
    fileName: string
    driveFileId: string
    driveUrl: string
    entryId: string
    error: string
  }>,
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

  for (const file of failedFiles) {
    try {
      console.log(`🔄 Retrying ${file.fileName}...`)
      
      // Process with AI
      const aiResult = await processScreenshotWithQwenAPI(file.driveUrl, userId)
      
      // Create screenshot entry in database
      const screenshot = await prisma.screenshot.create({
        data: {
          id: file.entryId,
          userId,
          folderId,
          fileName: file.fileName,
          title: aiResult.title,
          summary: aiResult.summary,
          keywords: JSON.stringify(aiResult.keywords),
          fullText: aiResult.full_text,
          path: file.driveUrl,
          driveFileId: file.driveFileId,
          concepts: JSON.stringify(aiResult.concepts),
          conceptExplanation: aiResult.concept_explanation,
          codeExplanation: aiResult.code_explanation,
          prerequisites: JSON.stringify(aiResult.prerequisites),
          nextTopics: JSON.stringify(aiResult.next_topics),
          difficulty: aiResult.difficulty,
          isProcessing: false
        }
      })

      results.push({
        id: screenshot.id,
        title: screenshot.title,
        fileName: file.fileName
      })

      processed++
      
      // Update job progress
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          processed,
          results: JSON.stringify(results)
        }
      })

      console.log(`✅ Successfully processed ${file.fileName} on retry`)
    } catch (error: any) {
      console.error(`❌ Retry failed for ${file.fileName}:`, error)
      
      const errorMessage = error.message || 'Unknown error'
      const errorType = errorMessage.includes('JSON') ? 'JSON_PARSE_ERROR' :
                        errorMessage.includes('Rate limit') ? 'RATE_LIMIT' :
                        errorMessage.includes('timeout') ? 'TIMEOUT' :
                        'PROCESSING_ERROR'
      
      errors.push({
        fileName: file.fileName,
        driveFileId: file.driveFileId,
        driveUrl: file.driveUrl,
        entryId: file.entryId,
        error: errorMessage,
        errorType: errorType,
        timestamp: new Date().toISOString()
      })

      // Update job with errors
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          failed: errors.length,
          errors: JSON.stringify(errors)
        }
      })
    }
  }

  // Mark job as completed
  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      status: processed === failedFiles.length ? 'completed' : 'failed',
      completedAt: new Date(),
      processed,
      failed: errors.length,
      results: JSON.stringify(results),
      errors: JSON.stringify(errors)
    }
  })

  console.log(`🏁 Retry job completed: ${processed}/${failedFiles.length} successful`)
}
