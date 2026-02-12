import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/learning-paths - Get saved learning paths
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const folderId = searchParams.get('folder_id')

    const paths = await prisma.learningPath.findMany({
      where: {
        userId: session.user.id,
        ...(folderId && { folderId })
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        folder: {
          select: {
            name: true
          }
        }
      }
    })

    // Parse the pathData JSON
    const formattedPaths = paths.map(path => ({
      id: path.id,
      name: path.name,
      folderId: path.folderId,
      folderName: path.folder?.name,
      createdAt: path.createdAt,
      pathData: JSON.parse(path.pathData)
    }))

    return NextResponse.json({ paths: formattedPaths })
  } catch (error) {
    console.error('Error fetching learning paths:', error)
    return NextResponse.json(
      { error: 'Failed to fetch learning paths' },
      { status: 500 }
    )
  }
}
