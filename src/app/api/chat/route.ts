// src/app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { z } from 'zod';

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
    timeout: 25000, // 25 seconds
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
      // Type-safe error handling
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
    
    // Remove unnecessary elements
    $('script, style, noscript, iframe, svg, canvas, template, ' + 
      'nav, footer, header, aside, .sidebar, .ads, .advertisement, ' + 
      '#comments, .related-content, .cookie-banner').remove();
    
    // Comprehensive content selection
    const contentSelectors = [
      'main', 'article', '.content', '.documentation', 
      '.docs-contents', '#main-content', '.page-content', 
      '.markdown-body', '#readme', 'body'
    ];

    let mainContent = '';
    for (const selector of contentSelectors) {
      const content = $(selector).text();
      if (content && content.trim().length > 100) {
        mainContent = content;
        break;
      }
    }

    // Rigorous content cleaning
    const cleanContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 7000);

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

    // Provide basic analysis
    return NextResponse.json({
      success: true,
      analysis: 'Basic content extraction successful',
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