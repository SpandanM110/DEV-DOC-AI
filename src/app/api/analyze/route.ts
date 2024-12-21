// src/app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { model } from '@/lib/gemini';
import { z } from 'zod';

// Comprehensive error logging
const logError = (context: string, error: unknown): void => {
  console.error(`[${context}] Error:`, 
    error instanceof Error 
      ? { message: error.message, stack: error.stack } 
      : error
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

export async function POST(req: Request) {
  const startTime = Date.now();

  try {
    // Robust request body parsing
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

    // URL validation
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

    // Enhanced fetch with comprehensive error handling
    let response;
    try {
      response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'text/html,application/xhtml+xml,application/xml',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/'
        },
        timeout: 20000, // Increased timeout
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      });
    } catch (fetchError: any) {
      logError('Content Fetch', fetchError);

      // Detailed error response
      if (fetchError.response) {
        return NextResponse.json(
          { 
            error: 'Failed to fetch content',
            details: `HTTP Error ${fetchError.response.status}`,
            url: fetchError.config.url
          },
          { status: fetchError.response.status || 500 }
        );
      } else if (fetchError.request) {
        return NextResponse.json(
          { 
            error: 'No response received',
            details: 'The target server did not respond',
            url
          },
          { status: 504 }
        );
      } else {
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

    // Content extraction with multiple fallbacks
    const $ = cheerio.load(response.data || '');
    
    // Remove unnecessary elements
    $('script, style, noscript, iframe, svg, canvas, template, ' + 
      'nav, footer, header, aside, .sidebar, .ads, .advertisement, ' + 
      '#comments, .related-content').remove();
    
    // Comprehensive content selection
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

    // Content cleaning and sanitization
    const cleanContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
      .trim()
      .substring(0, 6000);

    // Strict content validation
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

    // Fallback for Gemini configuration
    if (!model) {
      return NextResponse.json(
        { 
          success: true,
          analysis: 'AI analysis unavailable',
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

    // Gemini analysis with timeout protection
    try {
      const prompt = `
      Provide a concise, structured technical documentation summary:

      CONTEXT: ${cleanContent}

      Summarize:
      1. Technology Overview
      2. Core Features
      3. Implementation Guidelines
      4. Practical Use Cases
      `;

      // Generate content with explicit error handling
      const generationResult = await model.generateContent(prompt);
      const analysis = generationResult.response.text();

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
            : 'Unexpected AI error',
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

// Edge runtime for optimal performance
export const runtime = 'edge';