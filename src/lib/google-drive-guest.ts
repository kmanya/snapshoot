import { google } from 'googleapis'

/**
 * Google Drive helper for GUEST mode uploads.
 * Uses a Service Account to upload temporary screenshots
 * to the app owner's Google Drive folder.
 */

interface GuestDriveUploadResult {
    id: string
    webContentLink: string
}

// In-memory tracking of guest sessions for rate limiting
// Map<guestSessionId, { fileIds: string[], count: number, createdAt: number }>
const guestSessions = new Map<string, { fileIds: string[], count: number, createdAt: number }>()

const MAX_GUEST_SCREENSHOTS = 20
const SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours - auto-expire sessions

/**
 * Get authenticated Drive client using Service Account
 */
function getServiceAccountDrive() {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    const folderId = process.env.GUEST_DRIVE_FOLDER_ID

    if (!keyJson || !folderId) {
        throw new Error('Guest mode not configured. GOOGLE_SERVICE_ACCOUNT_KEY and GUEST_DRIVE_FOLDER_ID are required.')
    }

    let credentials: any
    try {
        credentials = JSON.parse(keyJson)
    } catch {
        throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY: could not parse JSON')
    }

    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    })

    return { drive: google.drive({ version: 'v3', auth }), folderId }
}

/**
 * Check if a guest session can upload more screenshots
 */
export function getGuestSessionInfo(guestSessionId: string): { count: number, remaining: number, maxAllowed: number } {
    cleanupExpiredSessions()
    const session = guestSessions.get(guestSessionId)
    const count = session?.count || 0
    return {
        count,
        remaining: MAX_GUEST_SCREENSHOTS - count,
        maxAllowed: MAX_GUEST_SCREENSHOTS,
    }
}

/**
 * Upload a file to the guest folder on the app owner's Google Drive
 */
export async function uploadToGuestDrive(
    guestSessionId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
): Promise<GuestDriveUploadResult> {
    cleanupExpiredSessions()

    // Enforce per-session limit
    const session = guestSessions.get(guestSessionId)
    const currentCount = session?.count || 0

    if (currentCount >= MAX_GUEST_SCREENSHOTS) {
        throw new Error(`Guest screenshot limit reached (${MAX_GUEST_SCREENSHOTS}). Sign in to upload more!`)
    }

    const { drive, folderId } = getServiceAccountDrive()

    // Upload file to the guest folder
    const fileMetadata = {
        name: `guest_${guestSessionId.slice(0, 8)}_${Date.now()}_${fileName}`,
        parents: [folderId],
    }

    const media = {
        mimeType,
        body: require('stream').Readable.from(fileBuffer),
    }

    const file = await drive.files.create({
        requestBody: fileMetadata,
        media,
        fields: 'id, webContentLink',
    })

    // Make file readable by anyone with the link (needed for AI processing)
    await drive.permissions.create({
        fileId: file.data.id!,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    })

    const fileId = file.data.id!

    // Track in session
    if (session) {
        session.fileIds.push(fileId)
        session.count++
    } else {
        guestSessions.set(guestSessionId, {
            fileIds: [fileId],
            count: 1,
            createdAt: Date.now(),
        })
    }

    return {
        id: fileId,
        webContentLink: file.data.webContentLink!,
    }
}

/**
 * Delete a single file from the guest Drive folder
 */
export async function deleteFromGuestDrive(fileId: string): Promise<void> {
    try {
        const { drive } = getServiceAccountDrive()
        await drive.files.delete({ fileId })
    } catch (error: any) {
        if (error.status === 404 || error.code === 404) {
            console.log(`Guest file already deleted: ${fileId}`)
            return
        }
        console.error(`Failed to delete guest file ${fileId}:`, error.message)
    }
}

/**
 * Clean up all files for a guest session
 */
export async function cleanupGuestSession(guestSessionId: string): Promise<{ deleted: number, errors: number }> {
    const session = guestSessions.get(guestSessionId)
    if (!session || session.fileIds.length === 0) {
        guestSessions.delete(guestSessionId)
        return { deleted: 0, errors: 0 }
    }

    let deleted = 0
    let errors = 0

    // Delete all files in parallel (batches of 5)
    const BATCH_SIZE = 5
    for (let i = 0; i < session.fileIds.length; i += BATCH_SIZE) {
        const batch = session.fileIds.slice(i, i + BATCH_SIZE)
        const results = await Promise.allSettled(
            batch.map(fileId => deleteFromGuestDrive(fileId))
        )
        results.forEach(r => {
            if (r.status === 'fulfilled') deleted++
            else errors++
        })
    }

    // Remove session tracking
    guestSessions.delete(guestSessionId)

    console.log(`🧹 Guest session ${guestSessionId.slice(0, 8)} cleanup: ${deleted} deleted, ${errors} errors`)
    return { deleted, errors }
}

/**
 * Remove expired sessions (auto-cleanup stale sessions)
 */
function cleanupExpiredSessions() {
    const now = Date.now()
    guestSessions.forEach((session, sessionId) => {
        if (now - session.createdAt > SESSION_TTL_MS) {
            // Fire-and-forget cleanup
            cleanupGuestSession(sessionId).catch(console.error)
        }
    })
}
