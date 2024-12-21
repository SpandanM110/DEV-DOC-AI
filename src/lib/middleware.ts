import { NextResponse } from 'next/server';

export function middleware() {
  const response = NextResponse.next();

  // Add security headers
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

  return response;
}