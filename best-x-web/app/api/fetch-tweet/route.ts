import { NextRequest, NextResponse } from 'next/server';
import { getXPost } from '@/lib/get-post';

export async function POST(request: NextRequest) {
  try {
    const { url, scrollTimes = 3 } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: '请提供推文URL' },
        { status: 400 }
      );
    }
    
    const result = await getXPost(url, { scrollTimes });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('获取推文失败:', error);
    return NextResponse.json(
      { error: error.message || '获取推文失败' },
      { status: 500 }
    );
  }
}