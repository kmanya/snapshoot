# Quick Production Fixes Implementation Guide

This guide provides **copy-paste ready code** for the 3 most critical fixes needed before production deployment.

---

## Fix 1: Switch SQLite → PostgreSQL (Neon/Supabase)

### Step 1: Choose a Provider
- **Neon** (recommended): https://neon.tech - Free tier with 0.5GB storage
- **Supabase**: https://supabase.com - Free tier with 500MB storage
- **Railway**: https://railway.app - $5/month

### Step 2: Update Environment Variables
```env
# .env
# Replace your existing DATABASE_URL with PostgreSQL connection string
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"
```

### Step 3: Update Prisma Schema
```prisma
// prisma/schema.prisma - Change line 8
datasource db {
  provider = "postgresql"  // Changed from "sqlite"
  url      = env("DATABASE_URL")
}
```

### Step 4: Migrate Database
```bash
# Install PostgreSQL client (if needed)
npm install @prisma/client

# Generate new Prisma client
npx prisma generate

# Push schema to PostgreSQL
npx prisma db push

# Optional: View database in browser
npx prisma studio
```

**Time to implement**: 15 minutes  
**Impact**: ✅ Enables proper concurrent access, eliminates database locks

---

## Fix 2: Move File Storage → Vercel Blob Storage

### Step 1: Install Vercel Blob
```bash
npm install @vercel/blob
```

### Step 2: Get Blob Token
1. Go to: https://vercel.com/dashboard
2. Select your project → Settings → Storage → Connect Store
3. Create a Blob Store
4. Copy the token

### Step 3: Add Environment Variable
```env
# .env
BLOB_READ_WRITE_TOKEN="vercel_blob_rw_xxxxxxxxxxxxxx"
```

### Step 4: Update Upload Route
Replace the file upload section in `src/app/api/screenshots/upload/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { processScreenshotWithQwenAPI } from '@/lib/ai/qwen-api'
import { v4 as uuidv4 } from 'uuid'
import { put } from '@vercel/blob' // ADD THIS

// REMOVE THESE LINES:
// import path from 'path'
// import fs from 'fs/promises'
// const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
// async function ensureUploadDir() { ... }

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.QWEN_API_KEY) {
      return NextResponse.json(
        { error: 'No AI processing available. Configure Qwen API key.' },
        { status: 503 }
      )
    }

    // REMOVE: await ensureUploadDir()

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const folderId = formData.get('folder_id') as string | null

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const jobId = uuidv4()
    const job = await prisma.processingJob.create({
      data: {
        id: jobId,
        userId: session.user.id,
        status: 'uploaded',
        total: files.length,
        processed: 0,
        failed: 0,
        estimatedTime: `${files.length * 7} seconds`,
        results: JSON.stringify([]),
        errors: JSON.stringify([])
      }
    })

    // UPDATED: Upload files to Vercel Blob
    const fileData: Array<{
      entryId: string
      filename: string
      url: string // Changed from 'path'
    }> = []
    const uploadErrors: Array<{ file: string; error: string }> = []

    for (const file of files) {
      try {
        if (!file.type.startsWith('image/')) {
          uploadErrors.push({ file: file.name, error: 'Invalid file type' })
          continue
        }

        if (file.size > MAX_FILE_SIZE) {
          uploadErrors.push({ file: file.name, error: 'File too large (max 10MB)' })
          continue
        }

        // UPDATED: Upload to Vercel Blob instead of file system
        const fileId = uuidv4()
        const blob = await put(`${fileId}-${file.name}`, file, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        })

        fileData.push({
          entryId: uuidv4(),
          filename: file.name,
          url: blob.url // Changed from 'path'
        })
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error)
        uploadErrors.push({ file: file.name, error: 'Upload failed' })
      }
    }

    if (fileData.length === 0) {
      return NextResponse.json(
        { error: 'No valid files uploaded' },
        { status: 400 }
      )
    }

    // Start background processing
    processScreenshotsInBackground(
      jobId,
      fileData,
      session.user.id,
      folderId
    ).catch(console.error)

    return NextResponse.json({
      job_id: jobId,
      total: files.length,
      uploaded: fileData.length,
      upload_errors: uploadErrors,
      estimated_time: `${fileData.length * 7} seconds`,
      message: `Files uploaded successfully! Processing will take approximately ${fileData.length * 7} seconds.`
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}

// UPDATED: Process screenshots from Blob URLs
async function processScreenshotsInBackground(
  jobId: string,
  fileData: Array<{ entryId: string; filename: string; url: string }>, // Changed 'path' to 'url'
  userId: string,
  folderId: string | null
) {
  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      status: 'processing',
      startedAt: new Date()
    }
  })

  let processed = 0
  const results: any[] = []
  const errors: any[] = []

  for (const file of fileData) {
    try {
      console.log(`Processing ${file.filename}...`)
      
      // UPDATED: Pass URL instead of file path
      const aiResult = await processScreenshotWithQwenAPI(file.url) // Changed from file.path
      
      const screenshot = await prisma.screenshot.create({
        data: {
          id: file.entryId,
          userId,
          folderId,
          fileName: file.filename,
          title: aiResult.title,
          summary: aiResult.summary,
          keywords: JSON.stringify(aiResult.keywords),
          fullText: aiResult.full_text,
          path: file.url, // Store Blob URL instead of file path
          concepts: JSON.stringify(aiResult.concepts),
          conceptExplanation: aiResult.concept_explanation,
          codeExplanation: aiResult.code_explanation,
          prerequisites: JSON.stringify(aiResult.prerequisites),
          nextTopics: JSON.stringify(aiResult.next_topics),
          difficulty: aiResult.difficulty,
          isProcessing: false
        }
      })

      processed++
      results.push({
        id: screenshot.id,
        filename: file.filename,
        title: screenshot.title,
        success: true
      })

      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          processed,
          results: JSON.stringify(results)
        }
      })

      if (processed < fileData.length) {
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
    } catch (error: any) {
      console.error(`Failed to process ${file.filename}:`, error)
      errors.push({
        file: file.filename,
        error: error.message || 'Processing failed'
      })

      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          errors: JSON.stringify(errors)
        }
      })
    }
  }

  await prisma.processingJob.update({
    where: { id: jobId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      processed,
      failed: fileData.length - processed,
      results: JSON.stringify(results),
      errors: JSON.stringify(errors)
    }
  })

  console.log(`Processing complete: ${processed}/${fileData.length} successful`)
}
```

