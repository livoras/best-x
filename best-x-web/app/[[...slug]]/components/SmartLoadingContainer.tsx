'use client';

import React, { useEffect, useState, ReactNode } from 'react';

interface SmartLoadingContainerProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  minHeight?: string;
  className?: string;
}

export default function SmartLoadingContainer({ 
  loading, 
  skeleton, 
  children,
  minHeight = "600px",
  className = ""
}: SmartLoadingContainerProps) {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    if (loading) {
      // 开始加载时立即显示骨架屏
      setShowSkeleton(true);
      setIsTransitioning(false);
    } else if (showSkeleton) {
      // 加载完成时，开始过渡
      setIsTransitioning(true);
      
      // 延迟隐藏骨架屏，让内容有时间渲染
      const timer = setTimeout(() => {
        setShowSkeleton(false);
        setIsTransitioning(false);
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [loading, showSkeleton]);
  
  return (
    <div 
      className={`relative ${className}`} 
      style={{ minHeight }}
    >
      {/* 骨架屏层 - 始终在DOM中但通过opacity控制可见性 */}
      <div 
        className={`
          transition-opacity duration-300 ease-in-out
          ${showSkeleton && !isTransitioning ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          ${showSkeleton ? '' : 'absolute inset-0'}
        `}
        aria-hidden={!showSkeleton}
      >
        {skeleton}
      </div>
      
      {/* 内容层 - 始终渲染但通过opacity控制可见性 */}
      {children && (
        <div 
          className={`
            transition-opacity duration-300 ease-in-out
            ${showSkeleton && !isTransitioning ? 'absolute inset-0 opacity-0' : 'opacity-100'}
            ${isTransitioning ? 'opacity-50' : ''}
          `}
        >
          {children}
        </div>
      )}
      
      {/* 可选：加载时的额外覆盖层，提供更平滑的过渡效果 */}
      {isTransitioning && (
        <div 
          className="absolute inset-0 bg-white/30 pointer-events-none z-10"
          style={{
            animation: 'fadeOut 300ms ease-in-out forwards'
          }}
        />
      )}
    </div>
  );
}