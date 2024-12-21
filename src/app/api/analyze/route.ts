// src/app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { model } from '@/lib/gemini';
import { auth } from '@/lib/firebase';

export async function POST(req: Request) {
  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the request body
    const { url } = await req.json();

    try {
      // Fetch webpage content
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Remove unnecessary elements
      $('script, style, nav, footer, header, aside, .sidebar').remove();
      
      // Extract main content
      const mainContent = $('main, article, .content, .documentation, .docs-content')
        .text() || $('body').text();

      // Clean content
      const cleanContent = mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

      // Prepare analysis prompt
      const prompt = `
      Analyze this developer documentation and provide a structured summary with:

      1. Overview & Main Concepts:
         - Brief description
         - Key terminology
         - Core concepts

      2. Key Features & Functionality:
         - Main capabilities
         - Important functions
         - API endpoints (if applicable)

      3. Setup & Installation:
         - Prerequisites
         - Installation steps
         - Configuration details

      4. Code Examples:
         - Basic usage
         - Common patterns
         - Important implementations

      5. Best Practices:
         - Recommended approaches
         - Common pitfalls
         - Performance tips

      Documentation content: ${cleanContent.substring(0, 6000)}
      
      Please format the response with clear headers and bullet points.
      `;

      // Get analysis from Gemini
      const chatSession = await model.startChat({
        history: [],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 8192,
        },
      });

      const result = await chatSession.sendMessage(prompt);

      // Return successful response
      return NextResponse.json({
        success: true,
        analysis: result.response.text(),
        content: cleanContent,
        metadata: {
          url,
          timestamp: new Date().toISOString(),
          contentLength: cleanContent.length,
        }
      });

    } catch (error) {
      console.error('Error fetching or processing content:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to process documentation' },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('Error in analyze route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}