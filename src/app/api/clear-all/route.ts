import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { deleteFromGoogleDrive } from '@/lib/google-drive'

// DELETE /api/clear-all - Clear all user data
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all user's screenshots
    const screenshots = await prisma.screenshot.findMany({
      where: { userId: session.user.id }
    })

    // Delete files from Google Drive
    for (const screenshot of screenshots) {
      if (screenshot.driveFileId) {
        try {
          await deleteFromGoogleDrive(session.user.id, screenshot.driveFileId)
          console.log(`✅ Deleted file from Drive: ${screenshot.driveFileId}`)
        } catch (error: any) {
          // Silently ignore 404 errors - file already deleted
          if (error.status === 404 || error.code === 404) {
            console.log(`⏭️  File already deleted: ${screenshot.driveFileId}`)
          } else {
            console.error(`⚠️  Error deleting file from Drive:`, error.message)
          }
          // Continue even if delete fails
        }
      }
    }

    // Delete all user data from database
    await prisma.$transaction([
      prisma.screenshot.deleteMany({
        where: { userId: session.user.id }
      }),
      prisma.learningPath.deleteMany({
        where: { userId: session.user.id }
      }),
      prisma.folder.deleteMany({
        where: { userId: session.user.id }
      }),
      prisma.processingJob.deleteMany({
        where: { userId: session.user.id }
      })
    ])

    return NextResponse.json({ 
      success: true, 
      deleted: screenshots.length 
    })
  } catch (error) {
    console.error('Clear all error:', error)
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    )
  }
}
