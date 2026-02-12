'use client'

import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
    Camera,
    Brain,
    FolderOpen,
    Sparkles,
    Upload,
    ArrowRight,
    Shield,
    Zap,
    Eye
} from 'lucide-react'

export default function LandingPage() {
    const router = useRouter()

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
            {/* Header */}
            <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 md:px-8">
                    <h1 className="text-xl sm:text-2xl font-bold">📸 Snapshoty</h1>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => signIn('google', { callbackUrl: '/' })}
                    >
                        Sign In
                    </Button>
                </div>
            </header>

            {/* Hero Section */}
            <section className="container mx-auto px-4 py-10 sm:py-16 md:py-24 text-center">
                <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">
                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-2 sm:mb-4">
                        <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        AI-Powered Screenshot Analysis
                    </div>

                    <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
                        Your Screenshots,{' '}
                        <span className="text-primary bg-clip-text">
                            Organized & Searchable
                        </span>
                    </h2>

                    <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
                        Upload any screenshot and let AI instantly extract text, concepts, and insights.
                        Organize your knowledge with smart folders and powerful search.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4">
                        <Button
                            size="lg"
                            className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 gap-2 shadow-lg shadow-primary/25"
                            onClick={() => router.push('/guest')}
                        >
                            <Eye className="h-5 w-5" />
                            Try Without Login
                            <ArrowRight className="h-5 w-5" />
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            className="text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 gap-2"
                            onClick={() => signIn('google', { callbackUrl: '/' })}
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                            Sign In with Google
                        </Button>
                    </div>

                    <p className="text-sm text-muted-foreground">
                        Try up to 20 screenshots for free — no account needed!
                    </p>
                </div>
            </section>

            {/* Features Grid */}
            <section className="container mx-auto px-4 py-10 sm:py-16">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-primary/5 hover:shadow-xl transition-shadow">
                        <CardContent className="pt-6 space-y-3">
                            <div className="p-3 bg-primary/10 rounded-xl w-fit">
                                <Brain className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold">AI Analysis</h3>
                            <p className="text-muted-foreground text-sm">
                                Automatically extract text, concepts, code explanations, and insights from every screenshot using advanced AI.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-primary/5 hover:shadow-xl transition-shadow">
                        <CardContent className="pt-6 space-y-3">
                            <div className="p-3 bg-primary/10 rounded-xl w-fit">
                                <FolderOpen className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold">Smart Organization</h3>
                            <p className="text-muted-foreground text-sm">
                                Organize your knowledge with folders and AI-generated learning paths. Never lose a screenshot again.
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-lg bg-gradient-to-br from-card to-primary/5 hover:shadow-xl transition-shadow">
                        <CardContent className="pt-6 space-y-3">
                            <div className="p-3 bg-primary/10 rounded-xl w-fit">
                                <Sparkles className="h-6 w-6 text-primary" />
                            </div>
                            <h3 className="text-lg font-semibold">Instant Search</h3>
                            <p className="text-muted-foreground text-sm">
                                Find any screenshot instantly with powerful full-text search across all your analyzed content.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* How It Works */}
            <section className="container mx-auto px-4 py-10 sm:py-16">
                <h3 className="text-xl sm:text-2xl font-bold text-center mb-6 sm:mb-10">How It Works</h3>
                <div className="flex flex-col md:flex-row gap-6 sm:gap-8 max-w-4xl mx-auto items-center">
                    <div className="flex-1 text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-lg font-bold text-primary">1</div>
                        <h4 className="font-semibold">Upload</h4>
                        <p className="text-sm text-muted-foreground">Drag & drop your screenshots</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
                    <div className="flex-1 text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-lg font-bold text-primary">2</div>
                        <h4 className="font-semibold">AI Analyzes</h4>
                        <p className="text-sm text-muted-foreground">AI extracts text, concepts & insights</p>
                    </div>
                    <ArrowRight className="h-6 w-6 text-muted-foreground hidden md:block" />
                    <div className="flex-1 text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-lg font-bold text-primary">3</div>
                        <h4 className="font-semibold">Search & Learn</h4>
                        <p className="text-sm text-muted-foreground">Find anything instantly</p>
                    </div>
                </div>
            </section>

            {/* Guest Mode Info */}
            <section className="container mx-auto px-4 py-10 sm:py-16">
                <Card className="max-w-3xl mx-auto border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-primary/10 rounded-lg mt-1">
                                <Zap className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-semibold text-lg">Try Guest Mode</h3>
                                <p className="text-muted-foreground text-sm">
                                    Upload up to <strong>20 screenshots</strong> without creating an account.
                                    Your results are temporary and will be deleted when you leave.
                                    Sign in to save your screenshots permanently to your Google Drive.
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                                    <Shield className="h-3.5 w-3.5" />
                                    <span>Your data is automatically cleaned up after your session ends</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* Footer */}
            <footer className="border-t py-6">
                <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
                    <p>📸 Snapshoty — Organize Your Screenshots with AI</p>
                </div>
            </footer>
        </div>
    )
}
