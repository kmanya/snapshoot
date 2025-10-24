import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { processScreenshotWithQwenAPI } from '@/lib/ai/qwen-api'
import path from 'path'

// POST /api/screenshots/[id]/reanalyze - Reanalyze a screenshot with AI
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.QWEN_API_KEY) {
      return NextResponse.json(
        { error: 'No AI processing available' },
        { status: 503 }
      )
    }

    const screenshot = await prisma.screenshot.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!screenshot) {
      return NextResponse.json(
        { error: 'Screenshot not found' },
        { status: 404 }
      )
    }

    // Get the full file path
    const filePath = screenshot.path.startsWith('/uploads/') 
      ? path.join(process.cwd(), 'public', screenshot.path)
      : screenshot.path

    // Reprocess the screenshot
    const result = await processScreenshotWithQwenAPI(filePath)

    // Update the screenshot with new analysis
    const updatedScreenshot = await prisma.screenshot.update({
      where: { id: params.id },
      data: {
        title: result.title,
        summary: result.summary,
        keywords: JSON.stringify(result.keywords),
        fullText: result.full_text,
        concepts: JSON.stringify(result.concepts),
        conceptExplanation: result.concept_explanation,
        codeExplanation: result.code_explanation,
        prerequisites: JSON.stringify(result.prerequisites),
        nextTopics: JSON.stringify(result.next_topics),
        difficulty: result.difficulty
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        ...updatedScreenshot,
        keywords: result.keywords,
        concepts: result.concepts,
        prerequisites: result.prerequisites,
        nextTopics: result.next_topics
      }
    })
  } catch (error) {
    console.error('Reanalysis error:', error)
    return NextResponse.json(
      { error: `Reanalysis failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
