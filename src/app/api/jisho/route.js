// src/app/api/jisho/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyword = searchParams.get('keyword');

  if (!keyword) {
    return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
  }

  try {
    const apiResponse = await fetch(`https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(keyword)}`);

    if (!apiResponse.ok) {
      throw new Error(`Jisho API failed with status: ${apiResponse.status}`);
    }

    const data = await apiResponse.json();
    // Wrap the response in a 'data' property to match frontend expectations
    return NextResponse.json({ data: data.data });

  } catch (error) {
    console.error('Jisho proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch data from Jisho API' }, { status: 500 });
  }
}