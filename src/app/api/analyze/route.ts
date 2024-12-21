import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios, { 
  AxiosError, 
  AxiosResponse, 
  AxiosInstance 
} from 'axios';
import { z } from 'zod';
import { model } from '@/lib/gemini';

// Replace any with specific types
type FetchError = Error & {
  response?: {
    status?: number;
  };
  request?: unknown;
};

// Enhanced type-safe logging utility
const logError = (context: string, error: unknown): void => {
  console.error(`[${context}] Error Details:`, 
    error instanceof Error 
      ? { 
          message: error.message, 
          name: error.name,
          stack: error.stack 
        } 
      : String(error)
  );
};

// Rest of the previous implementation remains the same...

export async function POST(req: Request) {
  const startTime = Date.now();
  const axiosInstance = createAxiosInstance();

  try {
    // Typed request body
    let body: { url: string };
    try {
      body = await req.json();
    } catch (parseError: unknown) {
      logError('Request Parsing', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: parseError instanceof Error 
            ? parseError.message 
            : 'Unable to parse JSON body'
        }, 
        { status: 400 }
      );
    }

    // Rest of the implementation remains the same...
  } catch (unexpectedError: unknown) {
    logError('Unexpected Route Error', unexpectedError);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: unexpectedError instanceof Error 
          ? unexpectedError.message 
          : 'Unhandled unexpected error'
      },
      { status: 500 }
    );
  }
}