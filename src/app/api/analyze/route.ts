import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios, { AxiosRequestConfig } from 'axios';
import { z } from 'zod';

// Configure for edge runtime
export const config = {
  runtime: 'edge',
  regions: ['iad1'],
};

// Fetch configuration
const createFetchConfig = (): AxiosRequestConfig => ({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible)',
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.5',
  },
  validateStatus: (status: number) => status >= 200 && status < 300,
  maxRedirects: 3,
  responseType: 'arraybuffer' as const
});

// URL schema
const UrlSchema = z.object({
  url: z.string().url('Invalid URL format').refine(
    (url) => url.startsWith('http') || url.startsWith('https'),
    { message: 'Only HTTP and HTTPS protocols are allowed' }
  ),
});

// Error logging
const logError = (context: string, error: unknown): void => {
  console.error(`[${context}]`, 
    error instanceof Error ? error.message : String(error)
  );
};

// Fixed type definition for extractContent
const extractContent = (doc: cheerio.CheerioAPI): string => {
  // Remove script tags and other non-content elements
  doc('script, style, noscript').remove();

  // Prioritize main content areas
  const selectors = [
    'main',
    'article',
    '.content',
    '#main-content',
    'body'
  ];

  for (const selector of selectors) {
    const content = doc(selector).text().trim();
    if (content.length > 100) {
      return content;
    }
  }

  return doc('body').text().trim();
};

// Content cleaning
const cleanContent = (content: string): string => {
  return content
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 5000);
};

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Parse request
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
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

    // Parse and extract content with proper typing
    const $ = cheerio.load(htmlContent, null, false);  // Use load with proper options
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