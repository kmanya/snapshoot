'use client'

import { useState, useEffect, useCallback } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
    Camera,
    Upload,
    LogIn,
    Sparkles,
    Brain,
    Code,
    FileText,
    ChevronDown,
    ChevronUp,
    AlertCircle,
    X,
    ArrowLeft,
    Info,
} from 'lucide-react'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'

interface GuestScreenshot {
    id: string
    filename: string
    title: string
    summary: string
    keywords: string[]
    concepts: string[]
    difficulty: string
    fullText?: string
    conceptExplanation?: string
    codeExplanation?: string
    prerequisites?: string[]
    nextTopics?: string[]
    driveFileId: string
    imageUrl: string
}

export default function GuestPage() {
    const router = useRouter()
    const [guestSessionId, setGuestSessionId] = useState<string>('')
    const [screenshots, setScreenshots] = useState<GuestScreenshot[]>([])
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [sessionInfo, setSessionInfo] = useState({ count: 0, remaining: 20, maxAllowed: 20 })
    const [expandedSections, setExpandedSections] = useState<{ [key: string]: string | null }>({})
    const [error, setError] = useState<string | null>(null)

    // Initialize guest session
    useEffect(() => {
        let sessionId = sessionStorage.getItem('guestSessionId')
        if (!sessionId) {
            sessionId = uuidv4()
            sessionStorage.setItem('guestSessionId', sessionId)
        }
        setGuestSessionId(sessionId)

        // Load any existing screenshots from sessionStorage
        const savedScreenshots = sessionStorage.getItem('guestScreenshots')
        if (savedScreenshots) {
            try {
                setScreenshots(JSON.parse(savedScreenshots))
            } catch { }
        }

        const savedSessionInfo = sessionStorage.getItem('guestSessionInfo')
        if (savedSessionInfo) {
            try {
                setSessionInfo(JSON.parse(savedSessionInfo))
            } catch { }
        }
    }, [])

    // Save screenshots to sessionStorage whenever they change
    useEffect(() => {
        if (screenshots.length > 0) {
            sessionStorage.setItem('guestScreenshots', JSON.stringify(screenshots))
        }
    }, [screenshots])

    // Save session info
    useEffect(() => {
        sessionStorage.setItem('guestSessionInfo', JSON.stringify(sessionInfo))
    }, [sessionInfo])

    // Cleanup on page unload
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (guestSessionId) {
                // Use sendBeacon for reliable cleanup on tab close
                const data = JSON.stringify({ guestSessionId })
                navigator.sendBeacon('/api/guest/cleanup', data)
                sessionStorage.removeItem('guestSessionId')
                sessionStorage.removeItem('guestScreenshots')
                sessionStorage.removeItem('guestSessionInfo')
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [guestSessionId])

    // Toggle detail sections
    const toggleSection = (screenshotId: string, section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [screenshotId]: prev[screenshotId] === section ? null : section,
        }))
    }

    // File upload handler
    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0 || !guestSessionId) return

            if (sessionInfo.remaining <= 0) {
                setError('Guest limit reached! Sign in to upload more screenshots.')
                return
            }

            setUploading(true)
            setUploadProgress(5)
            setError(null)

            try {
                // Process in batches of 3 for guest mode (smaller batches)
                const BATCH_SIZE = 3
                const chunks: File[][] = []
                for (let i = 0; i < acceptedFiles.length; i += BATCH_SIZE) {
                    chunks.push(acceptedFiles.slice(i, i + BATCH_SIZE))
                }

                let processedTotal = 0
                const totalFiles = acceptedFiles.length

                for (const chunk of chunks) {
                    const formData = new FormData()
                    chunk.forEach(file => formData.append('files', file))
                    formData.append('guestSessionId', guestSessionId)

                    const res = await axios.post('/api/guest/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    })

                    const { results, errors, sessionInfo: newSessionInfo } = res.data

                    if (newSessionInfo) {
                        setSessionInfo(newSessionInfo)
                    }

                    if (results && results.length > 0) {
                        setScreenshots(prev => [...prev, ...results])
                    }

                    if (errors && errors.length > 0) {
                        console.error('Guest upload errors:', errors)
                    }

                    processedTotal += chunk.length
                    setUploadProgress(Math.round((processedTotal / totalFiles) * 100))
                }
            } catch (err: any) {
                console.error('Guest upload failed:', err)
                const msg = err.response?.data?.error || 'Upload failed. Please try again.'
                setError(msg)

                if (err.response?.data?.sessionInfo) {
                    setSessionInfo(err.response.data.sessionInfo)
                }
            } finally {
                setUploading(false)
                setUploadProgress(0)
            }
        },
        [guestSessionId, sessionInfo.remaining]
    )

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'],
        },
        disabled: uploading,
    })

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b">
                <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4 md:px-8 gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 shrink-0" onClick={() => router.push('/')}>
                            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                        <h1 className="text-lg sm:text-2xl font-bold whitespace-nowrap">📸 Snapshoty</h1>
                        <span className="text-[10px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 whitespace-nowrap">
                            Guest
                            <span className="hidden sm:inline"> Mode</span>
                        </span>
                    </div>

                    <Button
                        size="sm"
                        onClick={() => signIn('google', { callbackUrl: '/' })}
                        className="gap-1.5 sm:gap-2 shrink-0 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3"
                    >
                        <LogIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden xs:inline">Sign In</span>
                        <span className="hidden sm:inline"> to Save</span>
                    </Button>
                </div>
            </header>

            {/* Guest Mode Banner */}
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-b border-orange-200/50 dark:border-orange-800/30">
                <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                        <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                            <Info className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-xs sm:text-sm font-medium text-orange-800 dark:text-orange-300">
                                    Guest Mode — your screenshots are temporary
                                </p>
                                <p className="text-[11px] sm:text-xs text-orange-600/80 dark:text-orange-400/70 mt-0.5">
                                    Results lost when you close this tab.{' '}
                                    <button
                                        className="underline font-medium hover:text-orange-700 dark:hover:text-orange-300"
                                        onClick={() => signIn('google', { callbackUrl: '/' })}
                                    >
                                        Sign in
                                    </button>{' '}
                                    to save permanently.
                                </p>
                            </div>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end gap-1.5 sm:gap-0 pl-6 sm:pl-0 shrink-0">
                            <p className="text-xs sm:text-sm font-bold text-orange-700 dark:text-orange-400">
                                {sessionInfo.count}/{sessionInfo.maxAllowed}
                            </p>
                            <p className="text-[10px] sm:text-xs text-orange-600/70 dark:text-orange-400/50">used</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
                {/* Upload Area */}
                <Card className="mb-4 sm:mb-6">
                    <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
                            Upload Screenshots
                        </CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Drop your screenshots here for instant AI analysis
                            ({sessionInfo.remaining} remaining)
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {uploading ? (
                            <div className="text-center space-y-3 sm:space-y-4 py-6 sm:py-8">
                                <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-4 border-primary" />
                                <div>
                                    <h3 className="text-base sm:text-lg font-semibold">Processing your screenshots...</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                        Uploading and analyzing with AI.
                                    </p>
                                </div>
                                <Progress value={uploadProgress} className="h-2 max-w-xs sm:max-w-sm mx-auto" />
                                <p className="text-xs sm:text-sm font-medium">{uploadProgress}%</p>
                            </div>
                        ) : (
                            <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-lg p-5 sm:p-8 text-center cursor-pointer transition-colors ${isDragActive
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/25 hover:border-primary/50'
                                    } ${sessionInfo.remaining <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <input {...getInputProps()} />
                                <Camera className="h-8 w-8 sm:h-10 sm:w-10 mx-auto text-muted-foreground mb-2 sm:mb-3" />
                                {sessionInfo.remaining <= 0 ? (
                                    <div>
                                        <p className="font-medium text-destructive">Guest limit reached!</p>
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Sign in to upload unlimited screenshots.
                                        </p>
                                    </div>
                                ) : isDragActive ? (
                                    <p className="text-primary font-medium">Drop your screenshots here...</p>
                                ) : (
                                    <div>
                                        <p className="font-medium text-sm sm:text-base">Drag & drop screenshots here</p>
                                        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                            or click to browse • PNG, JPG, WebP up to 10MB
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm text-destructive">{error}</p>
                                </div>
                                <button onClick={() => setError(null)}>
                                    <X className="h-4 w-4 text-destructive/70" />
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Results */}
                {screenshots.length === 0 && !uploading && (
                    <div className="text-center py-16">
                        <Camera className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                        <h3 className="text-lg font-medium text-muted-foreground">No screenshots yet</h3>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                            Upload your first screenshot to see AI analysis in action!
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {screenshots.map(screenshot => (
                        <Card key={screenshot.id} className="overflow-hidden hover:shadow-md transition-shadow">
                            <CardContent className="pt-4">
                                <div className="space-y-3">
                                    {/* Title & Difficulty */}
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-semibold text-sm leading-tight">{screenshot.title}</h3>
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${screenshot.difficulty === 'Beginner'
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : screenshot.difficulty === 'Advanced'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}
                                        >
                                            {screenshot.difficulty}
                                        </span>
                                    </div>

                                    {/* Summary */}
                                    <p className="text-xs text-muted-foreground line-clamp-3">{screenshot.summary}</p>

                                    {/* Keywords */}
                                    {screenshot.keywords && screenshot.keywords.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {screenshot.keywords.slice(0, 5).map((kw, i) => (
                                                <span
                                                    key={i}
                                                    className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                                                >
                                                    {kw}
                                                </span>
                                            ))}
                                            {screenshot.keywords.length > 5 && (
                                                <span className="text-xs text-muted-foreground">
                                                    +{screenshot.keywords.length - 5} more
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Expandable Sections */}
                                    <div className="space-y-1 pt-1 border-t">
                                        {/* Concepts */}
                                        {screenshot.conceptExplanation && (
                                            <button
                                                className="flex items-center gap-2 w-full text-left text-xs font-medium py-1.5 hover:text-primary transition-colors"
                                                onClick={() => toggleSection(screenshot.id, 'concepts')}
                                            >
                                                <Brain className="h-3.5 w-3.5" />
                                                Concepts
                                                {expandedSections[screenshot.id] === 'concepts' ? (
                                                    <ChevronUp className="h-3.5 w-3.5 ml-auto" />
                                                ) : (
                                                    <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                                                )}
                                            </button>
                                        )}
                                        {expandedSections[screenshot.id] === 'concepts' && (
                                            <div className="text-xs text-muted-foreground pl-5 pb-2 whitespace-pre-wrap">
                                                {screenshot.conceptExplanation}
                                            </div>
                                        )}

                                        {/* Code */}
                                        {screenshot.codeExplanation && (
                                            <button
                                                className="flex items-center gap-2 w-full text-left text-xs font-medium py-1.5 hover:text-primary transition-colors"
                                                onClick={() => toggleSection(screenshot.id, 'code')}
                                            >
                                                <Code className="h-3.5 w-3.5" />
                                                Code Explanation
                                                {expandedSections[screenshot.id] === 'code' ? (
                                                    <ChevronUp className="h-3.5 w-3.5 ml-auto" />
                                                ) : (
                                                    <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                                                )}
                                            </button>
                                        )}
                                        {expandedSections[screenshot.id] === 'code' && (
                                            <div className="text-xs text-muted-foreground pl-5 pb-2 whitespace-pre-wrap font-mono bg-muted/50 rounded p-2">
                                                {screenshot.codeExplanation}
                                            </div>
                                        )}

                                        {/* Full Text */}
                                        {screenshot.fullText && (
                                            <button
                                                className="flex items-center gap-2 w-full text-left text-xs font-medium py-1.5 hover:text-primary transition-colors"
                                                onClick={() => toggleSection(screenshot.id, 'text')}
                                            >
                                                <FileText className="h-3.5 w-3.5" />
                                                Extracted Text
                                                {expandedSections[screenshot.id] === 'text' ? (
                                                    <ChevronUp className="h-3.5 w-3.5 ml-auto" />
                                                ) : (
                                                    <ChevronDown className="h-3.5 w-3.5 ml-auto" />
                                                )}
                                            </button>
                                        )}
                                        {expandedSections[screenshot.id] === 'text' && (
                                            <div className="text-xs text-muted-foreground pl-5 pb-2 whitespace-pre-wrap bg-muted/50 rounded p-2 max-h-48 overflow-y-auto">
                                                {screenshot.fullText}
                                            </div>
                                        )}
                                    </div>

                                    {/* Filename */}
                                    <p className="text-[10px] text-muted-foreground/50 truncate">{screenshot.filename}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Sign In CTA at Bottom */}
                {screenshots.length > 0 && (
                    <Card className="mt-6 sm:mt-8 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
                        <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
                            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                                <div className="flex-1 text-center sm:text-left">
                                    <h3 className="font-semibold text-sm sm:text-base">Like what you see?</h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                                        Sign in to save screenshots permanently and organize them in folders.
                                    </p>
                                </div>
                                <Button
                                    size="default"
                                    onClick={() => signIn('google', { callbackUrl: '/' })}
                                    className="gap-2 shrink-0 w-full sm:w-auto"
                                >
                                    <LogIn className="h-4 w-4" />
                                    Sign In with Google
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
