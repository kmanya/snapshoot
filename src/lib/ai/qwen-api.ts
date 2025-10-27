import axios from 'axios'
import fs from 'fs/promises'

interface QwenResponse {
  title: string
  summary: string
  keywords: string[]
  full_text: string
  concepts: string[]
  concept_explanation: string
  code_explanation: string
  prerequisites: string[]
  next_topics: string[]
  difficulty: string
}

const QWEN_API_URL = process.env.QWEN_API_URL || 'https://openrouter.ai/api/v1/chat/completions'

// Per-user rate limiting tracker
const userRateLimiters = new Map<string, number>()
const MIN_API_INTERVAL = 1500 // 1.5 seconds between API calls

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Helper function for per-user rate limiting
async function waitForUserRateLimit(userId: string): Promise<void> {
  const lastCallTime = userRateLimiters.get(userId) || 0
  const timeSinceLastCall = Date.now() - lastCallTime
  
  if (timeSinceLastCall < MIN_API_INTERVAL) {
    await sleep(MIN_API_INTERVAL - timeSinceLastCall)
  }
  
  userRateLimiters.set(userId, Date.now())
}

export async function processScreenshotWithQwenAPI(
  imageSource: string,
  userId: string,
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
      // Per-user rate limiting
      await waitForUserRateLimit(userId)

      console.log(`📸 Processing screenshot for user ${userId} (attempt ${retryCount + 1}/${maxRetries})...`)
      
      // Read image from URL or file path and convert to base64
      let base64Image: string
      
      if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        // Download from URL (Google Drive, etc.)
        const axios = require('axios')
        const response = await axios.get(imageSource, { 
          responseType: 'arraybuffer',
          timeout: 30000 // 30 second timeout for download
        })
        base64Image = Buffer.from(response.data).toString('base64')
      } else {
        // Read from file system (for local development)
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

      // Use OpenRouter with a vision-capable model
      const model = process.env.QWEN_MODEL || 'qwen/qwen-2-vl-7b-instruct'
      
      const response = await axios.post(
        QWEN_API_URL,
        {
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}` 
                  }
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
          timeout: 60000 // 60 seconds timeout for vision models
        }
      )

      // Parse the OpenRouter response (OpenAI-compatible format)
      const content = response.data.choices[0].message.content
      
      if (!content) {
        throw new Error('Invalid response from OpenRouter API')
      }

      // Preprocess content to fix common JSON issues
      let preprocessedContent = content
      
      // First, find and extract just the JSON object
      const firstBrace = content.indexOf('{')
      const lastBrace = content.lastIndexOf('}')
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        preprocessedContent = content.substring(firstBrace, lastBrace + 1)
      }
      
      // Try multiple JSON extraction strategies with improved robustness
      let result: QwenResponse
      
      // Log first 500 chars for debugging
      console.log('AI Response preview:', preprocessedContent.substring(0, 500))
      
      try {
        // Strategy 1: Try direct parse on preprocessed content
        result = JSON.parse(preprocessedContent) as QwenResponse
        console.log('✅ Strategy 1 (direct parse with preprocessing) succeeded')
      } catch (e1) {
        try {
          // Strategy 2: Extract from markdown code block
          const jsonMatch = preprocessedContent.match(/```json\n?([\s\S]*?)\n?```/)
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[1]) as QwenResponse
            console.log('✅ Strategy 2 (markdown extraction) succeeded')
          } else {
            throw new Error('No markdown code block found')
          }
        } catch (e2) {
          try {
            // Strategy 3: Find first complete JSON object using brace counting
            const jsonStart = preprocessedContent.indexOf('{')
            if (jsonStart === -1) throw new Error('No opening brace found')
            
            let braceCount = 0
            let inString = false
            let escapeNext = false
            let jsonEnd = -1
            
            for (let i = jsonStart; i < preprocessedContent.length; i++) {
              const char = preprocessedContent[i]
              
              if (escapeNext) {
                escapeNext = false
                continue
              }
              
              if (char === '\\') {
                escapeNext = true
                continue
              }
              
              if (char === '"' && !escapeNext) {
                inString = !inString
                continue
              }
              
              if (!inString) {
                if (char === '{') braceCount++
                if (char === '}') {
                  braceCount--
                  if (braceCount === 0) {
                    jsonEnd = i
                    break
                  }
                }
              }
            }
            
            if (jsonEnd !== -1) {
              const jsonStr = preprocessedContent.substring(jsonStart, jsonEnd + 1)
              result = JSON.parse(jsonStr) as QwenResponse
              console.log('✅ Strategy 3 (brace counting) succeeded')
            } else {
              throw new Error('Could not find matching closing brace')
            }
          } catch (e3) {
            // Strategy 4: Try to fix common JSON errors on preprocessed content
            try {
              let fixedContent = preprocessedContent
                .replace(/```json\n?/g, '')
                .replace(/```\n?/g, '')
                .trim()
              
              // Find the JSON object
              const start = fixedContent.indexOf('{')
              const end = fixedContent.lastIndexOf('}')
              
              if (start !== -1 && end !== -1) {
                fixedContent = fixedContent.substring(start, end + 1)
              }
              
              // Remove trailing commas before closing braces/brackets
              fixedContent = fixedContent.replace(/,(\s*[}\]])/g, '$1')
              
              result = JSON.parse(fixedContent) as QwenResponse
              console.log('✅ Strategy 4 (error fixing) succeeded')
            } catch (e4) {
              console.error('❌ All JSON parsing strategies failed')
              console.error('Original content length:', content.length)
              console.error('Preprocessed length:', preprocessedContent.length)
              console.error('Content preview:', content.substring(0, 1000))
              console.error('Preprocessed preview:', preprocessedContent.substring(0, 1000))
              console.error('Last error:', e4)
              throw new Error(`Failed to parse AI response as JSON after all strategies`)
            }
          }
        }
      }
      
      // Validate and sanitize the response
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
    } catch (error: any) {
      lastError = error
      const status = error.response?.status
      
      // Check if it's a JSON parse error
      if (error.message?.includes('JSON') || error.message?.includes('parse')) {
        const waitTime = 5000 + (retryCount * 5000) // 5, 10, 15 seconds
        console.log(`⚠️ JSON parse error. Waiting ${waitTime/1000} seconds before retry...`)
        await sleep(waitTime)
        retryCount++
        continue
      }
      
      // Check if it's a rate limit error (429)
      if (status === 429) {
        const waitTime = 20000 + (retryCount * 10000) // 20, 30, 40 seconds
        console.log(`⏳ Rate limited. Waiting ${waitTime/1000} seconds before retry...`)
        await sleep(waitTime)
        retryCount++
        continue
      }
      
      // Network or other errors - retry after brief wait
      if (retryCount < maxRetries - 1) {
        const waitTime = 10000 + (retryCount * 20000) // 3, 5, 7 seconds
        console.log(`⚠️ Error occurred. Waiting ${waitTime/1000} seconds before retry...`)
        await sleep(waitTime)
        retryCount++
        continue
      }
      
      // Max retries reached
      break
    }
  }

  // All retries exhausted
  console.error(`💔 Failed to process screenshot after ${maxRetries} attempts`)
  if (axios.isAxiosError(lastError) && lastError.response?.status === 429) {
    throw new Error('Rate limit exceeded. Please try again later.')
  }
  throw lastError || new Error('Failed to process screenshot after multiple retries')
}

// Helper function to process multiple screenshots with rate limiting
export async function processMultipleScreenshots(
  imagePaths: string[],
  userId: string,
  onProgress?: (processed: number, total: number) => void
): Promise<QwenResponse[]> {
  const results: QwenResponse[] = []
  const delayBetweenRequests = 1500 // 1.5 seconds between requests
  
  for (let i = 0; i < imagePaths.length; i++) {
    try {
      const result = await processScreenshotWithQwenAPI(imagePaths[i], userId)
      results.push(result)
      
      if (onProgress) {
        onProgress(i + 1, imagePaths.length)
      }
      
      // Rate limiting: wait before next request (except for the last one)
      if (i < imagePaths.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenRequests))
      }
    } catch (error) {
      console.error(`Failed to process ${imagePaths[i]}:`, error)
      
      // Add a placeholder result for failed processing
      results.push({
        title: `Failed to process: ${imagePaths[i].split('/').pop()}`,
        summary: 'Processing failed',
        keywords: [],
        full_text: '',
        concepts: [],
        concept_explanation: '',
        code_explanation: '',
        prerequisites: [],
        next_topics: [],
        difficulty: 'Intermediate'
      })
    }
  }
  
  return results
}
