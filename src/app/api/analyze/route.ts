import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { model } from '@/lib/gemini';
import { z } from 'zod';

// Input validation schema
const RequestSchema = z.object({
  url: z.string().url('Invalid URL format')
});

export async function POST(req: Request) {
  try {
    // Validate authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON body' }, 
        { status: 400 }
      );
    }

    // Validate URL using Zod
    const validationResult = RequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors 
        }, 
        { status: 400 }
      );
    }

    const { url } = validationResult.data;

    // Fetch and process content
    try {
      // Enhanced axios configuration
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': 'https://www.google.com/' // Add referrer to reduce blocking
        },
        timeout: 15000, // Increased timeout to 15 seconds
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Ensure content type is HTML
      const contentType = response.headers['content-type']?.toLowerCase();
      if (!contentType || !contentType.includes('text/html')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid content type',
            details: `Expected HTML, received: ${contentType}` 
          },
          { status: 415 } // Unsupported Media Type
        );
      }

      // Enhanced content extraction
      const $ = cheerio.load(response.data);
      
      // Remove unnecessary elements more comprehensively
      $('script, style, noscript, iframe, svg, canvas, template, ' + 
        'nav, footer, header, aside, .sidebar, .ads, .advertisement, ' + 
        '#comments, .related-content, .cookie-banner').remove();
      
      // More robust main content selection
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

      // Fallback to body if no content found
      mainContent = mainContent || $('body').text();

      // Enhanced content cleaning
      const cleanContent = mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .replace(/\[.*?\]/g, '') // Remove bracketed content
        .replace(/\s{2,}/g, ' ') // Remove excessive whitespace
        .trim()
        .substring(0, 8000); // Increased to 8000 chars

      // Safeguard against empty content
      if (cleanContent.length < 50) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Insufficient content extracted',
            details: 'Unable to find meaningful content on the page' 
          },
          { status: 422 } // Unprocessable Entity
        );
      }

      // More specific analysis prompt with error handling
      const prompt = `
      Comprehensively analyze this technical documentation. Provide a structured, detailed summary:

      1. Overview & Core Concepts:
         - Precise technology/library description
         - Fundamental principles
         - Target use cases

      2. Technical Capabilities:
         - Detailed feature breakdown
         - Unique selling points
         - Integration possibilities

      3. Practical Implementation:
         - Comprehensive setup guide
         - Dependency requirements
         - Configuration options

      4. Advanced Code Patterns:
         - Complex usage scenarios
         - Performance optimization techniques
         - Error handling strategies

      5. Expert-Level Insights:
         - Common architectural patterns
         - Scalability considerations
         - Potential limitations

      Documentation Context: ${cleanContent}
      
      Format response with clear, structured markdown. Prioritize technical depth and practical applicability.
      `;

      // Configure Gemini with more robust generation settings
      const chatSession = await model.startChat({
        history: [],
        generationConfig: {
          temperature: 0.6,
          topP: 0.85,
          topK: 50,
          maxOutputTokens: 8192,
        },
      });

      // Process analysis with timeout
      const analysisPromise = chatSession.sendMessage(prompt);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timed out')), 45000)
      );

      const result = await Promise.race([analysisPromise, timeoutPromise]);

      // Return comprehensive response
      return NextResponse.json({
        success: true,
        analysis: result.response.text(),
        content: cleanContent,
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          contentLength: cleanContent.length,
          sourceContentLength: response.data.length
        }
      });

    } catch (error) {
      // Comprehensive error handling
      console.error('Content Processing Error:', error);
      
      if (axios.isAxiosError(error)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Network or URL access error',
            details: error.message,
            status: error.response?.status || 500
          },
          { status: error.response?.status || 500 }
        );
      }

      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to process documentation',
          details: error instanceof Error ? error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    // Catch-all error handler
    console.error('Route Processing Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}