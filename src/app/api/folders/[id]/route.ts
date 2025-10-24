import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// DELETE /api/folders/[id] - Delete a folder
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const folderId = params.id

    // Verify folder ownership
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId: session.user.id
      }
    })

    if (!folder) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      )
    }

    // Move all screenshots in this folder to no folder (set folderId to null)
    await prisma.screenshot.updateMany({
      where: {
        folderId: folderId,
        userId: session.user.id
      },
      data: {
        folderId: null
      }
    })

    // Delete the folder
    await prisma.folder.delete({
      where: {
        id: folderId
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting folder:', error)
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    )
  }
}
