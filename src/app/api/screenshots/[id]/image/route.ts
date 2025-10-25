import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { google } from 'googleapis'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get screenshot from database
    const screenshot = await prisma.screenshot.findUnique({
      where: { id: params.id }
    })

    if (!screenshot) {
      return NextResponse.json({ error: 'Screenshot not found' }, { status: 404 })
    }

    // Check if user owns this screenshot
    if (screenshot.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get user's Google access token
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: 'google',
      },
    })

    if (!account?.access_token) {
      return NextResponse.json({ error: 'No Google account linked' }, { status: 400 })
    }

    // Extract file ID from Drive URL
    // Path format: https://drive.google.com/uc?id=FILE_ID&export=download
    const driveFileId = extractFileIdFromDriveUrl(screenshot.path)

    if (!driveFileId) {
      return NextResponse.json({ error: 'Invalid Drive URL' }, { status: 400 })
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({
      access_token: account.access_token,
    })

    // Get file from Drive
    const drive = google.drive({ version: 'v3', auth: oauth2Client })
    
    const response = await drive.files.get(
      {
        fileId: driveFileId,
        alt: 'media',
      },
      {
        responseType: 'arraybuffer',
      }
    )

    // Return image with proper headers
    return new NextResponse(response.data as ArrayBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error: any) {
    console.error('Error fetching image:', error)
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    )
  }
}

function extractFileIdFromDriveUrl(url: string): string | null {
  try {
    // Try different URL formats
    // Format 1: https://drive.google.com/uc?id=FILE_ID&export=download
    const exportMatch = url.match(/[?&]id=([^&]+)/)
    if (exportMatch) return exportMatch[1]

    // Format 2: https://drive.google.com/file/d/FILE_ID/view
    const fileMatch = url.match(/\/file\/d\/([^\/]+)/)
    if (fileMatch) return fileMatch[1]

    // Format 3: Direct file ID
    if (url.length > 20 && !url.includes('/') && !url.includes('?')) {
      return url
    }

    return null
  } catch {
    return null
  }
}
