import { NextRequest, NextResponse } from 'next/server'
import { cleanupGuestSession } from '@/lib/guest-storage'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { guestSessionId } = body

        if (!guestSessionId) {
            return NextResponse.json(
                { error: 'Guest session ID is required' },
                { status: 400 }
            )
        }

        const result = await cleanupGuestSession(guestSessionId)

        return NextResponse.json({
            success: true,
            ...result,
        })
    } catch (error: any) {
        console.error('Guest cleanup error:', error)
        return NextResponse.json(
            { error: error.message || 'Cleanup failed' },
            { status: 500 }
        )
    }
}
