import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { model } from '@/lib/gemini';
import { z } from 'zod';

// Enhanced logging utility
const logError = (context: string, error: unknown) => {
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
    // Authorization check
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/'
        },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 300
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

    // Content type validation
    const contentType = response.headers['content-type']?.toLowerCase();
    if (!contentType || !contentType.includes('text/html')) {
      return NextResponse.json(
        { 
          error: 'Invalid content type',
          details: `Expected HTML, received: ${contentType}` 
        },
        { status: 415 }
      );
    }

    // Content extraction
    const $ = cheerio.load(response.data);
    
    // Remove unnecessary elements
    $('script, style, noscript, iframe, svg, canvas, template, ' + 
      'nav, footer, header, aside, .sidebar, .ads, .advertisement, ' + 
      '#comments, .related-content, .cookie-banner').remove();
    
    // Content selection
    const contentSelectors = [
      'main', 'article', '.content', '.documentation', 
      '.docs-content', '#main-content', '.page-content',
      '.markdown-body', '#readme'
    ];

    let mainContent = '';
    for (const selector of contentSelectors) {
      const content = $(selector).text();
      if (content && content.trim().length > 100) {
        mainContent = content;
        break;
      }
    }

    // Fallback to body
    mainContent = mainContent || $('body').text();

    // Content cleaning
    const cleanContent = mainContent
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .replace(/\[.*?\]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .substring(0, 8000);

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

    // Gemini analysis
    try {
      const prompt = `
      Provide a comprehensive technical documentation summary:

      CONTEXT: ${cleanContent}

      ANALYSIS REQUIREMENTS:
      1. Technology Overview
         - Precise description
         - Core principles
         - Use cases

      2. Key Technical Capabilities
         - Feature breakdown
         - Unique aspects
         - Integration potential

      3. Implementation Guidance
         - Setup instructions
         - Configuration details
         - Dependency management

      4. Advanced Patterns
         - Complex scenarios
         - Optimization techniques
         - Error handling

      5. Expert Insights
         - Architectural considerations
         - Scalability strategies
         - Potential limitations
      `;

      // Start chat session
      const chatSession = await model.startChat({
        history: [],
        generationConfig: {
          temperature: 0.6,
          topP: 0.85,
          maxOutputTokens: 8192,
        }
      });

      // Generate content with timeout
      const analysisPromise = chatSession.sendMessage(prompt);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timed out')), 45000)
      );

      const result = await Promise.race([analysisPromise, timeoutPromise]);

      // Return response
      return NextResponse.json({
        success: true,
        analysis: result.response.text(),
        content: cleanContent,
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          contentLength: cleanContent.length
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