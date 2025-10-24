import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// DELETE /api/learning-paths/[id] - Delete a learning path
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify ownership
    const path = await prisma.learningPath.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    })

    if (!path) {
      return NextResponse.json(
        { error: 'Learning path not found' },
        { status: 404 }
      )
    }

    // Delete the learning path
    await prisma.learningPath.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting learning path:', error)
    return NextResponse.json(
      { error: 'Failed to delete learning path' },
      { status: 500 }
    )
  }
}