### Step 5: Update AI Processing Function
Update `src/lib/ai/qwen-api.ts` to handle URLs:

```typescript
import axios from 'axios'

// UPDATED: Function now accepts URL or file path
export async function processScreenshotWithQwenAPI(
  imageSource: string, // Can be URL or file path
  maxRetries: number = 3
): Promise<QwenResponse> {
  const apiKey = process.env.QWEN_API_KEY
  
  if (!apiKey) {
    throw new Error('QWEN_API_KEY is not configured')
  }

  let retryCount = 0
  let lastError: any = null

  while (retryCount < maxRetries) {
    try {
      const timeSinceLastCall = Date.now() - lastApiCallTime
      if (timeSinceLastCall < MIN_API_INTERVAL) {
        await sleep(MIN_API_INTERVAL - timeSinceLastCall)
      }

      console.log(`📸 Processing screenshot (attempt ${retryCount + 1}/${maxRetries})...`)
      lastApiCallTime = Date.now()
      
      // UPDATED: Handle both URLs and file paths
      let base64Image: string
      
      if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        // Download from URL
        const response = await axios.get(imageSource, { responseType: 'arraybuffer' })
        base64Image = Buffer.from(response.data).toString('base64')
      } else {
        // Read from file system (for local development)
        const fs = await import('fs/promises')
        const imageBuffer = await fs.readFile(imageSource)
        base64Image = imageBuffer.toString('base64')
      }
    
      const prompt = `Analyze this screenshot and provide the following information in JSON format:
    
    1. title: A concise, descriptive title (max 100 characters)
    2. summary: A comprehensive summary of the content (200-300 words)
    3. keywords: An array of 5-10 relevant keywords for searching
    4. full_text: Complete text extraction from the image
    5. concepts: Array of key concepts or topics (3-7 items)
    6. concept_explanation: Brief explanation of main concepts (100-200 words)
    7. code_explanation: If code is present, explain what it does. If not, set to empty string
    8. prerequisites: Array of prerequisite knowledge needed (2-5 items)
    9. next_topics: Array of suggested next learning topics (2-5 items)
    10. difficulty: One of "Beginner", "Intermediate", or "Advanced"
    
    Return ONLY valid JSON with these exact keys. No markdown formatting.`

      const model = process.env.QWEN_MODEL || 'qwen/qwen-2-vl-7b-instruct'
      
      const response = await axios.post(
        QWEN_API_URL,
        {
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                }
              ]
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/snapnotes',
            'X-Title': 'SnapNotes'
          },
          timeout: 60000
        }
      )

      const content = response.data?.choices?.[0]?.message?.content
      
      if (!content) {
        throw new Error('Invalid response from OpenRouter API')
      }

      let cleanContent = content.trim()
      cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/\s*```$/, '')
      
      try {
        const result = JSON.parse(cleanContent) as QwenResponse
      
        return {
          title: result.title || 'Untitled',
          summary: result.summary || '',
          keywords: Array.isArray(result.keywords) ? result.keywords : [],
          full_text: result.full_text || '',
          concepts: Array.isArray(result.concepts) ? result.concepts : [],
          concept_explanation: result.concept_explanation || '',
          code_explanation: result.code_explanation || '',
          prerequisites: Array.isArray(result.prerequisites) ? result.prerequisites : [],
          next_topics: Array.isArray(result.next_topics) ? result.next_topics : [],
          difficulty: ['Beginner', 'Intermediate', 'Advanced'].includes(result.difficulty) 
            ? result.difficulty 
            : 'Intermediate'
        }
      } catch (parseError: any) {
        lastError = parseError
        const waitTime = 5000 + (retryCount * 5000)
        console.log(`⚠️ JSON parse error. Waiting ${waitTime/1000} seconds before retry...`)
        await sleep(waitTime)
        retryCount++
        continue
      }
    } catch (error: any) {
      lastError = error
      const status = error.response?.status
      
      if (status === 429) {
        const waitTime = 20000 + (retryCount * 10000)
        console.log(`⏳ Rate limited. Waiting ${waitTime/1000} seconds before retry...`)
        await sleep(waitTime)
        retryCount++
        continue
      }
      
      if (retryCount < maxRetries - 1) {
        const waitTime = 10000 + (retryCount * 20000)
        console.log(`⚠️ Error occurred. Waiting ${waitTime/1000} seconds before retry...`)
        await sleep(waitTime)
        retryCount++
        continue
      }
      
      break
    }
  }

  console.error(`💔 Failed to process screenshot after ${maxRetries} attempts`)
  if (axios.isAxiosError(lastError) && lastError.response?.status === 429) {
    throw new Error('Rate limit exceeded. Please try again later.')
  }
  throw lastError || new Error('Failed to process screenshot after multiple retries')
}
```

**Time to implement**: 30 minutes  
**Impact**: ✅ Persistent file storage, CDN delivery, works on serverless

---

## Fix 3: Per-User Rate Limiting

### Update `src/lib/ai/qwen-api.ts`
Replace the global rate limiter with a per-user implementation:

```typescript
// REPLACE: Lines 19-21
// OLD:
// let lastApiCallTime = 0
// const MIN_API_INTERVAL = 1500

