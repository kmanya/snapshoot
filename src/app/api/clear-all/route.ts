import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import fs from 'fs/promises'
import path from 'path'

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

    // Delete files
    for (const screenshot of screenshots) {
      if (screenshot.path) {
        try {
          const filePath = screenshot.path.startsWith('/uploads/')
            ? path.join(process.cwd(), 'public', screenshot.path)
            : screenshot.path
          
          await fs.unlink(filePath)
        } catch (error) {
          console.error(`Error deleting file ${screenshot.path}:`, error)
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
