import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { checkEnvironmentVariables } from "@/lib/env-check"

// Validate environment variables at startup
checkEnvironmentVariables()

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: [
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/drive.file", // Access to files created by the app
          ].join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ account }) {
      if (account?.provider === 'google') {
        const requiredScope = 'https://www.googleapis.com/auth/drive.file'
        const scopes = account.scope?.split(' ') || []
        
        // Check if the required scope is present
        // Google might return scopes as full URLs or short names depending on configuration
        const hasDriveAccess = scopes.some(scope => 
          scope === requiredScope || 
          scope === 'https://www.googleapis.com/auth/drive' ||
          scope.includes('drive.file')
        )

        if (!hasDriveAccess) {
          // Return false to display a default error message 
          // or return a string to redirect to a custom error page
          return '/auth/error?error=DrivePermissionsRequired'
        }
      }
      return true
    },
    async session({ session, token, user }) {
      if (session.user) {
        session.user.id = user.id
      }
      
      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      })
      
      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'database',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
}
