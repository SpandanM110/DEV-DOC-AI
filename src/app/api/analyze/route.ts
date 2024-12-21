// src/app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { z } from 'zod';
import { model } from '@/lib/gemini';

// Comprehensive fetch configuration
const createFetchConfig = () => ({
  timeout: 30000, // 30 seconds
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'text/html,application/xhtml+xml,application/xml',
    'Accept-Language': 'en-US,en;q=0.5',
    'Referer': 'https://www.google.com/',
    'DNT': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site'
  },
  validateStatus: () => true, // Accept all status codes
  maxRedirects: 5,
  responseType: 'text'
});

// URL validation schema
const UrlSchema = z.object({
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

// Enhanced error logging
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
  const startTime = Date.now();

  try {
    // Parse request body
    let body;
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
    const validationResult = UrlSchema.safeParse(body);
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

    // Enhanced fetch with comprehensive error handling
    let responseData;
    try {
      const fetchConfig = createFetchConfig();
      const response = await axios.get(url, fetchConfig);
      responseData = response.data;
    } catch (fetchError) {
      logError('Content Fetch', fetchError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch content',
          details: fetchError instanceof Error 
            ? fetchError.message 
            : 'Unknown fetch error',
          url
        },
        { status: 500 }
      );
    }

    // Validate response data
    if (!responseData || typeof responseData !== 'string') {
      return NextResponse.json(
        { 
          error: 'Invalid content',
          details: 'No meaningful content received',
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
      '#comments, .related-content, .cookie-banner').remove();
    
    // Content selection strategy
    const contentSelectors = [
      'main', 'article', '.content', '.documentation', 
      '.docs-contents', '#main-content', '.page-content', 
      '.markdown-body', '#readme', 'body'
    ];

    let mainContent = '';
    for (const selector of contentSelectors) {
      const content = $(selector).text().trim();
      if (content.length > 100) {
        mainContent = content;
        break;
      }
    }

    // Content cleaning
    const cleanContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
      .trim()
      .substring(0, 8000);

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

    // Basic response
    return NextResponse.json({
      success: true,
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