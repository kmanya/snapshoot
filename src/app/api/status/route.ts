import { NextRequest, NextResponse } from 'next/server'

// GET /api/status - Get system status and capabilities
export async function GET(req: NextRequest) {
  const qwenApiAvailable = !!process.env.QWEN_API_KEY
  const geminiAvailable = !!process.env.GEMINI_API_KEY
  const googleAuthConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

  return NextResponse.json({
    qwen_mode: qwenApiAvailable ? 'api' : null,
    qwen_api: qwenApiAvailable,
    qwen_local: false, // Local model not implemented in Next.js version
    gemini: geminiAvailable,
    google_auth: googleAuthConfigured
  })
}
