/**
 * Runtime environment variable validation
 * Throws helpful errors if required variables are missing
 */

const requiredEnvVars = {
  DATABASE_URL_NEON: 'PostgreSQL database URL (get from Neon dashboard)',
  NEXTAUTH_URL: 'Your deployment URL (e.g., https://your-app.vercel.app)',
  NEXTAUTH_SECRET: 'Random secret (generate with: openssl rand -base64 32)',
  GOOGLE_CLIENT_ID: 'Google OAuth client ID',
  GOOGLE_CLIENT_SECRET: 'Google OAuth client secret',
} as const

export function checkEnvironmentVariables() {
  const missing: string[] = []
  
  for (const [key, description] of Object.entries(requiredEnvVars)) {
    if (!process.env[key]) {
      missing.push(`${key}: ${description}`)
    }
  }
  
  if (missing.length > 0) {
    const errorMessage = [
      '❌ Missing required environment variables:',
      '',
      ...missing.map(m => `  - ${m}`),
      '',
      '👉 Configure these in Vercel Dashboard → Settings → Environment Variables',
      '   Then redeploy the application.',
    ].join('\n')
    
    console.error(errorMessage)
    throw new Error('Missing required environment variables. Check server logs for details.')
  }
}
