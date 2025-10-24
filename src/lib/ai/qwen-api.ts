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

// Rate limiting tracker
let lastApiCallTime = 0
const MIN_API_INTERVAL = 1500 // 1.5 seconds between API calls

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function processScreenshotWithQwenAPI(imagePath: string, maxRetries: number = 3): Promise<QwenResponse> {
  const apiKey = process.env.QWEN_API_KEY
  
  if (!apiKey) {
    throw new Error('QWEN_API_KEY is not configured')
  }

  let retryCount = 0
  let lastError: any = null

  while (retryCount < maxRetries) {
    try {
      // Rate limiting: Wait if too soon after last API call
      const timeSinceLastCall = Date.now() - lastApiCallTime
      if (timeSinceLastCall < MIN_API_INTERVAL) {
        await sleep(MIN_API_INTERVAL - timeSinceLastCall)
      }

      console.log(`📸 Processing screenshot (attempt ${retryCount + 1}/${maxRetries})...`)
      
      // Update last API call time
      lastApiCallTime = Date.now()
      
      // Read image file and convert to base64
      const imageBuffer = await fs.readFile(imagePath)
      const base64Image = imageBuffer.toString('base64')
    
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
      const content = response.data?.choices?.[0]?.message?.content
      
      if (!content) {
        throw new Error('Invalid response from OpenRouter API')
      }

      // Clean up the response and parse JSON
      let cleanContent = content.trim()
      
      // Remove markdown code blocks if present
      cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/\s*```$/, '')
      
      try {
        const result = JSON.parse(cleanContent) as QwenResponse
      
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
      } catch (parseError: any) {
        lastError = parseError
        // JSON parsing error - retry after short wait
        const waitTime = 5000 + (retryCount * 5000) // 5, 10, 15 seconds
        console.log(`⚠️ JSON parse error. Waiting ${waitTime/1000} seconds before retry...`)
        await sleep(waitTime)
        retryCount++
        continue
      }
    } catch (error: any) {
      lastError = error
      const status = error.response?.status
      
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
  onProgress?: (processed: number, total: number) => void
): Promise<QwenResponse[]> {
  const results: QwenResponse[] = []
  const delayBetweenRequests = 1500 // 1.5 seconds between requests
  
  for (let i = 0; i < imagePaths.length; i++) {
    try {
      const result = await processScreenshotWithQwenAPI(imagePaths[i])
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
