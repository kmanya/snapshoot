import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFromGoogleDrive } from '@/lib/google-drive'

// GET /api/screenshots/[id] - Get a specific screenshot
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const screenshot = await prisma.screenshot.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      },
      include: {
        folder: {
          select: {
            name: true
          }
        }
      }
    })

    if (!screenshot) {
      return NextResponse.json(
        { error: 'Screenshot not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    const formattedScreenshot = {
      ...screenshot,
      keywords: screenshot.keywords ? JSON.parse(screenshot.keywords) : [],
      concepts: screenshot.concepts ? JSON.parse(screenshot.concepts) : [],
      prerequisites: screenshot.prerequisites ? JSON.parse(screenshot.prerequisites) : [],
      nextTopics: screenshot.nextTopics ? JSON.parse(screenshot.nextTopics) : []
    }

    return NextResponse.json(formattedScreenshot)
  } catch (error) {
    console.error('Error fetching screenshot:', error)
    return NextResponse.json(
      { error: 'Failed to fetch screenshot' },
      { status: 500 }
    )
  }
}

// PUT /api/screenshots/[id] - Update screenshot data
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    const updateData = await req.json()
    const allowedFields = [
      'title', 'summary', 'keywords', 'fullText', 
      'concepts', 'conceptExplanation', 'codeExplanation',
      'prerequisites', 'nextTopics', 'difficulty', 'folderId'
    ]

    // Filter and prepare update data
    const filteredData: any = {}
    for (const field of allowedFields) {
      if (field in updateData && updateData[field] !== undefined) {
        if (['keywords', 'concepts', 'prerequisites', 'nextTopics'].includes(field)) {
          // Convert arrays to JSON strings
          filteredData[field] = Array.isArray(updateData[field]) 
            ? JSON.stringify(updateData[field])
            : updateData[field]
        } else {
          filteredData[field] = updateData[field]
        }
      }
    }

    const updatedScreenshot = await prisma.screenshot.update({
      where: { id: params.id },
      data: filteredData
    })

    return NextResponse.json({ success: true, data: updatedScreenshot })
  } catch (error) {
    console.error('Error updating screenshot:', error)
    return NextResponse.json(
      { error: 'Failed to update screenshot' },
      { status: 500 }
    )
  }
}

// DELETE /api/screenshots/[id] - Delete a screenshot
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Try to delete from Google Drive first
    if (screenshot.driveFileId) {
      try {
        await deleteFromGoogleDrive(session.user.id, screenshot.driveFileId)
      } catch (error: any) {
        // Log but continue - file might already be deleted
        if (error.status === 404 || error.code === 404) {
          console.log(`⏭️  Drive file already deleted: ${screenshot.driveFileId}`)
        } else {
          console.error('⚠️  Error deleting from Drive:', error.message)
        }
      }
    }

    // Delete the database entry
    await prisma.screenshot.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting screenshot:', error)
    return NextResponse.json(
      { error: 'Failed to delete screenshot' },
      { status: 500 }
    )
  }
}
