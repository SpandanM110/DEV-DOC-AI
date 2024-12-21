// src/app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { z } from 'zod';
import { model } from '@/lib/gemini'; // Ensure this import is correct

// Enhanced type-safe logging utility
const logError = (context: string, error: unknown): void => {
  console.error(`[${context}] Error Details:`, 
    error instanceof Error 
      ? { 
          message: error.message, 
          name: error.name,
          stack: error.stack 
        } 
      : String(error)
  );
};

// Robust URL validation schema
const RequestSchema = z.object({
  url: z.string().url('Invalid URL format').refine(
    (url) => {
      try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
      } catch {
        return false;
      }
    }, 
    { message: 'Only HTTP and HTTPS protocols are allowed' }
  )
});

// Create a custom axios instance with robust defaults
const createAxiosInstance = () => {
  return axios.create({
    timeout: 30000, // Increased to 30 seconds
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.google.com/',
      'DNT': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'cross-site'
    },
    validateStatus: (status) => status >= 200 && status < 500
  });
};

// Type definition for fetch error
interface FetchErrorResponse {
  url?: string;
  status?: number;
  message: string;
}

// Advanced content extraction method
const extractMainContent = ($: cheerio.Root): string => {
  // More comprehensive content selectors
  const contentSelectors = [
    'main', 'article', '.content', '.documentation', 
    '.docs-contents', '#main-content', '.page-content', 
    '.markdown-body', '#readme', '.doc-content', 
    'body'
  ];

  // Enhanced content extraction logic
  for (const selector of contentSelectors) {
    const $content = $(selector);
    
    // Remove known non-content elements
    $content.find('script, style, nav, footer, header, aside, .sidebar, .ads, .advertisement').remove();
    
    const content = $content.text().trim();
    if (content.length > 200) {
      return content;
    }
  }

  // Fallback to full body text if no suitable content found
  return $('body').text().trim();
};

export async function POST(req: Request) {
  const startTime = Date.now();
  const axiosInstance = createAxiosInstance();

  try {
    // Parse request body with enhanced error handling
    let body: { url: string };
    try {
      body = await req.json();
    } catch (parseError) {
      logError('Request Parsing', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: parseError instanceof Error 
            ? parseError.message 
            : 'Unable to parse JSON body'
        }, 
        { status: 400 }
      );
    }

    // Validate URL
    const validationResult = RequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'URL Validation Failed',
          details: validationResult.error.errors 
        }, 
        { status: 400 }
      );
    }

    const { url } = validationResult.data;

    // Advanced fetch configuration
    let response: AxiosResponse;
    try {
      response = await axiosInstance.get(url);
    } catch (fetchError) {
      // Comprehensive error handling
      const errorResponse: FetchErrorResponse = {
        url: url,
        message: 'Unknown error occurred'
      };

      if (fetchError instanceof AxiosError) {
        if (fetchError.response) {
          errorResponse.status = fetchError.response.status;
          errorResponse.message = `HTTP Error ${fetchError.response.status}`;
        } else if (fetchError.request) {
          errorResponse.status = 504;
          errorResponse.message = 'No response received from server';
        } else {
          errorResponse.status = 500;
          errorResponse.message = fetchError.message;
        }
      }

      logError('Content Fetch', fetchError);

      return NextResponse.json(
        { 
          error: 'Failed to fetch content',
          details: errorResponse.message,
          url: errorResponse.url
        },
        { status: errorResponse.status || 500 }
      );
    }

    // Ensure we have response data
    if (!response.data) {
      return NextResponse.json(
        { 
          error: 'Empty response',
          details: 'No content received from the URL',
          url
        },
        { status: 422 }
      );
    }

    // Content extraction with robust fallback
    const $ = cheerio.load(response.data);
    
    // Extract main content
    const mainContent = extractMainContent($);

    // Rigorous content cleaning
    const cleanContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 8000);

    // Strict content validation
    if (cleanContent.length < 100) {
      return NextResponse.json(
        { 
          error: 'Insufficient content',
          details: 'Unable to extract meaningful text',
          url,
          extractedLength: cleanContent.length
        },
        { status: 422 }
      );
    }

    // Attempt AI analysis if model is available
    try {
      if (model) {
        const prompt = `
        Analyze the following technical documentation:

        CONTEXT: ${cleanContent}

        Provide a concise summary covering:
        1. Core Technology Overview
        2. Key Features
        3. Implementation Insights
        4. Potential Use Cases
        `;

        const generationResult = await model.generateContent(prompt);
        const analysis = generationResult.response.text();

        return NextResponse.json({
          success: true,
          analysis,
          content: cleanContent,
          metadata: {
            url,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime,
            contentLength: cleanContent.length
          }
        });
      }
    } catch (analysisError) {
      logError('AI Analysis Error', analysisError);
    }

    // Fallback if AI analysis fails
    return NextResponse.json({
      success: true,
      analysis: 'AI analysis unavailable. Basic content extraction completed.',
      content: cleanContent,
      metadata: {
        url,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        contentLength: cleanContent.length
      }
    });

  } catch (unexpectedError) {
    logError('Unexpected Route Error', unexpectedError);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: unexpectedError instanceof Error 
          ? unexpectedError.message 
          : 'Unhandled unexpected error'
      },
      { status: 500 }
    );
  }
}

// Edge runtime for optimal performance
export const runtime = 'edge';