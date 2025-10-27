import { GoogleGenAI } from '@google/genai'

export interface LearningModule {
  title: string
  description: string
  screenshots: string[] // Array of screenshot IDs
  learning_outcomes: string[]
  estimated_time: string
  order: number
}

export interface LearningPath {
  title: string
  description: string
  total_time: string
  difficulty_progression: string
  modules: LearningModule[]
  learning_objectives: string[]
  prerequisites: string[]
  completion_criteria: string[]
}

export async function organizeLearningPath(screenshots: any[]): Promise<LearningPath> {
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured')
  }

  // Prepare screenshot data for the prompt
  const screenshotData = screenshots.map(s => ({
    id: s.id,
    title: s.title,
    summary: s.summary,
    concepts: typeof s.concepts === 'string' ? JSON.parse(s.concepts) : s.concepts,
    prerequisites: typeof s.prerequisites === 'string' ? JSON.parse(s.prerequisites) : s.prerequisites,
    next_topics: typeof s.nextTopics === 'string' ? JSON.parse(s.nextTopics) : s.nextTopics,
    difficulty: s.difficulty
  }))

  const prompt = `You are an expert learning path organizer. Given the following screenshots from educational content, create an optimal learning path.

Screenshots:
${JSON.stringify(screenshotData, null, 2)}

Create a structured learning path that:
1. Orders content from foundational to advanced
2. Groups related screenshots into logical modules
3. Ensures prerequisites are covered before dependent topics
4. Provides clear learning outcomes for each module
5. Estimates realistic time requirements

Return a JSON object with this EXACT structure:
{
  "title": "Learning path title",
  "description": "Overall description of the learning journey",
  "total_time": "Estimated total time (e.g., '4-6 hours')",
  "difficulty_progression": "Description of how difficulty progresses",
  "modules": [
    {
      "title": "Module title",
      "description": "What this module covers",
      "screenshots": ["screenshot_id1", "screenshot_id2"],
      "learning_outcomes": ["Outcome 1", "Outcome 2"],
      "estimated_time": "30-45 minutes",
      "order": 1
    }
  ],
  "learning_objectives": ["Overall objective 1", "Overall objective 2"],
  "prerequisites": ["Required knowledge 1", "Required knowledge 2"],
  "completion_criteria": ["What learner should be able to do after completion"]
}

Important: 
- Include ALL screenshot IDs in the modules
- Each screenshot should appear in exactly one module
- Order modules logically based on prerequisites and complexity
- Return ONLY valid JSON, no markdown formatting`

  try {
    // Initialize the Gemini API client (gets API key from environment)
    const ai = new GoogleGenAI({ apiKey })

    // Generate content using the new API
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      }
    })
    
    const text = response.text
    
    if (!text) {
      throw new Error('Empty response from Gemini API')
    }

    // Clean and parse the response
    let cleanContent = text.trim()
    cleanContent = cleanContent.replace(/^```json\s*/i, '').replace(/\s*```$/, '')
    
    try {
      const learningPath = JSON.parse(cleanContent) as LearningPath
      
      // Validate the structure
      if (!learningPath.modules || !Array.isArray(learningPath.modules)) {
        throw new Error('Invalid learning path structure')
      }
      
      return learningPath
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', parseError)
      
      // Return a fallback learning path
      return createFallbackLearningPath(screenshots)
    }
  } catch (error) {
    console.error('Gemini API error:', error)
    
    // Return a fallback learning path
    return createFallbackLearningPath(screenshots)
  }
}

function createFallbackLearningPath(screenshots: any[]): LearningPath {
  // Group screenshots by difficulty
  const beginnerScreenshots = screenshots.filter(s => s.difficulty === 'Beginner')
  const intermediateScreenshots = screenshots.filter(s => s.difficulty === 'Intermediate')
  const advancedScreenshots = screenshots.filter(s => s.difficulty === 'Advanced')
  
  const modules: LearningModule[] = []
  let moduleOrder = 1
  
  // Create modules based on difficulty
  if (beginnerScreenshots.length > 0) {
    modules.push({
      title: 'Foundation Concepts',
      description: 'Core concepts and fundamental knowledge',
      screenshots: beginnerScreenshots.map(s => s.id),
      learning_outcomes: ['Understand basic concepts', 'Build foundational knowledge'],
      estimated_time: `${beginnerScreenshots.length * 15}-${beginnerScreenshots.length * 20} minutes`,
      order: moduleOrder++
    })
  }
  
  if (intermediateScreenshots.length > 0) {
    modules.push({
      title: 'Intermediate Topics',
      description: 'Building on foundations with more complex concepts',
      screenshots: intermediateScreenshots.map(s => s.id),
      learning_outcomes: ['Apply concepts in practice', 'Understand complex relationships'],
      estimated_time: `${intermediateScreenshots.length * 20}-${intermediateScreenshots.length * 30} minutes`,
      order: moduleOrder++
    })
  }
  
  if (advancedScreenshots.length > 0) {
    modules.push({
      title: 'Advanced Mastery',
      description: 'Expert-level topics and advanced applications',
      screenshots: advancedScreenshots.map(s => s.id),
      learning_outcomes: ['Master advanced techniques', 'Solve complex problems'],
      estimated_time: `${advancedScreenshots.length * 30}-${advancedScreenshots.length * 45} minutes`,
      order: moduleOrder++
    })
  }
  
  const totalMinutes = screenshots.length * 25
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  
  return {
    title: 'Structured Learning Path',
    description: 'A comprehensive learning journey organized by complexity',
    total_time: hours > 0 ? `${hours} hours ${minutes} minutes` : `${minutes} minutes`,
    difficulty_progression: 'Progressive difficulty from beginner to advanced topics',
    modules,
    learning_objectives: [
      'Build comprehensive understanding of the subject matter',
      'Progress from fundamental to advanced concepts',
      'Apply knowledge through practical examples'
    ],
    prerequisites: ['Basic computer skills', 'Willingness to learn'],
    completion_criteria: [
      'Understand all core concepts',
      'Can apply knowledge independently',
      'Ready for real-world applications'
    ]
  }
}

export async function updateLearningOrder(screenshotIds: string[], orders: number[]): Promise<void> {
  // This function would update the learning order in the database
  // It's called after generating a learning path
  // Implementation depends on your database update strategy
}
