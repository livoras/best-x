'use client';

import { useState } from 'react';
import type { Tweet } from '@/types/tweet';

export default function Home() {
  const [url, setUrl] = useState('');
  const [scrollTimes, setScrollTimes] = useState(3);
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTweets = async () => {
    if (!url) {
      setError('请输入推文URL');
      return;
    }

    setLoading(true);
    setError('');
    setTweets([]);

    try {
      const res = await fetch('http://localhost:3001/api/fetch-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, scrollTimes })
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || '获取失败');
      }

      setTweets(data.tweets || []);
    } catch (err: any) {
      setError(err.message || '获取推文失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">X/Twitter 数据提取</h1>
        <p className="text-gray-600">输入推文链接，提取完整的推文数据和评论</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">推文URL</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://x.com/user/status/123456789"
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              滚动次数 (加载更多评论): {scrollTimes}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={scrollTimes}
              onChange={(e) => setScrollTimes(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <button
            onClick={fetchTweets}
            disabled={loading}
            className={`px-6 py-3 rounded-lg font-medium text-white transition-colors ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {loading ? '正在获取...' : '获取推文'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {tweets.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold mb-4">
            提取到 {tweets.length} 条推文
          </h2>
          
          {tweets.map((tweet, index) => (
            <div 
              key={index}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start gap-4">
                <img 
                  src={tweet.author.avatar} 
                  alt={tweet.author.name}
                  className="w-12 h-12 rounded-full"
                />
                
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-bold text-lg">{tweet.author.name}</span>
                    <span className="text-gray-500">{tweet.author.handle}</span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500 text-sm">{tweet.time}</span>
                  </div>
                  
                  <p className="text-gray-800 mb-3 whitespace-pre-wrap">
                    {tweet.content.text}
                    {tweet.content.hasMore && (
                      <span className="text-blue-500 ml-1">...显示更多</span>
                    )}
                  </p>
                  
                  {tweet.media.images.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {tweet.media.images.map((img, i) => (
                        <img 
                          key={i}
                          src={img} 
                          alt=""
                          className="rounded-lg w-full object-cover"
                        />
                      ))}
                    </div>
                  )}
                  
                  {tweet.media.video && (
                    <div className="mb-3 relative">
                      <img 
                        src={tweet.media.video.thumbnail} 
                        alt="视频"
                        className="rounded-lg w-full"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black bg-opacity-50 rounded-full p-3">
                          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-6 text-gray-500 text-sm">
                    <span>💬 {tweet.stats.replies}</span>
                    <span>🔁 {tweet.stats.retweets}</span>
                    <span>❤️ {tweet.stats.likes}</span>
                    <span>📑 {tweet.stats.bookmarks}</span>
                    <span>👁 {tweet.stats.views}</span>
                  </div>
                  
                  {tweet.statusLink && (
                    <a 
                      href={`https://x.com${tweet.statusLink}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-3 text-blue-500 hover:underline text-sm"
                    >
                      查看原推文 →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}