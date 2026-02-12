import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/stats - Get user statistics
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [
      totalScreenshots,
      totalFolders,
      recentScreenshots,
      screenshotsByDifficulty
    ] = await Promise.all([
      prisma.screenshot.count({
        where: { userId: session.user.id }
      }),
      prisma.folder.count({
        where: { userId: session.user.id }
      }),
      prisma.screenshot.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          createdAt: true
        }
      }),
      prisma.screenshot.groupBy({
        by: ['difficulty'],
        where: { userId: session.user.id },
        _count: true
      })
    ])

    const difficultyCounts = {
      Beginner: 0,
      Intermediate: 0,
      Advanced: 0
    }

    screenshotsByDifficulty.forEach(item => {
      difficultyCounts[item.difficulty as keyof typeof difficultyCounts] = item._count
    })

    return NextResponse.json({
      total_screenshots: totalScreenshots,
      total_folders: totalFolders,
      recent_screenshots: recentScreenshots,
      screenshots_by_difficulty: difficultyCounts
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
