import { GoogleGenerativeAI } from '@google/generative-ai';

// Validate API key at runtime
const validateApiKey = (key: string | undefined): string => {
  if (!key) {
    throw new Error('Missing Gemini API key. Please set NEXT_PUBLIC_GEMINI_API_KEY.');
  }
  return key;
};

// Create a more robust Gemini AI configuration
const createGeminiModel = () => {
  const apiKey = validateApiKey(process.env.NEXT_PUBLIC_GEMINI_API_KEY);
  
  const genAI = new GoogleGenerativeAI(apiKey);

  return genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 8192,
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ]
  });
};

// Export the configured model
export const model = createGeminiModel();

// Optional: Export a function to create a new chat session
export const startChat = (history: any[] = []) => {
  return model.startChat({ history });
};