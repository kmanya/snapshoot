import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/screenshots - Get user's screenshots
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const folderId = searchParams.get('folder_id')
    const limit = searchParams.get('limit')

    const whereClause: any = {
      userId: session.user.id
    }

    if (folderId) {
      whereClause.folderId = folderId
    }

    const screenshots = await prisma.screenshot.findMany({
      where: whereClause,
      orderBy: [
        { learningOrder: 'asc' },
        { createdAt: 'desc' }
      ],
      take: limit ? parseInt(limit) : undefined,
      include: {
        folder: {
          select: {
            name: true
          }
        }
      }
    })

    // Parse JSON fields
    const formattedScreenshots = screenshots.map(screenshot => ({
      ...screenshot,
      keywords: screenshot.keywords ? JSON.parse(screenshot.keywords) : [],
      concepts: screenshot.concepts ? JSON.parse(screenshot.concepts) : [],
      prerequisites: screenshot.prerequisites ? JSON.parse(screenshot.prerequisites) : [],
      nextTopics: screenshot.nextTopics ? JSON.parse(screenshot.nextTopics) : []
    }))

    return NextResponse.json({ screenshots: formattedScreenshots })
  } catch (error) {
    console.error('Error fetching screenshots:', error)
    return NextResponse.json(
      { error: 'Failed to fetch screenshots' },
      { status: 500 }
    )
  }
}
