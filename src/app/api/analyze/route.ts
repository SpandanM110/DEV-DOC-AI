import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios, { AxiosRequestConfig } from 'axios';
import { z } from 'zod';

// Edge runtime configuration
export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

// URL validation schema
const UrlSchema = z.object({
  url: z.string().url('Invalid URL format').refine(
    (url) => url.startsWith('http') || url.startsWith('https'),
    { message: 'Only HTTP and HTTPS protocols are allowed' }
  ),
});

// Constants for content processing
const MIN_CONTENT_LENGTH = 100;
const MAX_CONTENT_LENGTH = 5000;
const TIMEOUT_MS = 15000;

// Fetch configuration with proper typing
const createFetchConfig = (): AxiosRequestConfig => ({
  timeout: TIMEOUT_MS,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; DocReader/1.0)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
    'Accept-Language': 'en-US,en;q=0.5',
  },
  validateStatus: (status: number) => status >= 200 && status < 300,
  maxRedirects: 3,
  responseType: 'arraybuffer' as const
});

// Error logging utility
const logError = (context: string, error: unknown): void => {
  const errorDetails = error instanceof Error
    ? {
        message: error.message,
        name: error.name,
        stack: error.stack,
        ...(axios.isAxiosError(error) && {
          status: error.response?.status,
          data: error.response?.data
        })
      }
    : String(error);

  console.error(`[${context}] Error:`, errorDetails);
};

// Content extraction utility
const extractContent = (doc: cheerio.CheerioAPI): string => {
  // Remove non-content elements
  const elementsToRemove = [
    'script',
    'style',
    'noscript',
    'iframe',
    'svg',
    'nav',
    'footer',
    'header',
    '.sidebar',
    '.ads',
    '.cookie-banner',
    '#comments'
  ];

  elementsToRemove.forEach(selector => {
    doc(selector).remove();
  });

  // Priority content selectors
  const contentSelectors = [
    'main',
    'article',
    '.content',
    '.documentation',
    '#main-content',
    '.markdown-body',
    '#readme',
    'body'
  ];

  // Find first meaningful content
  for (const selector of contentSelectors) {
    const content = doc(selector).text().trim();
    if (content.length > MIN_CONTENT_LENGTH) {
      return content;
    }
  }

  return doc('body').text().trim();
};

// Content cleaning utility
const cleanContent = (content: string): string => {
  return content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .replace(/[^\x20-\x7E\n]/g, '')
    .trim()
    .substring(0, MAX_CONTENT_LENGTH);
};

// Main API route handler
export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Parse and validate request body
    const body = await req.json().catch(() => ({}));
    const validation = UrlSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: validation.error.errors[0].message
        },
        { status: 400 }
      );
    }

    const { url } = validation.data;

    // Fetch content with error handling
    let response;
    try {
      response = await axios.get(url, createFetchConfig());
    } catch (error) {
      logError('Content Fetch', error);
      
      if (axios.isAxiosError(error)) {
        return NextResponse.json(
          {
            error: 'Failed to fetch content',
            details: error.message,
            status: error.response?.status
          },
          { status: error.response?.status || 500 }
        );
      }
      
      throw error;
    }

    // Convert response to text
    const decoder = new TextDecoder('utf-8');
    const htmlContent = decoder.decode(response.data);

    // Parse and extract content with proper Cheerio options
    const $ = cheerio.load(htmlContent, {
      decodeEntities: true,
      normalizeWhitespace: true,
      xmlMode: false
    });

    const extractedContent = extractContent($);
    const processedContent = cleanContent(extractedContent);

    // Validate processed content
    if (processedContent.length < MIN_CONTENT_LENGTH) {
      return NextResponse.json(
        {
          error: 'Insufficient content',
          details: 'Unable to extract meaningful text',
          contentLength: processedContent.length
        },
        { status: 422 }
      );
    }

    // Return successful response
    return NextResponse.json({
      success: true,
      content: processedContent,
      metadata: {
        url,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        contentLength: processedContent.length,
        contentType: response.headers['content-type']
      }
    });

  } catch (error) {
    logError('Route Handler', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}