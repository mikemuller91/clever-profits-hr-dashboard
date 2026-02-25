import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      status: 'NOT_CONFIGURED',
      message: 'ANTHROPIC_API_KEY environment variable is not set',
    }, { status: 500 });
  }

  try {
    const anthropic = new Anthropic({ apiKey });

    // Simple test message to check if API is working
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Say "OK"' }],
    });

    const response = message.content[0];
    const text = response.type === 'text' ? response.text : 'Unknown response';

    return NextResponse.json({
      status: 'WORKING',
      message: 'Anthropic API is functioning correctly',
      testResponse: text,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common error types
    let status = 'ERROR';
    let hint = '';

    if (errorMessage.includes('401')) {
      status = 'INVALID_API_KEY';
      hint = 'Your API key appears to be invalid';
    } else if (errorMessage.includes('429')) {
      status = 'RATE_LIMITED';
      hint = 'You have hit the API rate limit. Wait a few minutes.';
    } else if (errorMessage.includes('insufficient')) {
      status = 'INSUFFICIENT_CREDITS';
      hint = 'Your Anthropic account may have run out of credits';
    }

    return NextResponse.json({
      status,
      message: errorMessage,
      hint,
    }, { status: 500 });
  }
}
