import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/processing-status/[jobId] - Get status of a background processing job
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const job = await prisma.processingJob.findFirst({
      where: {
        id: params.jobId,
        userId: session.user.id
      }
    })

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    const formattedJob = {
      ...job,
      results: job.results ? JSON.parse(job.results) : [],
      errors: job.errors ? JSON.parse(job.errors) : []
    }

    return NextResponse.json(formattedJob)
  } catch (error) {
    console.error('Error fetching job status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}
