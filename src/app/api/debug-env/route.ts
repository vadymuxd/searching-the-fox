import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.RESEND_API_KEY;
  return NextResponse.json({
    hasKey: !!key,
    keyPrefix: key ? key.substring(0, 5) : null,
    env: process.env.NODE_ENV,
    allKeys: Object.keys(process.env).filter(k => k.includes('RESEND'))
  });
}
