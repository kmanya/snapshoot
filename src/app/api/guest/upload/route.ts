import { NextRequest, NextResponse } from 'next/server'
import { processScreenshotWithQwenAPI } from '@/lib/ai/qwen-api'
import { uploadToGuestStorage, getGuestSessionInfo } from '@/lib/guest-storage'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
    try {
        if (!process.env.QWEN_API_KEY) {
            return NextResponse.json(
                { error: 'No AI processing available. Configure Qwen API key.' },
                { status: 503 }
            )
        }

        const formData = await req.formData()
        const files = formData.getAll('files') as File[]
        const guestSessionId = formData.get('guestSessionId') as string

        if (!guestSessionId) {
            return NextResponse.json(
                { error: 'Guest session ID is required' },
                { status: 400 }
            )
        }

        if (!files || files.length === 0) {
            return NextResponse.json(
                { error: 'No files provided' },
                { status: 400 }
            )
        }

        // Check session limits
        const sessionInfo = getGuestSessionInfo(guestSessionId)
        if (sessionInfo.remaining <= 0) {
            return NextResponse.json(
                {
                    error: `Guest limit reached (${sessionInfo.maxAllowed} screenshots). Sign in to upload more!`,
                    sessionInfo
                },
                { status: 429 }
            )
        }

        // Limit files to remaining quota
        const allowedFiles = files.slice(0, sessionInfo.remaining)

        const results: Array<{
            id: string
            filename: string
            title: string
            summary: string
            keywords: string[]
            concepts: string[]
            difficulty: string
            fullText?: string
            conceptExplanation?: string
            codeExplanation?: string
            prerequisites?: string[]
            nextTopics?: string[]
            driveFileId: string
            imageUrl: string
        }> = []

        const errors: Array<{ file: string; error: string }> = []

        for (const file of allowedFiles) {
            try {
                // Validate file type
                if (!file.type.startsWith('image/')) {
                    errors.push({ file: file.name, error: 'Invalid file type' })
                    continue
                }

                // Validate file size
                if (file.size > MAX_FILE_SIZE) {
                    errors.push({ file: file.name, error: 'File too large (max 10MB)' })
                    continue
                }

                // Save to local temp storage
                const buffer = Buffer.from(await file.arrayBuffer())
                const storageResult = await uploadToGuestStorage(
                    guestSessionId,
                    buffer,
                    file.name,
                    file.type
                )

                // Process with AI — pass local file path directly
                const aiResult = await processScreenshotWithQwenAPI(
                    storageResult.filePath,
                    `guest_${guestSessionId}`
                )

                results.push({
                    id: storageResult.id,
                    filename: file.name,
                    title: aiResult.title,
                    summary: aiResult.summary,
                    keywords: aiResult.keywords,
                    concepts: aiResult.concepts,
                    difficulty: aiResult.difficulty,
                    fullText: aiResult.full_text,
                    conceptExplanation: aiResult.concept_explanation,
                    codeExplanation: aiResult.code_explanation,
                    prerequisites: aiResult.prerequisites,
                    nextTopics: aiResult.next_topics,
                    driveFileId: storageResult.id,
                    imageUrl: '', // No public URL needed for guest temp files
                })
            } catch (error: any) {
                console.error(`Guest upload error for ${file.name}:`, error)
                errors.push({
                    file: file.name,
                    error: error.message || 'Processing failed',
                })
            }
        }

        // Get updated session info
        const updatedSessionInfo = getGuestSessionInfo(guestSessionId)

        return NextResponse.json({
            results,
            errors,
            sessionInfo: updatedSessionInfo,
            skipped: files.length - allowedFiles.length,
        })
    } catch (error: any) {
        console.error('Guest upload error:', error)
        return NextResponse.json(
            { error: error.message || 'Guest upload failed' },
            { status: 500 }
        )
    }
}
