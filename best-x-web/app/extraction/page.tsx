'use client';

import Link from 'next/link';
import ResizablePane from '@/components/ResizablePane';
import { useQueue } from './QueueContext';

export default function ExtractionPage() {
  const { queueStatus } = useQueue();
  
  return (
    <ResizablePane
      rightPane={
        <div className="h-full flex flex-col">
          {/* 右面板顶部导航栏 */}
          <div className="px-6 py-3 border-b border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="flex items-center justify-end">
              <nav className="flex gap-4 items-center">
                <Link 
                  href="/extraction" 
                  className="text-sm font-medium text-blue-600 flex items-center border-b-2 border-blue-600 cursor-pointer"
                >
                  主页
                </Link>
                <Link 
                  href="/dashboard" 
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1.5 border-b-2 border-transparent cursor-pointer"
                >
                  控制台
                  {queueStatus.summary.processing > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                      {queueStatus.summary.processing}
                    </span>
                  )}
                </Link>
                <div className="w-px h-4 bg-gray-300 mx-2"></div>
                <Link
                  href="/extraction"
                  onClick={(e) => {
                    e.preventDefault();
                    const quickExtractBtn = document.querySelector('[data-quick-extract-trigger]') as HTMLButtonElement;
                    if (quickExtractBtn) {
                      quickExtractBtn.click();
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  快速提取
                </Link>
              </nav>
            </div>
          </div>
          
          {/* 空状态提示 */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                请选择历史记录
              </h3>
              <p className="text-sm text-gray-500">
                选择左侧的历史记录查看详情
              </p>
            </div>
          </div>
        </div>
      }
      leftPane={
        <div className="h-full flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h15m0 0l-3-3m3 3l-3 3m-13-3a6 6 0 1112 0 6 6 0 01-12 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              文章视图
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              选择左侧历史记录，查看连续推文的合并内容
            </p>
            <Link 
              href="/dashboard" 
              className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded-md transition-colors"
            >
              前往控制台
              <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      }
    />
  );
}