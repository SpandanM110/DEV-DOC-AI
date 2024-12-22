import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios, { AxiosRequestConfig } from 'axios';
import { z } from 'zod';

// Configure specifically for edge runtime
export const config = {
  runtime: 'edge',
  regions: ['iad1'], // Specify deployment region if needed
};

// Fetch configuration optimized for edge runtime
const createFetchConfig = (): AxiosRequestConfig => ({
  timeout: 15000, // Reduced timeout for edge functions
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible)',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.5',
  },
  validateStatus: (status: number) => status >= 200 && status < 300,
  maxRedirects: 3,
  // Use arraybuffer for better edge compatibility
  responseType: 'arraybuffer' as const
});

// Simplified URL schema for edge runtime
const UrlSchema = z.object({
  url: z.string().url('Invalid URL format').refine(
    (url) => url.startsWith('http') || url.startsWith('https'),
    { message: 'Only HTTP and HTTPS protocols are allowed' }
  ),
});

// Simplified error logging for edge runtime
const logError = (context: string, error: unknown): void => {
  console.error(`[${context}]`, 
    error instanceof Error ? error.message : String(error)
  );
};

// Optimized content extraction
const extractContent = ($: cheerio.CheerioAPI): string => {
  // Remove script tags and other non-content elements
  $('script, style, noscript').remove();

  // Prioritize main content areas
  const selectors = [
    'main',
    'article',
    '.content',
    '#main-content',
    'body'
  ];

  for (const selector of selectors) {
    const content = $(selector).text().trim();
    if (content.length > 100) {
      return content;
    }
  }

  return $('body').text().trim();
};

// Optimized content cleaning for edge runtime
const cleanContent = (content: string): string => {
  return content
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 5000); // Reduced size for edge runtime
};

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Parse request with error handling
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    // Validate URL
    const validation = UrlSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { url } = validation.data;

    // Fetch content
    const response = await axios.get(url, createFetchConfig());
    
    // Convert arraybuffer to text
    const decoder = new TextDecoder('utf-8');
    const htmlContent = decoder.decode(response.data);

    // Parse and extract content
    const $ = cheerio.load(htmlContent);
    const extractedContent = extractContent($);
    const processedContent = cleanContent(extractedContent);

    if (processedContent.length < 100) {
      return NextResponse.json(
        { error: 'Insufficient content extracted' },
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
      }
    });

  } catch (error) {
    logError('API Error', error);

    if (axios.isAxiosError(error)) {
      return NextResponse.json(
        {
          error: 'Failed to fetch content',
          message: error.message
        },
        { status: error.response?.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}