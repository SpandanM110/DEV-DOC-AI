// src/app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { z } from 'zod';
import { model } from '@/lib/gemini';

// Utility function for creating Axios instance
const createAxiosInstance = () => {
  return axios.create({
    timeout: 30000, // 30 seconds
    maxRedirects: 5,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml',
      'Accept-Language': 'en-US,en;q=0.5',
      'Referer': 'https://www.google.com/',
    },
    validateStatus: (status) => status >= 200 && status < 500
  });
};

// Type definitions
interface ErrorResponse {
  url?: string;
  status?: number;
  message: string;
}

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

// Enhanced logging utility
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

export async function POST(req: Request) {
  const processingStartTime = Date.now();
  const axiosClient = createAxiosInstance();

  try {
    // Parse request body
    const body = await req.json();

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

    // Fetch webpage content
    let responseData;
    try {
      const response = await axiosClient.get(url);
      responseData = response.data;
    } catch (fetchError) {
      const errorResponse: ErrorResponse = {
        url,
        message: 'Failed to fetch content'
      };

      logError('Content Fetch', fetchError);

      return NextResponse.json(
        { 
          error: 'Failed to fetch content',
          details: errorResponse.message,
          url: errorResponse.url
        },
        { status: 500 }
      );
    }

    // Ensure we have response data
    if (!responseData) {
      return NextResponse.json(
        { 
          error: 'Empty response',
          details: 'No content received from the URL',
          url
        },
        { status: 422 }
      );
    }

    // Content extraction
    const $ = cheerio.load(responseData);
    
    // Remove unnecessary elements
    $('script, style, noscript, iframe, svg, canvas, template, ' + 
      'nav, footer, header, aside, .sidebar, .ads, .advertisement, ' + 
      '#comments, .related-content').remove();
    
    // Content selection
    const contentSelectors = [
      'main', 'article', '.content', '.documentation', 
      '.docs-contents', '#main-content', '.page-content', 
      'body'
    ];

    let mainContent = '';
    for (const selector of contentSelectors) {
      const content = $(selector).text();
      if (content && content.trim().length > 100) {
        mainContent = content;
        break;
      }
    }

    // Content cleaning
    const cleanContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/[^\x00-\x7F]/g, '')
      .trim()
      .substring(0, 7000);

    // Content validation
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
            processingTime: Date.now() - processingStartTime,
            contentLength: cleanContent.length
          }
        });
      }
    } catch (analysisError) {
      logError('AI Analysis Error', analysisError);
    }

    // Fallback response
    return NextResponse.json({
      success: true,
      analysis: 'AI analysis unavailable',
      content: cleanContent,
      metadata: {
        url,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - processingStartTime,
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