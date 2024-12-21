import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { model } from '@/lib/gemini';
import { z } from 'zod';

// Enhanced error logging utility
const logError = (context: string, error: unknown): void => {
  console.error(`[${context}] Error:`, 
    error instanceof Error 
      ? { message: error.message, stack: error.stack } 
      : error
  );
};

// Input validation schema
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
          details: parseError instanceof Error ? parseError.message : 'Parsing failed'
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

    // Enhanced axios configuration with more detailed error handling
    let response;
    try {
      response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/'
        },
        timeout: 15000, // 15 seconds timeout
        maxRedirects: 3,
        validateStatus: (status) => status >= 200 && status < 400 // More lenient status check
      });
    } catch (fetchError: any) {
      // Detailed error logging and handling
      logError('Content Fetch', fetchError);

      // Differentiate between different types of axios errors
      if (fetchError.response) {
        // The request was made and the server responded with a status code
        return NextResponse.json(
          { 
            error: 'Failed to fetch content',
            details: `HTTP Error ${fetchError.response.status}`,
            url: fetchError.config.url
          },
          { status: fetchError.response.status || 500 }
        );
      } else if (fetchError.request) {
        // The request was made but no response was received
        return NextResponse.json(
          { 
            error: 'No response received',
            details: 'The target server did not respond',
            url
          },
          { status: 504 } // Gateway Timeout
        );
      } else {
        // Something happened in setting up the request
        return NextResponse.json(
          { 
            error: 'Request setup failed',
            details: fetchError.message,
            url
          },
          { status: 500 }
        );
      }
    }

    // Content extraction with fallback
    const $ = cheerio.load(response.data || '');
    
    // Remove unnecessary elements
    $('script, style, noscript, iframe, svg, canvas, template, ' + 
      'nav, footer, header, aside, .sidebar, .ads, .advertisement, ' + 
      '#comments, .related-content').remove();
    
    // Content selection with multiple fallback selectors
    const contentSelectors = [
      'main', 'article', '.content', '.documentation', 
      '.docs-contents', '#main-content', '.page-content', 
      'body'
    ];

    let mainContent = '';
    for (const selector of contentSelectors) {
      const content = $(selector).text();
      if (content && content.trim().length > 50) {
        mainContent = content;
        break;
      }
    }

    // Content cleaning
    const cleanContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim()
      .substring(0, 5000);

    // Validate content
    if (cleanContent.length < 50) {
      return NextResponse.json(
        { 
          error: 'Insufficient content',
          details: 'Unable to extract meaningful text',
          url
        },
        { status: 422 }
      );
    }

    // Fallback for deployment without Gemini
    if (!model) {
      return NextResponse.json(
        { 
          success: true,
          analysis: 'Gemini AI is not configured. Unable to generate analysis.',
          content: cleanContent,
          metadata: {
            url,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
        },
        { status: 200 }
      );
    }

    // Gemini analysis
    try {
      const prompt = `
      Provide a concise technical documentation summary:

      CONTEXT: ${cleanContent}

      Summarize:
      1. Core Technology Overview
      2. Key Features
      3. Basic Implementation
      4. Use Cases
      `;

      // Generate content
      const generationResult = await model.generateContent(prompt);
      const analysis = generationResult.response.text();

      // Return response
      return NextResponse.json({
        success: true,
        analysis,
        content: cleanContent,
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime
        }
      });

    } catch (analysisError) {
      logError('Gemini Analysis', analysisError);
      return NextResponse.json(
        { 
          error: 'Analysis failed',
          details: analysisError instanceof Error 
            ? analysisError.message 
            : 'Unexpected Gemini API error',
          url
        },
        { status: 500 }
      );
    }

  } catch (unexpectedError) {
    logError('Unexpected Route Error', unexpectedError);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: unexpectedError instanceof Error 
          ? unexpectedError.message 
          : 'Unknown unexpected error'
      },
      { status: 500 }
    );
  }
}

// Edge runtime for better performance
export const runtime = 'edge';