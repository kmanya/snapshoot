import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// POST /api/search - Search screenshots
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, folder_id } = await req.json()

    let screenshots

    if (query && query.trim().length > 0) {
      // Perform search
      const searchTerm = query.toLowerCase()
      
      screenshots = await prisma.screenshot.findMany({
        where: {
          userId: session.user.id,
          ...(folder_id && { folderId: folder_id }),
          OR: [
            { title: { contains: searchTerm } },
            { summary: { contains: searchTerm } },
            { keywords: { contains: searchTerm } },
            { fullText: { contains: searchTerm } },
            { concepts: { contains: searchTerm } },
            { conceptExplanation: { contains: searchTerm } },
            { codeExplanation: { contains: searchTerm } }
          ]
        },
        orderBy: [
          { learningOrder: 'asc' },
          { createdAt: 'desc' }
        ],
        include: {
          folder: {
            select: {
              name: true
            }
          }
        }
      })
    } else {
      // No search query, return all screenshots in folder
      screenshots = await prisma.screenshot.findMany({
        where: {
          userId: session.user.id,
          ...(folder_id && { folderId: folder_id })
        },
        orderBy: [
          { learningOrder: 'asc' },
          { createdAt: 'desc' }
        ],
        include: {
          folder: {
            select: {
              name: true
            }
          }
        }
      })
    }

    // Parse JSON fields
    const formattedScreenshots = screenshots.map(screenshot => ({
      ...screenshot,
      keywords: screenshot.keywords ? JSON.parse(screenshot.keywords) : [],
      concepts: screenshot.concepts ? JSON.parse(screenshot.concepts) : [],
      prerequisites: screenshot.prerequisites ? JSON.parse(screenshot.prerequisites) : [],
      nextTopics: screenshot.nextTopics ? JSON.parse(screenshot.nextTopics) : []
    }))

    return NextResponse.json({ 
      results: formattedScreenshots,
      count: formattedScreenshots.length
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
