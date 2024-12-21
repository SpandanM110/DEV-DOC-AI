import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { model } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    // Validate authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body with error handling
    const body = await req.json();
    const url = body.url;

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'Invalid or missing URL' }, 
        { status: 400 }
      );
    }

    try {
      // Fetch webpage content with improved error handling and timeout
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 10000, // 10-second timeout
        maxRedirects: 5
      });

      // Enhanced content extraction
      const $ = cheerio.load(response.data);
      
      // Remove unnecessary elements more comprehensively
      $('script, style, noscript, iframe, svg, canvas, template, ' + 
        'nav, footer, header, aside, .sidebar, .ads, .advertisement, ' + 
        '#comments, .related-content').remove();
      
      // More robust main content selection
      const contentSelectors = [
        'main', 'article', '.content', '.documentation', 
        '.docs-content', '#main-content', '.page-content'
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
        .trim()
        .substring(0, 7000); // Limit to 7000 chars to avoid token limits

      // More specific analysis prompt
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
          temperature: 0.6, // Slightly reduced for more consistent output
          topP: 0.85,
          topK: 50,
          maxOutputTokens: 8192,
        },
      });

      // Process analysis with error handling
      const result = await chatSession.sendMessage(prompt);

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
      // Improved error logging and handling
      console.error('Content Processing Error:', error);
      
      // Differentiate between different types of errors
      if (axios.isAxiosError(error)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Network or URL access error',
            details: error.message 
          },
          { status: error.response?.status || 500 }
        );
      }

      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to process documentation',
          details: (error as Error).message 
        },
        { status: 500 }
      );
    }

  } catch (error) {
    // Catch-all error handler for request processing
    console.error('Route Processing Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        details: (error as Error).message 
      },
      { status: 500 }
    );
  }
}