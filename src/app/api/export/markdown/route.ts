import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// GET /api/export/markdown - Export screenshots to Markdown
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const folderId = searchParams.get('folder_id')

    const screenshots = await prisma.screenshot.findMany({
      where: {
        userId: session.user.id,
        ...(folderId && { folderId })
      },
      orderBy: [
        { learningOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    let mdContent = '# SnapNotes Export\n\n'
    mdContent += `*Generated on ${new Date().toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}*\n\n`
    mdContent += `Total Notes: ${screenshots.length}\n\n`
    mdContent += '---\n\n'

    for (const screenshot of screenshots) {
      mdContent += `## ${screenshot.title}\n\n`
      mdContent += `**File:** ${screenshot.fileName}  \n`
      mdContent += `**Date:** ${new Date(screenshot.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })}  \n\n`

      if (screenshot.keywords) {
        const keywords = JSON.parse(screenshot.keywords)
        if (keywords.length > 0) {
          mdContent += `**Keywords:** ${keywords.join(', ')}  \n\n`
        }
      }

      if (screenshot.summary) {
        mdContent += `### Summary\n\n${screenshot.summary}\n\n`
      }

      if (screenshot.fullText) {
        mdContent += `### Full Text\n\n\`\`\`\n${screenshot.fullText}\n\`\`\`\n\n`
      }

      mdContent += '---\n\n'
    }

    const filename = `snapnotes_export_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.md`

    return new NextResponse(mdContent, {
      headers: {
        'Content-Type': 'text/markdown',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
