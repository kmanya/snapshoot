'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Camera, 
  Search, 
  FolderPlus, 
  Upload, 
  LogOut, 
  Download,
  Sparkles,
  Trash2,
  RefreshCw,
  Eye,
  Edit2,
  X,
  FolderOpen,
  BookOpen,
  Clock,
  ChevronRight,
  Code,
  FileText,
  Brain,
  GraduationCap,
  Grid3x3,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Menu
} from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import Image from 'next/image'

interface Screenshot {
  id: string
  title: string
  summary: string
  fileName: string
  path: string
  keywords: string[]
  concepts: string[]
  difficulty: string
  createdAt: string
  folder?: { name: string }
  fullText?: string
  conceptExplanation?: string
  codeExplanation?: string
  prerequisites?: string[]
  nextTopics?: string[]
}

interface Folder {
  id: string
  name: string
  description?: string
  _count?: { screenshots: number }
}

export default function Dashboard() {
  const { data: session } = useSession()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  // State
  const [activeTab, setActiveTab] = useState('upload')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState('newest')
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderDescription, setNewFolderDescription] = useState('')
  const [uploadProgress, setUploadProgress] = useState<{ jobId?: string; progress: number } | null>(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState<Screenshot | null>(null)
  const [showScreenshotDialog, setShowScreenshotDialog] = useState(false)
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: string | null }>({})
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [learningPathData, setLearningPathData] = useState<any>(null)
  const [generatingPath, setGeneratingPath] = useState(false)
  const [failedScreenshots, setFailedScreenshots] = useState<any[]>([])
  const [showFailedDialog, setShowFailedDialog] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  // Fetch folders
  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: async () => {
      const res = await axios.get('/api/folders')
      return res.data
    }
  })

  // Fetch screenshots
  const { data: screenshotsData, isLoading: loadingScreenshots } = useQuery({
    queryKey: ['screenshots', selectedFolder, searchQuery],
    queryFn: async () => {
      if (searchQuery) {
        const res = await axios.post('/api/search', {
          query: searchQuery,
          folder_id: selectedFolder
        })
        return res.data
      } else {
        const params = new URLSearchParams()
        if (selectedFolder) params.append('folder_id', selectedFolder)
        const res = await axios.get(`/api/screenshots?${params}`)
        return res.data
      }
    }
  })

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await axios.get('/api/stats')
      return res.data
    }
  })

  // Fetch AI status
  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: async () => {
      const res = await axios.get('/api/status')
      return res.data
    }
  })

  // Fetch learning paths
  const { data: learningPathsData } = useQuery({
    queryKey: ['learning-paths', selectedFolder],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedFolder) params.append('folder_id', selectedFolder)
      const res = await axios.get(`/api/learning-paths?${params}`)
      return res.data
    },
    enabled: activeTab === 'learning'
  })

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: async () => {
      const res = await axios.post('/api/folders', {
        name: newFolderName,
        description: newFolderDescription
      })
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      setShowNewFolderDialog(false)
      setNewFolderName('')
      setNewFolderDescription('')
      toast({
        title: 'Folder created',
        description: 'Your new folder has been created successfully.'
      })
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create folder. Please try again.',
        variant: 'destructive'
      })
    }
  })

  // Delete screenshot mutation
  const deleteScreenshotMutation = useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/screenshots/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setShowScreenshotDialog(false)
      toast({
        title: 'Screenshot deleted',
        description: 'The screenshot has been deleted successfully.'
      })
    }
  })

  // Reanalyze screenshot mutation
  const reanalyzeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await axios.post(`/api/screenshots/${id}/reanalyze`)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots'] })
      toast({ title: 'Reanalysis complete', description: 'Screenshot has been reanalyzed successfully.' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to reanalyze screenshot.', variant: 'destructive' })
    }
  })

  // Clear all data mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await axios.delete('/api/clear-all')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      setShowClearConfirm(false)
      toast({ title: 'Data cleared', description: 'All your data has been deleted.' })
    }
  })

  // Helper functions
  const toggleSection = (screenshotId: string, section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [screenshotId]: prev[screenshotId] === section ? null : section
    }))
  }

  const getSortedScreenshots = (screenshots: Screenshot[]) => {
    const sorted = [...screenshots]
    switch (sortOption) {
      case 'oldest':
        return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      case 'az':
        return sorted.sort((a, b) => a.title.localeCompare(b.title))
      case 'za':
        return sorted.sort((a, b) => b.title.localeCompare(a.title))
      default: // newest
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
  }

  const generateLearningPath = async () => {
    setGeneratingPath(true)
    try {
      const res = await axios.post('/api/learning-paths/generate', {
        folder_id: selectedFolder
      })
      setLearningPathData(res.data.learning_path)
      queryClient.invalidateQueries({ queryKey: ['learning-paths'] })
      toast({ title: 'Learning path generated', description: 'Your learning path has been created successfully.' })
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to generate learning path.',
        variant: 'destructive'
      })
    } finally {
      setGeneratingPath(false)
    }
  }

  // File upload handler
  // File upload handler
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    // Chunk files into batches of 5 to prevent timeouts
    const BATCH_SIZE = 5
    const chunks = []
    for (let i = 0; i < acceptedFiles.length; i += BATCH_SIZE) {
      chunks.push(acceptedFiles.slice(i, i + BATCH_SIZE))
    }

    const totalFiles = acceptedFiles.length
    const jobIds: string[] = []
    
    // Initial progress
    setUploadProgress({ progress: 1 })
    
    try {
      toast({
        title: 'Upload started',
        description: `Uploading ${totalFiles} files in ${chunks.length} batches...`
      })

      // Process chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const formData = new FormData()
        chunk.forEach(file => {
          formData.append('files', file)
        })
        if (selectedFolder) {
          formData.append('folder_id', selectedFolder)
        }

        try {
          // Upload batch
          const res = await axios.post('/api/screenshots/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })

          const { job_id } = res.data
          jobIds.push(job_id)
          
          // Update progress based on upload completion
          // Distribute 10% of total progress across uploads
          const uploadProgress = Math.min(10, Math.round(((i + 1) / chunks.length) * 10))
          setUploadProgress({ jobId: job_id, progress: uploadProgress })

        } catch (error) {
          console.error(`Error uploading batch ${i + 1}:`, error)
          toast({
            title: 'Batch upload failed',
            description: `Failed to upload batch ${i + 1} of ${chunks.length}. Continuing with others...`,
            variant: 'destructive'
          })
        }
      }

      if (jobIds.length === 0) {
        throw new Error('All uploads failed')
      }

      // Poll for all jobs
      pollMultipleJobs(jobIds, totalFiles)

    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: 'Failed to upload screenshots. Please try again.',
        variant: 'destructive'
      })
      setUploadProgress(null)
    }
  }, [selectedFolder, toast])

  const pollMultipleJobs = async (jobIds: string[], totalFiles: number) => {
    // We'll poll all jobs and aggregate progress
    const jobsStatus = new Map<string, { processed: number, status: string, errors: any[] }>()
    
    // Initialize status
    jobIds.forEach(id => {
      jobsStatus.set(id, { processed: 0, status: 'processing', errors: [] })
    })

    const interval = setInterval(async () => {
      let allCompleted = true
      let totalProcessedCount = 0
      let allErrors: any[] = []

      // Check each job
      for (const jobId of jobIds) {
        const currentStatus = jobsStatus.get(jobId)
        
        // Skip completed/failed jobs if we already have their final state
        if (currentStatus?.status === 'completed' || currentStatus?.status === 'failed') {
          totalProcessedCount += currentStatus.processed
          if (currentStatus.errors) allErrors = [...allErrors, ...currentStatus.errors]
          continue
        }

        try {
          const res = await axios.get(`/api/processing-status/${jobId}`)
          const { status, processed, errors } = res.data
          const parsedErrors = errors ? JSON.parse(errors) : []
          
          jobsStatus.set(jobId, { 
            processed, 
            status, 
            errors: parsedErrors 
          })

          totalProcessedCount += processed
          
          if (status !== 'completed' && status !== 'failed') {
            allCompleted = false
          }
        } catch (error) {
          // Assume transient error, don't mark as completed yet
          allCompleted = false
        }
      }
      
      // Calculate aggregate progress
      // We start at 10% (uploads done) and scale to 100%
      const processingProgress = Math.round((totalProcessedCount / totalFiles) * 90)
      setUploadProgress({ 
        jobId: jobIds[0], // Just use first ID as key
        progress: 10 + processingProgress 
      })

      if (allCompleted) {
        clearInterval(interval)
        setUploadProgress(null)
        
        // aggregate all errors
        allErrors = []
        jobsStatus.forEach(status => {
          allErrors = [...allErrors, ...status.errors]
        })

        queryClient.invalidateQueries({ queryKey: ['screenshots'] })
        queryClient.invalidateQueries({ queryKey: ['stats'] })

        if (allErrors.length > 0) {
          setFailedScreenshots(allErrors)
          setShowFailedDialog(true)
          
          toast({
            title: 'Partial success',
            description: `Processed ${totalProcessedCount} files. ${allErrors.length} failed.`,
            variant: 'destructive'
          })
        } else {
          toast({
            title: 'All done!',
            description: `Successfully processed all ${totalFiles} screenshots.`
          })
        }
      }
    }, 2000)
  }

  // Simplified poll function for retry/single uploads
  const pollProcessingStatus = async (jobId: string) => {
    pollMultipleJobs([jobId], 1) // Treat as single job batch (assumes totalFiles unknown or 1, but processed count will give progress)
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
    }
  })

  const folders = foldersData?.folders || []
  const screenshots = searchQuery 
    ? screenshotsData?.results || []
    : screenshotsData?.screenshots || []

  // Retry failed screenshots
  const retryFailedScreenshots = async () => {
    setRetrying(true)
    try {
      const res = await axios.post('/api/screenshots/retry', {
        failedFiles: failedScreenshots,
        folder_id: selectedFolder
      })

      const { job_id } = res.data
      
      toast({
        title: 'Retry started',
        description: `Retrying ${failedScreenshots.length} screenshot(s)...`
      })

      setShowFailedDialog(false)
      setUploadProgress({ jobId: job_id, progress: 10 })
      
      // Poll for retry status
      pollProcessingStatus(job_id)
    } catch (error) {
      toast({
        title: 'Retry failed',
        description: 'Failed to retry screenshots. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Processing Overlay - Prevent navigation during upload */}
      {uploadProgress && uploadProgress.progress < 100 && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-primary"></div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Processing Your Screenshots</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please don't close this window, you can navigate away
                    Reload Page as soon as any % appears
                  </p>
                </div>
                <div className="space-y-2">
                  <Progress value={uploadProgress.progress} className="h-3" />
                  <p className="text-lg font-medium">{uploadProgress.progress}% Complete</p>
                  <p className="text-xs text-muted-foreground">
                    Uploading to Google Drive and analyzing with AI...
                  </p>
                </div>
                {uploadProgress.progress > 10 && (
                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground">
                      ⏱️ This may take a few minutes depending on the number of screenshots
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Failed Screenshots Dialog */}
      {showFailedDialog && failedScreenshots.length > 0 && (
        <Dialog open={showFailedDialog} onOpenChange={setShowFailedDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                {failedScreenshots.length} Broken Screenshot{failedScreenshots.length > 1 ? 's' : ''}
              </DialogTitle>
              <DialogDescription>
                These screenshots failed after 3 processing attempts. You can retry them or dismiss.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              {failedScreenshots.map((failed, index) => (
                <Card key={index} className="border-destructive/50">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm mb-1">{failed.fileName}</h4>
                        <div className="text-xs space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              failed.errorType === 'JSON_PARSE_ERROR' ? 'bg-orange-100 text-orange-700' :
                              failed.errorType === 'RATE_LIMIT' ? 'bg-yellow-100 text-yellow-700' :
                              failed.errorType === 'TIMEOUT' ? 'bg-blue-100 text-blue-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {failed.errorType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-muted-foreground">
                              {new Date(failed.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-muted-foreground mt-2">
                            {failed.error}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFailedDialog(false)
                  setFailedScreenshots([])
                }}
                className="w-full sm:w-auto"
              >
                Dismiss
              </Button>
              <Button
                onClick={retryFailedScreenshots}
                disabled={retrying}
                className="w-full sm:w-auto"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Retrying...' : `Retry ${failedScreenshots.length} Screenshot${failedScreenshots.length > 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Header */}
      <header className="border-b">
        <div className="flex h-16 items-center justify-between px-4 md:px-8">
          <h1 className="text-2xl font-bold">📸 Snapshoty</h1>
          
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            <Button
              variant="ghost" 
              size="icon"
              className="md:hidden"
              onClick={() => setShowMobileMenu(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>

            <div className="hidden md:flex items-center space-x-2">
              {session?.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <span className="text-sm font-medium">{session?.user?.name}</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              className="hidden md:flex"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Mobile Menu Dialog */}
      <Dialog open={showMobileMenu} onOpenChange={setShowMobileMenu}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Menu</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Button 
              variant={activeTab === 'upload' ? "default" : "outline"} 
              className="w-full justify-start text-lg h-12"
              onClick={() => { setActiveTab('upload'); setShowMobileMenu(false); }}
            >
              <Upload className="mr-2 h-5 w-5" /> Upload
            </Button>
            <Button 
              variant={activeTab === 'search' ? "default" : "outline"}
              className="w-full justify-start text-lg h-12"
              onClick={() => { setActiveTab('search'); setShowMobileMenu(false); }}
            >
              <Search className="mr-2 h-5 w-5" /> Search
            </Button>
            <Button 
              variant={activeTab === 'dashboard' ? "default" : "outline"}
              className="w-full justify-start text-lg h-12"
              onClick={() => { setActiveTab('dashboard'); setShowMobileMenu(false); }}
            >
              <Grid3x3 className="mr-2 h-5 w-5" /> Dashboard
            </Button>
            <Button 
              variant={activeTab === 'learning' ? "default" : "outline"}
              className="w-full justify-start text-lg h-12"
              onClick={() => { setActiveTab('learning'); setShowMobileMenu(false); }}
            >
              <GraduationCap className="mr-2 h-5 w-5" /> Learning Path
            </Button>
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center gap-2 mb-4">
                {session?.user?.image && (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                )}
                <span className="font-medium">{session?.user?.name}</span>
              </div>
              <Button 
                variant="destructive" 
                className="w-full justify-start"
                onClick={() => signOut()}
              >
                <LogOut className="mr-2 h-4 w-4" /> Sign Out
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Sidebar */}
          <div className="col-span-12 md:col-span-3 space-y-4">
            {/* Stats Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Screenshots</span>
                  <span className="font-medium">{statsData?.total_screenshots || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Folders</span>
                  <span className="font-medium">{statsData?.total_folders || 0}</span>
                </div>
              </CardContent>
            </Card>

            {/* Folders */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Folders</CardTitle>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => setShowNewFolderDialog(true)}
                  >
                    <FolderPlus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <Button
                  variant={selectedFolder === null ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  size="sm"
                  onClick={() => setSelectedFolder(null)}
                >
                  <FolderOpen className="h-4 w-4 mr-2" />
                  All Screenshots
                </Button>
                {folders.map((folder: Folder) => (
                  <Button
                    key={folder.id}
                    variant={selectedFolder === folder.id ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => setSelectedFolder(folder.id)}
                  >
                    <FolderOpen className="h-4 w-4 mr-2" />
                    {folder.name}
                    {folder._count && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {folder._count.screenshots}
                      </span>
                    )}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* AI Model Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">🤖 AI Model</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className={`p-2 rounded text-xs ${
                  aiStatus?.qwen_api 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  <div className="font-bold">
                    {aiStatus?.qwen_api ? '✅ Qwen API' : '❌ No Qwen'}
                  </div>
                  {aiStatus?.qwen_api && (
                    <div className="text-xs mt-1">
                      🌐 Cloud processing<br />
                      ⏱️ ~5-10 sec per image
                    </div>
                  )}
                </div>
                <div className={`p-2 rounded text-xs ${
                  aiStatus?.gemini 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  <div className="font-bold">
                    {aiStatus?.gemini ? '🎓 Gemini API' : '⚠️ Gemini unavailable'}
                  </div>
                  {aiStatus?.gemini && <div className="text-xs mt-1">Learning Path generation</div>}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="col-span-12 md:col-span-9">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="hidden md:grid w-full grid-cols-4 h-auto">
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Upload & Process
                </TabsTrigger>
                <TabsTrigger value="search">
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </TabsTrigger>
                <TabsTrigger value="dashboard">
                  <Grid3x3 className="h-4 w-4 mr-2" />
                  Notes Dashboard
                </TabsTrigger>
                <TabsTrigger value="learning">
                  <GraduationCap className="h-4 w-4 mr-2" />
                  Learning Path
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab Content - keeping existing upload area */}
              <TabsContent value="upload" className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Upload Screenshots</h2>
                  <p className="text-muted-foreground">Upload any screenshots - code, documentation, notes, diagrams. AI will analyze and extract information.</p>
                </div>

            {/* Upload Area */}
            {uploadProgress ? (
              <Card>
                <CardContent className="py-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Processing screenshots...</p>
                    <Progress value={uploadProgress.progress} />
                    <p className="text-xs text-muted-foreground">
                      {uploadProgress.progress}% complete
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card 
                {...getRootProps()} 
                className={`border-2 border-dashed cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <CardContent className="py-8 text-center">
                  <input {...getInputProps()} />
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium">
                    {isDragActive ? 'Drop screenshots here' : 'Drag & drop screenshots here'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    or click to select files
                  </p>
                </CardContent>
              </Card>
            )}

                {/* Recent Uploads in Upload Tab */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">📚 Recent Uploads</h3>
                  {loadingScreenshots ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : screenshots.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center">
                        <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-sm text-muted-foreground">No screenshots yet. Upload some to get started!</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {screenshots.slice(0, 6).map((screenshot: Screenshot) => (
                        <Card key={screenshot.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                          setSelectedScreenshot(screenshot)
                          setShowScreenshotDialog(true)
                        }}>
                          <div className="flex">
                            <div className="relative w-32 h-32 flex-shrink-0 bg-muted">
                              <Image src={`/api/screenshots/${screenshot.id}/image`} alt={screenshot.title} fill className="object-cover" unoptimized />
                            </div>
                            <CardContent className="flex-1 p-3">
                              <h4 className="font-medium text-sm line-clamp-1 mb-1">{screenshot.title}</h4>
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{screenshot.summary}</p>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{new Date(screenshot.createdAt).toLocaleDateString()}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  screenshot.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' :
                                  screenshot.difficulty === 'Advanced' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>{screenshot.difficulty}</span>
                              </div>
                            </CardContent>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Search Tab */}
              <TabsContent value="search" className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold mb-2">🔍 Search Your Notes</h2>
                  <p className="text-muted-foreground">Search through all your screenshots by keywords, topics, or content.</p>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Enter keywords, topics, or concepts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                  </div>
                  <Button onClick={() => setSearchQuery('')} variant="secondary">Show All</Button>
                </div>
                {searchQuery && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">Found {screenshots.length} result{screenshots.length !== 1 ? 's' : ''} for "{searchQuery}"</p>
                  </div>
                )}
                {loadingScreenshots ? (
                  <div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
                ) : screenshots.length === 0 ? (
                  <Card><CardContent className="py-12 text-center"><Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-sm text-muted-foreground">{searchQuery ? 'No results found.' : 'No screenshots yet.'}</p></CardContent></Card>
                ) : (
                  <div className="space-y-3">
                    {screenshots.map((s: Screenshot) => (
                      <Card key={s.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedScreenshot(s); setShowScreenshotDialog(true); }}>
                        <div className="flex"><div className="relative w-40 h-32 flex-shrink-0 bg-muted"><Image src={`/api/screenshots/${s.id}/image`} alt={s.title} fill className="object-cover" unoptimized /></div>
                        <CardContent className="flex-1 p-4"><div className="flex justify-between mb-2"><h3 className="font-semibold">{s.title}</h3><span className={`px-2 py-1 rounded text-xs ${s.difficulty === 'Beginner' ? 'bg-green-100 text-green-700' : s.difficulty === 'Advanced' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{s.difficulty}</span></div><p className="text-sm text-muted-foreground line-clamp-2">{s.summary}</p></CardContent></div>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Notes Dashboard Tab */}
              <TabsContent value="dashboard" className="space-y-4">
                <div><h2 className="text-2xl font-bold mb-2">🧠 Notes Dashboard</h2><p className="text-muted-foreground">View, manage, and export all your processed screenshots.</p></div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['screenshots'] })}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
                  <Button variant="outline" onClick={() => { const params = new URLSearchParams(); if (selectedFolder) params.append('folder_id', selectedFolder); window.open(`/api/export/markdown?${params}`, '_blank'); }}><Download className="h-4 w-4 mr-2" />Export</Button>
                  <Button variant="destructive" onClick={() => setShowClearConfirm(true)}><Trash2 className="h-4 w-4 mr-2" />Clear All</Button>
                </div>
                {showClearConfirm && (
                  <Card className="border-destructive"><CardContent className="pt-6"><h3 className="font-semibold text-lg mb-2">⚠️ Delete all data?</h3><p className="text-sm text-muted-foreground mb-4">This cannot be undone!</p><div className="flex gap-2"><Button variant="destructive" onClick={() => clearAllMutation.mutate()}>✅ Yes, Delete All</Button><Button variant="outline" onClick={() => setShowClearConfirm(false)}>❌ Cancel</Button></div></CardContent></Card>
                )}
                <div className="flex items-center gap-2"><span className="text-sm font-medium">Sort:</span><Select value={sortOption} onValueChange={setSortOption}><SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="newest">Newest First</SelectItem><SelectItem value="oldest">Oldest First</SelectItem><SelectItem value="az">Title A-Z</SelectItem><SelectItem value="za">Title Z-A</SelectItem></SelectContent></Select></div>
                {loadingScreenshots ? (<div className="text-center py-12"><div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>) : screenshots.length === 0 ? (<Card><CardContent className="py-12 text-center"><Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-sm text-muted-foreground">No screenshots yet.</p></CardContent></Card>) : (<div className="space-y-4">{screenshots.map((s: Screenshot) => (<Card key={s.id} className="overflow-hidden"><div className="flex flex-col md:flex-row"><div className="relative w-full md:w-48 h-48 flex-shrink-0 bg-muted"><Image src={`/api/screenshots/${s.id}/image`} alt={s.title} fill className="object-cover" unoptimized /></div><CardContent className="flex-1 p-4"><div className="flex justify-between mb-2"><h3 className="font-semibold text-lg">{s.title}</h3><span className={`px-2 py-1 rounded text-xs border ${s.difficulty === 'Beginner' ? 'bg-green-100 text-green-700 border-green-300' : s.difficulty === 'Advanced' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>{s.difficulty}</span></div><div className="text-xs text-muted-foreground mb-2"><Clock className="h-3 w-3 inline mr-1" />{new Date(s.createdAt).toLocaleString()} • 📁 {s.fileName}</div><p className="text-sm text-muted-foreground mb-3">{s.summary}</p>{s.concepts && s.concepts.length > 0 && (<div className="mb-3"><span className="text-xs font-medium">Concepts: </span><div className="flex flex-wrap gap-1 mt-1">{s.concepts.slice(0,5).map((c, i) => (<span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">🎯 {c}</span>))}</div></div>)}{s.keywords && s.keywords.length > 0 && (<div className="mb-3"><span className="text-xs font-medium">Keywords: </span><div className="flex flex-wrap gap-1 mt-1">{s.keywords.slice(0,5).map((k, i) => (<span key={i} className="px-2 py-0.5 bg-secondary text-xs rounded">{k}</span>))}</div></div>)}<div className="flex flex-wrap gap-2 mt-4"><Button size="sm" variant="outline" onClick={() => toggleSection(s.id, 'concepts')}><Brain className="h-4 w-4 mr-1" />Concepts {expandedSections[s.id] === 'concepts' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}</Button><Button size="sm" variant="outline" onClick={() => toggleSection(s.id, 'code')}><Code className="h-4 w-4 mr-1" />Code {expandedSections[s.id] === 'code' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}</Button><Button size="sm" variant="outline" onClick={() => toggleSection(s.id, 'fulltext')}><FileText className="h-4 w-4 mr-1" />Full Text {expandedSections[s.id] === 'fulltext' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}</Button><Button size="sm" variant="outline" onClick={() => reanalyzeMutation.mutate(s.id)} disabled={reanalyzeMutation.isPending}><RefreshCw className={`h-4 w-4 mr-1 ${reanalyzeMutation.isPending ? 'animate-spin' : ''}`} />Reanalyze</Button><Button size="sm" variant="destructive" onClick={() => deleteScreenshotMutation.mutate(s.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button></div>{expandedSections[s.id] === 'concepts' && s.conceptExplanation && (<div className="mt-4 p-4 bg-muted rounded-lg"><h4 className="font-semibold mb-2 flex items-center"><Brain className="h-4 w-4 mr-2" />Concept Explanation</h4><p className="text-sm mb-3">{s.conceptExplanation}</p>{s.prerequisites && s.prerequisites.length > 0 && (<div className="mb-3"><h5 className="font-medium text-sm mb-1">📚 Prerequisites:</h5><ul className="list-disc list-inside text-sm space-y-1">{s.prerequisites.map((p, i) => (<li key={i}>{p}</li>))}</ul></div>)}{s.nextTopics && s.nextTopics.length > 0 && (<div><h5 className="font-medium text-sm mb-1">➡️ What to Learn Next:</h5><ul className="list-disc list-inside text-sm space-y-1">{s.nextTopics.map((t, i) => (<li key={i}>{t}</li>))}</ul></div>)}</div>)}{expandedSections[s.id] === 'code' && s.codeExplanation && (<div className="mt-4 p-4 bg-muted rounded-lg"><h4 className="font-semibold mb-2 flex items-center"><Code className="h-4 w-4 mr-2" />Code Explanation</h4><p className="text-sm whitespace-pre-wrap">{s.codeExplanation}</p></div>)}{expandedSections[s.id] === 'fulltext' && s.fullText && (<div className="mt-4 p-4 bg-muted rounded-lg"><h4 className="font-semibold mb-2 flex items-center"><FileText className="h-4 w-4 mr-2" />Extracted Text</h4><pre className="text-sm whitespace-pre-wrap font-mono">{s.fullText}</pre></div>)}</CardContent></div></Card>))}</div>)}
              </TabsContent>

              {/* Learning Path Tab */}
              <TabsContent value="learning" className="space-y-4">
                <div><h2 className="text-2xl font-bold mb-2">🎓 AI-Powered Learning Path</h2><p className="text-muted-foreground mb-2"><strong>For code screenshots:</strong> Let Gemini AI analyze your code screenshots and create an optimal learning sequence!</p><p className="text-sm text-blue-600">💡 This feature works best with programming/code screenshots. For other content types, use folders and search instead.</p></div>
                
                {!aiStatus?.gemini ? (
                  <Card className="border-yellow-300 bg-yellow-50"><CardContent className="pt-6"><div className="flex items-start gap-3"><AlertCircle className="h-5 w-5 text-yellow-600" /><div><h3 className="font-semibold text-yellow-900 mb-1">Gemini API Not Available</h3><p className="text-sm text-yellow-700">Learning path generation requires Gemini API. Please configure your GEMINI_API_KEY in the .env file.</p></div></div></CardContent></Card>
                ) : screenshots.length < 3 ? (
                  <Card className="border-blue-300 bg-blue-50"><CardContent className="pt-6"><div className="flex items-start gap-3"><AlertCircle className="h-5 w-5 text-blue-600" /><div><h3 className="font-semibold text-blue-900 mb-1">Need More Screenshots</h3><p className="text-sm text-blue-700">You need at least 3 screenshots to generate a learning path. You currently have {screenshots.length}.</p></div></div></CardContent></Card>
                ) : (
                  <div><Button onClick={generateLearningPath} disabled={generatingPath} size="lg" className="w-full md:w-auto"><Sparkles className="h-4 w-4 mr-2" />{generatingPath ? 'Generating Learning Path with Gemini...' : 'Generate Learning Path with Gemini'}</Button></div>
                )}

                {learningPathData && (
                  <Card className="border-2 border-primary" data-learning-path-display>
                    <CardContent className="pt-6">
                      <div className="mb-6">
                        <h3 className="text-2xl font-bold mb-2">{learningPathData.title}</h3>
                        <p className="text-muted-foreground mb-3">{learningPathData.description}</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><span><strong>Total Time:</strong> {learningPathData.total_time}</span></div>
                          <div className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /><span><strong>Difficulty:</strong> {learningPathData.difficulty_progression}</span></div>
                        </div>
                      </div>

                      <div className="space-y-4 mb-6">
                        <h4 className="text-lg font-semibold">📚 Learning Modules</h4>
                        {learningPathData.modules?.map((module: any, idx: number) => {
                          // Get screenshots for this module
                          const moduleScreenshots = screenshots.filter((s: Screenshot) => 
                            module.screenshots?.includes(s.id)
                          )
                          
                          return (
                            <Card key={idx} className="border-l-4 border-l-primary">
                              <CardContent className="pt-4">
                                <div className="flex items-start justify-between mb-2">
                                  <h5 className="font-semibold text-lg">Module {module.order}: {module.title}</h5>
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">⏱️ {module.estimated_time}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">{module.description}</p>
                                
                                {module.learning_outcomes && module.learning_outcomes.length > 0 && (
                                  <div className="mb-3">
                                    <h6 className="text-sm font-medium mb-1">🎯 Learning Outcomes:</h6>
                                    <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                                      {module.learning_outcomes.map((outcome: string, i: number) => (<li key={i}>{outcome}</li>))}
                                    </ul>
                                  </div>
                                )}

                                {moduleScreenshots.length > 0 && (
                                  <div className="mt-4">
                                    <h6 className="text-sm font-medium mb-2">📚 Screenshots in this module:</h6>
                                    <div className="space-y-2">
                                      {moduleScreenshots.map((screenshot: Screenshot) => (
                                        <Card key={screenshot.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => { setSelectedScreenshot(screenshot); setShowScreenshotDialog(true); }}>
                                          <div className="flex flex-col md:flex-row">
                                            <div className="relative w-full md:w-48 h-48 flex-shrink-0 bg-muted">
                                              <Image src={`/api/screenshots/${screenshot.id}/image`} alt={screenshot.title} fill className="object-cover" unoptimized />
                                            </div>

                                            <CardContent className="flex-1 p-4">
                                              <div className="flex justify-between mb-2">
                                                <h3 className="font-semibold text-lg">{screenshot.title}</h3>
                                                <span className={`px-2 py-1 rounded text-xs border ${screenshot.difficulty === 'Beginner' ? 'bg-green-100 text-green-700 border-green-300' : screenshot.difficulty === 'Advanced' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>{screenshot.difficulty}</span>
                                              </div>

                                              <div className="text-xs text-muted-foreground mb-2"><Clock className="h-3 w-3 inline mr-1" />{new Date(screenshot.createdAt).toLocaleString()} • 📁 {screenshot.fileName}</div>

                                              <p className="text-sm text-muted-foreground mb-3">{screenshot.summary}</p>

                                              {screenshot.concepts && screenshot.concepts.length > 0 && (
                                                <div className="mb-3">
                                                  <span className="text-xs font-medium">Concepts: </span>
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                    {screenshot.concepts.slice(0,5).map((c, i) => (<span key={i} className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded">🎯 {c}</span>))}
                                                  </div>
                                                </div>
                                              )}

                                              {screenshot.keywords && screenshot.keywords.length > 0 && (
                                                <div className="mb-3">
                                                  <span className="text-xs font-medium">Keywords: </span>
                                                  <div className="flex flex-wrap gap-1 mt-1">
                                                    {screenshot.keywords.slice(0,5).map((k, i) => (<span key={i} className="px-2 py-0.5 bg-secondary text-xs rounded">{k}</span>))}
                                                  </div>
                                                </div>
                                              )}

                                              <div className="flex flex-wrap gap-2 mt-4">
                                                <Button size="sm" variant="outline" onClick={() => toggleSection(screenshot.id, 'concepts')}><Brain className="h-4 w-4 mr-1" />Concepts {expandedSections[screenshot.id] === 'concepts' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}</Button>
                                                <Button size="sm" variant="outline" onClick={() => toggleSection(screenshot.id, 'code')}><Code className="h-4 w-4 mr-1" />Code {expandedSections[screenshot.id] === 'code' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}</Button>
                                                <Button size="sm" variant="outline" onClick={() => toggleSection(screenshot.id, 'fulltext')}><FileText className="h-4 w-4 mr-1" />Full Text {expandedSections[screenshot.id] === 'fulltext' ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}</Button>
                                                <Button size="sm" variant="outline" onClick={() => reanalyzeMutation.mutate(screenshot.id)} disabled={reanalyzeMutation.isPending}><RefreshCw className={`h-4 w-4 mr-1 ${reanalyzeMutation.isPending ? 'animate-spin' : ''}`} />Reanalyze</Button>
                                                <Button size="sm" variant="destructive" onClick={() => deleteScreenshotMutation.mutate(screenshot.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                                              </div>

                                              {expandedSections[screenshot.id] === 'concepts' && screenshot.conceptExplanation && (
                                                <div className="mt-4 p-4 bg-muted rounded-lg">
                                                  <h4 className="font-semibold mb-2 flex items-center"><Brain className="h-4 w-4 mr-2" />Concept Explanation</h4>
                                                  <p className="text-sm mb-3">{screenshot.conceptExplanation}</p>
                                                  {screenshot.prerequisites && screenshot.prerequisites.length > 0 && (
                                                    <div className="mb-3"><h5 className="font-medium text-sm mb-1">📚 Prerequisites:</h5><ul className="list-disc list-inside text-sm space-y-1">{screenshot.prerequisites.map((p, i) => (<li key={i}>{p}</li>))}</ul></div>
                                                  )}
                                                  {screenshot.nextTopics && screenshot.nextTopics.length > 0 && (
                                                    <div><h5 className="font-medium text-sm mb-1">➡️ What to Learn Next:</h5><ul className="list-disc list-inside text-sm space-y-1">{screenshot.nextTopics.map((t, i) => (<li key={i}>{t}</li>))}</ul></div>
                                                  )}
                                                </div>
                                              )}

                                              {expandedSections[screenshot.id] === 'code' && screenshot.codeExplanation && (
                                                <div className="mt-4 p-4 bg-muted rounded-lg"><h4 className="font-semibold mb-2 flex items-center"><Code className="h-4 w-4 mr-2" />Code Explanation</h4><p className="text-sm whitespace-pre-wrap">{screenshot.codeExplanation}</p></div>
                                              )}

                                              {expandedSections[screenshot.id] === 'fulltext' && screenshot.fullText && (
                                                <div className="mt-4 p-4 bg-muted rounded-lg"><h4 className="font-semibold mb-2 flex items-center"><FileText className="h-4 w-4 mr-2" />Extracted Text</h4><pre className="text-sm whitespace-pre-wrap font-mono">{screenshot.fullText}</pre></div>
                                              )}
                                            </CardContent>
                                          </div>
                                        </Card>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>

                      {learningPathData.learning_objectives && learningPathData.learning_objectives.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold mb-2">🎯 Overall Learning Objectives</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {learningPathData.learning_objectives.map((obj: string, i: number) => (<li key={i}>{obj}</li>))}
                          </ul>
                        </div>
                      )}

                      {learningPathData.prerequisites && learningPathData.prerequisites.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold mb-2">📚 Prerequisites</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {learningPathData.prerequisites.map((prereq: string, i: number) => (<li key={i}>{prereq}</li>))}
                          </ul>
                        </div>
                      )}

                      {learningPathData.completion_criteria && learningPathData.completion_criteria.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-lg font-semibold mb-2">✅ Completion Criteria</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            {learningPathData.completion_criteria.map((criteria: string, i: number) => (<li key={i}>{criteria}</li>))}
                          </ul>
                        </div>
                      )}

                      {learningPathData.missing_topics && learningPathData.missing_topics.length > 0 && (
                        <div className="mb-4">
                          <Card className="border-yellow-300 bg-yellow-50">
                            <CardContent className="pt-4">
                              <h4 className="text-lg font-semibold mb-2 text-yellow-900">⚠️ Missing Topics</h4>
                              <p className="text-sm text-yellow-700 mb-2">These important topics are not covered in your current screenshots:</p>
                              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                                {learningPathData.missing_topics.map((topic: string, i: number) => (<li key={i}>{topic}</li>))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>
                      )}

                      {learningPathData.study_tips && learningPathData.study_tips.length > 0 && (
                        <div>
                          <Card className="border-green-300 bg-green-50">
                            <CardContent className="pt-4">
                              <h4 className="text-lg font-semibold mb-2 text-green-900">💡 Study Tips</h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-green-800">
                                {learningPathData.study_tips.map((tip: string, i: number) => (<li key={i}>{tip}</li>))}
                              </ul>
                            </CardContent>
                          </Card>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <hr className="my-6" />

                <div>
                  <h3 className="text-lg font-semibold mb-3">📚 Saved Learning Paths</h3>
                  {learningPathsData?.paths && learningPathsData.paths.length > 0 ? (
                    <div className="space-y-3">
                      {learningPathsData.paths.map((path: any) => {
                        const pathData = typeof path.pathData === 'string' ? JSON.parse(path.pathData) : path.pathData
                        const moduleCount = pathData?.modules?.length || 0
                        const screenshotCount = pathData?.modules?.reduce((sum: number, m: any) => sum + (m.screenshots?.length || 0), 0) || 0
                        
                        return (
                          <Card key={path.id} className="border-2">
                            <CardContent className="pt-4">
                              <div className="mb-3">
                                <h4 className="font-semibold mb-1">📖 {path.name}</h4>
                                <p className="text-xs text-muted-foreground mb-2">
                                  Created: {new Date(path.createdAt).toLocaleDateString()} • 📊 {moduleCount} modules • 📸 {screenshotCount} screenshots
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => {
                                    setLearningPathData(pathData)
                                    // Scroll to top of learning path display
                                    const element = document.querySelector('[data-learning-path-display]')
                                    if (element) {
                                      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                    }
                                    toast({ title: 'Learning path loaded', description: 'Scroll up to view the full path' })
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View This Path
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={async () => {
                                    if (!confirm('Delete this learning path?')) return
                                    try {
                                      await axios.delete(`/api/learning-paths/${path.id}`)
                                      queryClient.invalidateQueries({ queryKey: ['learning-paths'] })
                                      // Clear displayed path if it was the one being viewed
                                      if (learningPathData === pathData) {
                                        setLearningPathData(null)
                                      }
                                      toast({ title: 'Learning path deleted' })
                                    } catch (error) {
                                      toast({ title: 'Error', description: 'Failed to delete learning path', variant: 'destructive' })
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </Button>
                              </div>
                              {pathData?.learning_path_summary && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                  <p className="text-sm"><strong>Summary:</strong> {pathData.learning_path_summary}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  ) : (
                    <Card><CardContent className="py-8 text-center"><BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-sm text-muted-foreground">No saved learning paths yet. Generate one to get started!</p></CardContent></Card>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolderDialog} onOpenChange={setShowNewFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              Organize your screenshots into folders for better management
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Input
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Enter description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => createFolderMutation.mutate()}>
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Screenshot Detail Dialog */}
      <Dialog open={showScreenshotDialog} onOpenChange={setShowScreenshotDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedScreenshot && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedScreenshot.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {selectedScreenshot.id && (
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={`/api/screenshots/${selectedScreenshot.id}/image`}
                      alt={selectedScreenshot.title}
                      className="w-full h-full object-contain"
                    />
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-medium mb-2">Summary</h4>
                  <p className="text-sm text-muted-foreground">{selectedScreenshot.summary}</p>
                </div>
                {selectedScreenshot.keywords.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedScreenshot.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-secondary rounded-md text-xs"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {selectedScreenshot.concepts.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Concepts</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedScreenshot.concepts.map((concept, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-primary/10 rounded-md text-xs"
                        >
                          {concept}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex justify-between pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteScreenshotMutation.mutate(selectedScreenshot.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
