import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

/**
 * Local filesystem storage for GUEST mode uploads.
 * Stores temporary screenshots on the server filesystem,
 * avoiding the Google Drive Service Account quota limitation.
 */

interface GuestUploadResult {
    id: string
    filePath: string
}

// In-memory tracking of guest sessions for rate limiting
const guestSessions = new Map<string, { fileIds: string[], count: number, createdAt: number }>()

const MAX_GUEST_SCREENSHOTS = 20
const SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

// Temp directory for guest uploads
const GUEST_UPLOAD_DIR = path.join(process.cwd(), 'tmp', 'guest-uploads')

/**
 * Ensure the guest upload directory exists
 */
async function ensureUploadDir(sessionDir: string): Promise<void> {
    await fs.mkdir(sessionDir, { recursive: true })
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
 * Save an uploaded file to the local temp directory
 */
export async function uploadToGuestStorage(
    guestSessionId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
): Promise<GuestUploadResult> {
    cleanupExpiredSessions()

    // Enforce per-session limit
    const session = guestSessions.get(guestSessionId)
    const currentCount = session?.count || 0

    if (currentCount >= MAX_GUEST_SCREENSHOTS) {
        throw new Error(`Guest screenshot limit reached (${MAX_GUEST_SCREENSHOTS}). Sign in to upload more!`)
    }

    // Create session-specific directory
    const sessionDir = path.join(GUEST_UPLOAD_DIR, guestSessionId.slice(0, 16))
    await ensureUploadDir(sessionDir)

    // Generate a unique file ID
    const fileId = crypto.randomUUID()
    const ext = path.extname(fileName) || '.png'
    const safeFileName = `${fileId}${ext}`
    const filePath = path.join(sessionDir, safeFileName)

    // Write file to disk
    await fs.writeFile(filePath, fileBuffer)

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
        filePath,
    }
}

/**
 * Delete a single guest file
 */
async function deleteGuestFile(guestSessionId: string, fileId: string): Promise<void> {
    const sessionDir = path.join(GUEST_UPLOAD_DIR, guestSessionId.slice(0, 16))
    try {
        const entries = await fs.readdir(sessionDir)
        for (const entry of entries) {
            if (entry.startsWith(fileId)) {
                await fs.unlink(path.join(sessionDir, entry))
                return
            }
        }
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            console.error(`Failed to delete guest file ${fileId}:`, error.message)
        }
    }
}

/**
 * Clean up all files for a guest session
 */
export async function cleanupGuestSession(guestSessionId: string): Promise<{ deleted: number, errors: number }> {
    const session = guestSessions.get(guestSessionId)

    // Always try to clean up the directory even if session isn't tracked
    const sessionDir = path.join(GUEST_UPLOAD_DIR, guestSessionId.slice(0, 16))
    let deleted = 0
    let errors = 0

    try {
        await fs.rm(sessionDir, { recursive: true, force: true })
        deleted = session?.fileIds.length || 0
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            console.error(`Failed to cleanup guest session dir:`, error.message)
            errors = 1
        }
    }

    // Remove session tracking
    guestSessions.delete(guestSessionId)

    console.log(`🧹 Guest session ${guestSessionId.slice(0, 8)} cleanup: ${deleted} files removed`)
    return { deleted, errors }
}

/**
 * Remove expired sessions (auto-cleanup stale sessions)
 */
function cleanupExpiredSessions() {
    const now = Date.now()
    guestSessions.forEach((session, sessionId) => {
        if (now - session.createdAt > SESSION_TTL_MS) {
            cleanupGuestSession(sessionId).catch(console.error)
        }
    })
}