// NEW: Per-user rate limiting
const userRateLimiters = new Map<string, number>()
const MIN_API_INTERVAL = 1500

// ADD: Helper function for per-user rate limiting
async function waitForRateLimit(userId: string): Promise<void> {
  const lastCallTime = userRateLimiters.get(userId) || 0
  const timeSinceLastCall = Date.now() - lastCallTime
  
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    await sleep(MIN_API_INTERVAL - timeSinceLastCall)
  }
  
  userRateLimiters.set(userId, Date.now())
}

// UPDATED: Function signature to include userId
export async function processScreenshotWithQwenAPI(
  imageSource: string,
  userId: string, // ADD THIS PARAMETER
  maxRetries: number = 3
): Promise<QwenResponse> {
  const apiKey = process.env.QWEN_API_KEY
  
  if (!apiKey) {
    throw new Error('QWEN_API_KEY is not configured')
  }

  let retryCount = 0
  let lastError: any = null

  while (retryCount < maxRetries) {
    try {
      // REPLACE: Lines 39-43 with per-user rate limiting
      await waitForRateLimit(userId)

      console.log(`📸 Processing screenshot for user ${userId} (attempt ${retryCount + 1}/${maxRetries})...`)
      
      // ... rest of the function stays the same
    }
  }
}
```

### Update `src/app/api/screenshots/upload/route.ts`
Pass userId to the AI processing function:

```typescript
// Line 165 - UPDATE the function call
const aiResult = await processScreenshotWithQwenAPI(file.url, userId) // Add userId parameter
```

**Time to implement**: 10 minutes  
**Impact**: ✅ Users don't block each other, fair resource allocation

---

## Testing Your Fixes

### 1. Test Locally
```bash
# Start development server
npm run dev

# Upload screenshots
# Open http://localhost:3000 in multiple browser tabs
# Upload 5 screenshots in each tab simultaneously
```

### 2. Monitor Performance
Check the console logs for:
- ✅ No "waiting for rate limit" messages between different users
- ✅ Each user's jobs complete independently
- ✅ No database lock errors

### 3. Deploy to Vercel
```bash
# Push to GitHub
git add .
git commit -m "Production fixes: PostgreSQL + Blob Storage + Per-user rate limiting"
git push

# Deploy via Vercel dashboard or CLI
vercel --prod
```

---

## Expected Results

| Metric | Before Fixes | After Fixes |
|--------|-------------|-------------|
| 2 users, 5 images each | 85s for both | 42s each (parallel) |
| 5 users, 10 images each | 7 minutes (timeout risk) | 85s each (parallel) |
| Database errors | Frequent locks | None |
| File persistence | Lost on redeploy | Permanent |
| User blocking | All users wait for each other | Independent processing |

---

## Next Steps (Optional Improvements)

After implementing these critical fixes, consider:

1. **Add Message Queue** (Week 2)
   - Implement QStash or Inngest for better job management
   - Enable retry logic and failure recovery

2. **Parallel Processing** (Week 2)
   - Process 3-5 screenshots simultaneously per user
   - Reduce total processing time by 3-5x

3. **Caching Layer** (Week 3)
   - Add Redis to cache duplicate screenshot results
   - Skip AI processing for repeated uploads

---

## Support

If you encounter issues:
1. Check the console logs for specific error messages
2. Verify environment variables are set correctly
3. Test PostgreSQL connection: `npx prisma studio`
4. Test Blob upload: Check Vercel dashboard → Storage

Let me know if you need help with any specific step!
