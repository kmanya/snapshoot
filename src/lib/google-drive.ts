import { google } from 'googleapis'
import { prisma } from './db'

/**
 * Google Drive API Helper for Snapshoty
 * Uploads screenshots to user's Google Drive with proper permissions
 */

interface DriveUploadResult {
  id: string
  webViewLink: string
  webContentLink: string
  thumbnailLink?: string
}

/**
 * Get user's access token from database and refresh if needed
 */
async function getUserAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      provider: 'google',
    },
  })

  if (!account?.access_token) {
    throw new Error('No Google account linked. Please sign in again.')
  }

  // Check if token is expired
  const now = Math.floor(Date.now() / 1000)
  if (account.expires_at && account.expires_at < now) {
    // Token expired, refresh it
    if (!account.refresh_token) {
      throw new Error('No refresh token available. Please sign in again.')
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({
      refresh_token: account.refresh_token,
    })

    try {
      const { credentials } = await oauth2Client.refreshAccessToken()
      
      // Update database with new token
      await prisma.account.update({
        where: { id: account.id },
        data: {
          access_token: credentials.access_token,
          expires_at: credentials.expiry_date 
            ? Math.floor(credentials.expiry_date / 1000)
            : null,
        },
      })

      return credentials.access_token!
    } catch (error) {
      console.error('Failed to refresh token:', error)
      throw new Error('Failed to refresh access token. Please sign in again.')
    }
  }

  return account.access_token
}

/**
 * Upload a file to user's Google Drive
 */
export async function uploadToGoogleDrive(
  userId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<DriveUploadResult> {
  try {
    // Get user's access token
    const accessToken = await getUserAccessToken(userId)

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({
      access_token: accessToken,
    })

    // Initialize Drive API
    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    // Check if SnapNotes folder exists, create if not
    const folderName = 'SnapNotes Screenshots'
    const folderQuery = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    
    const foldersResponse = await drive.files.list({
      q: folderQuery,
      fields: 'files(id, name)',
      spaces: 'drive',
    })

    let folderId: string
    if (foldersResponse.data.files && foldersResponse.data.files.length > 0) {
      folderId = foldersResponse.data.files[0].id!
    } else {
      // Create folder
      const folderMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }
      
      const folder = await drive.files.create({
        requestBody: folderMetadata,
        fields: 'id',
      })
      
      folderId = folder.data.id!
    }

    // Upload file to Drive
    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    }

    const media = {
      mimeType,
      body: require('stream').Readable.from(fileBuffer),
    }

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, webViewLink, webContentLink, thumbnailLink',
    })

    // Make file readable by anyone with the link (for app access)
    await drive.permissions.create({
      fileId: file.data.id!,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })

    return {
      id: file.data.id!,
      webViewLink: file.data.webViewLink!,
      webContentLink: file.data.webContentLink!,
      thumbnailLink: file.data.thumbnailLink ?? undefined,
    }
  } catch (error: any) {
    console.error('Google Drive upload error:', error)
    
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      throw new Error('Google authentication expired. Please sign out and sign in again.')
    }
    
    throw new Error(`Failed to upload to Google Drive: ${error.message}`)
  }
}

/**
 * Delete a file from user's Google Drive
 */
export async function deleteFromGoogleDrive(
  userId: string,
  fileId: string
): Promise<void> {
  try {
    const accessToken = await getUserAccessToken(userId)
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
    
    oauth2Client.setCredentials({
      access_token: accessToken,
    })

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    await drive.files.delete({
      fileId: fileId
    })
  } catch (error: any) {
    // Rethrow with simplified message for 404s
    if (error.status === 404 || error.code === 404) {
      const notFoundError = new Error(`File not found: ${fileId}`)
      ;(notFoundError as any).status = 404
      ;(notFoundError as any).code = 404
      throw notFoundError
    }
    throw error
  }
}

/**
 * Get direct download URL for a file
 * This creates a temporary direct download link
 */
export async function getDirectDownloadUrl(
  userId: string,
  fileId: string
): Promise<string> {
  try {
    const accessToken = await getUserAccessToken(userId)

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({
      access_token: accessToken,
    })

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    const response = await drive.files.get({
      fileId,
      fields: 'webContentLink',
    })

    return response.data.webContentLink!
  } catch (error: any) {
    console.error('Failed to get download URL:', error)
    throw new Error(`Failed to get file download URL: ${error.message}`)
  }
}
