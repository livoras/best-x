import { Metadata } from 'next';
import ExtractionClient from './client';

// 生成 SEO 元数据
export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}): Promise<Metadata> {
  const { id } = await params;
  
  try {
    const res = await fetch(`http://localhost:3001/api/extractions/${id}`, {
      next: { revalidate: 3600 } // 缓存1小时
    });
    
    if (!res.ok) {
      return {
        title: 'Best-X - Twitter内容提取',
        description: '提取和保存Twitter/X的高质量内容'
      };
    }
    
    const data = await res.json();
    const firstTweet = data.tweets?.[0];
    
    return {
      title: `${firstTweet?.author?.name || 'Unknown'}: ${firstTweet?.content?.text?.slice(0, 60) || ''}`,
      description: firstTweet?.content?.text?.slice(0, 160) || '查看Twitter/X推文内容',
      openGraph: {
        title: firstTweet?.content?.text?.slice(0, 60) || '',
        description: `Thread by ${firstTweet?.author?.name || 'Unknown'}`,
        images: firstTweet?.author?.avatar ? [firstTweet.author.avatar] : [],
      },
      twitter: {
        card: 'summary',
        creator: firstTweet?.author?.handle || '',
      }
    };
  } catch (err) {
    return {
      title: 'Best-X - Twitter内容提取',
      description: '提取和保存Twitter/X的高质量内容'
    };
  }
}

// 服务端组件 - 获取初始数据
export default async function ExtractionPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  
  // 服务端获取数据，支持 SEO
  let initialData = null;
  let error = null;
  
  try {
    const [tweetsRes, articleRes] = await Promise.all([
      fetch(`http://localhost:3001/api/extractions/${id}`, {
        next: { revalidate: 60 } // 缓存1分钟
      }),
      fetch(`http://localhost:3001/api/extractions/${id}/article`, {
        next: { revalidate: 60 }
      })
    ]);
    
    if (tweetsRes.ok) {
      const tweetsData = await tweetsRes.json();
      const articleData = articleRes.ok ? await articleRes.json() : null;
      
      initialData = {
        tweets: tweetsData.tweets || [],
        url: tweetsData.url || '',
        articleContent: articleData
      };
    } else {
      error = '加载失败';
    }
  } catch (err) {
    error = '加载失败';
  }
  
  // 将数据传递给客户端组件
  return <ExtractionClient id={id} initialData={initialData} error={error} />;
}