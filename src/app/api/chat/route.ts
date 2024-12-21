// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';
import { model } from '@/lib/gemini';

export async function POST(req: Request) {
  try {
    const { question, docContent } = await req.json();

    const chatSession = await model.startChat({
      history: [],
    });

    const prompt = `You are a helpful assistant that helps developers understand documentation and implement code. You have access to the following documentation content:

${docContent}

User Question: ${question}

Provide a clear and helpful response. If the question is about implementation, include relevant code examples. If the question is about concepts, explain them clearly. If suggesting code improvements, explain why they're better.

Response format:
1. Direct answer to the question
2. Code examples (if relevant)
3. Additional tips or best practices (if applicable)`;

    const result = await chatSession.sendMessage(prompt);
    
    return NextResponse.json({
      success: true,
      response: result.response.text(),
    });
  } catch (error: any) {
    console.error('Error in chat:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process your question' 
      },
      { status: 500 }
    );
  }
}