import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { organizeLearningPath } from '@/lib/ai/gemini'

// POST /api/learning-paths/generate - Generate a learning path for screenshots
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API not available for learning paths' },
        { status: 503 }
      )
    }

    const { folder_id } = await req.json()

    // Get screenshots
    const screenshots = await prisma.screenshot.findMany({
      where: {
        userId: session.user.id,
        ...(folder_id && { folderId: folder_id })
      },
      include: {
        folder: {
          select: {
            name: true
          }
        }
      }
    })

    if (screenshots.length < 3) {
      return NextResponse.json(
        { error: `Need at least 3 screenshots to generate a learning path. You have ${screenshots.length}.` },
        { status: 400 }
      )
    }

    // Generate learning path
    const learningPath = await organizeLearningPath(screenshots)

    // Update learning order in database
    for (const module of learningPath.modules) {
      for (let i = 0; i < module.screenshots.length; i++) {
        await prisma.screenshot.update({
          where: { id: module.screenshots[i] },
          data: { learningOrder: module.order * 100 + i }
        })
      }
    }

    // Save learning path
    const folderName = folder_id 
      ? screenshots[0]?.folder?.name || 'Unknown Folder'
      : 'All Screenshots'
    const pathName = `${folderName} - Learning Path`

    const savedPath = await prisma.learningPath.create({
      data: {
        userId: session.user.id,
        folderId: folder_id,
        name: pathName,
        pathData: JSON.stringify(learningPath)
      }
    })

    return NextResponse.json({
      success: true,
      path_id: savedPath.id,
      learning_path: learningPath
    })
  } catch (error) {
    console.error('Learning path generation error:', error)
    return NextResponse.json(
      { error: `Failed to generate learning path: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
