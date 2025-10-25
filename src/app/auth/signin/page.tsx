'use client'

import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, Brain, FolderOpen, Sparkles } from 'lucide-react'

export default function SignIn() {
  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <Camera className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Welcome to Snapshoty</CardTitle>
          <CardDescription>
            Organize Your Screenshots and Make Them Searchable
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Brain className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">AI Analysis</p>
                <p className="text-sm text-muted-foreground">
                  Automatically extract text, concepts, and insights from your screenshots
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <FolderOpen className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Smart Organization</p>
                <p className="text-sm text-muted-foreground">
                  Organize your knowledge with folders and AI-generated learning paths
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Instant Search</p>
                <p className="text-sm text-muted-foreground">
                  Find any screenshot instantly with powerful full-text search
                </p>
              </div>
            </div>
          </div>
          
          <Button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full"
            size="lg"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By signing in, you agree to our terms and privacy policy
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
