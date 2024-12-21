import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { model } from '@/lib/gemini';
import { z } from 'zod';

// Simplified complexity to reduce ESLint warnings
const extractMainContent = ($: cheerio.Root): string => {
  const contentSelectors = [
    'main', 'article', '.content', '.documentation', 
    '.docs-contents', '#main-content', '.page-content'
  ];

  for (const selector of contentSelectors) {
    const content = $(selector).text();
    if (content && content.trim().length > 100) {
      return content;
    }
  }

  return $('body').text();
};

// Simplified error logging
const logError = (context: string, error: unknown): void => {
  const errorMessage = error instanceof Error 
    ? error.message 
    : String(error);
  
  console.error(`[${context}] Error: ${errorMessage}`);
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

    // Fetch webpage content
    let response;
    try {
      response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        timeout: 10000,
        maxRedirects: 3
      });
    } catch (fetchError) {
      logError('Content Fetch', fetchError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch content',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
        },
        { status: 500 }
      );
    }

    // Content extraction
    const $ = cheerio.load(response.data);
    
    // Remove unnecessary elements
    $('script, style, noscript, iframe, svg, canvas, template, ' + 
      'nav, footer, header, aside, .sidebar, .ads, .advertisement, ' + 
      '#comments, .related-content').remove();
    
    // Extract main content
    let mainContent = extractMainContent($);

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
          details: 'Unable to extract meaningful text' 
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
      Provide a brief technical documentation summary:

      CONTEXT: ${cleanContent}

      Requirements:
      1. Technology Overview
      2. Key Features
      3. Basic Implementation
      4. Potential Use Cases
      `;

      // Generate content with explicit type handling
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
            : 'Unexpected Gemini API error'
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