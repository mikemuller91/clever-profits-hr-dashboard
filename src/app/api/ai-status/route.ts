import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: 'NOT_CONFIGURED',
      message: 'GEMINI_API_KEY environment variable is not set',
    }, { status: 500 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Simple test message to check if API is working
    const result = await model.generateContent('Say "OK"');
    const text = result.response.text();

    return NextResponse.json({
      status: 'WORKING',
      message: 'Gemini API is functioning correctly',
      testResponse: text,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common error types
    let status = 'ERROR';
    let hint = '';

    if (errorMessage.includes('401') || errorMessage.includes('API_KEY_INVALID')) {
      status = 'INVALID_API_KEY';
      hint = 'Your API key appears to be invalid';
    } else if (errorMessage.includes('429') || errorMessage.includes('RATE_LIMIT')) {
      status = 'RATE_LIMITED';
      hint = 'You have hit the API rate limit. Wait a few minutes.';
    } else if (errorMessage.includes('quota')) {
      status = 'QUOTA_EXCEEDED';
      hint = 'Your Gemini API quota may have been exceeded';
    }

    return NextResponse.json({
      status,
      message: errorMessage,
      hint,
    }, { status: 500 });
  }
}
