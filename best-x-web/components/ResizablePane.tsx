'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';

interface ResizablePaneProps {
  leftPane: ReactNode;
  rightPane: ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  storageKey?: string;
}

export default function ResizablePane({
  leftPane,
  rightPane,
  defaultLeftWidth = 600,
  minLeftWidth = 400,
  maxLeftWidth = 800,
  storageKey = 'pane-width'
}: ResizablePaneProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 从 localStorage 加载保存的宽度
  useEffect(() => {
    const savedWidth = localStorage.getItem(storageKey);
    if (savedWidth) {
      const width = parseInt(savedWidth);
      if (width >= minLeftWidth && width <= maxLeftWidth) {
        setLeftWidth(width);
      }
    }
  }, [storageKey, minLeftWidth, maxLeftWidth]);

  // 保存宽度到 localStorage
  useEffect(() => {
    if (!isResizing) {
      localStorage.setItem(storageKey, leftWidth.toString());
    }
  }, [leftWidth, isResizing, storageKey]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };


  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = e.clientX - containerRect.left;
      
      if (newLeftWidth >= minLeftWidth && newLeftWidth <= maxLeftWidth) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, minLeftWidth, maxLeftWidth]);

  return (
    <div 
      ref={containerRef}
      className="flex flex-1 relative overflow-hidden"
      style={{ userSelect: isResizing ? 'none' : 'auto' }}
    >
      {/* 左侧面板 */}
      <div 
        style={{ width: `${leftWidth}px`, flexShrink: 0 }}
        className="overflow-y-auto border-r border-gray-200"
      >
        {leftPane}
      </div>

      {/* 拖动条 */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-transparent'
        }`}
        style={{ 
          left: `${leftWidth - 2}px`,
          zIndex: 10
        }}
      >
        {/* 增加拖动的热区 */}
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* 右侧面板 */}
      <div className="flex-1 overflow-y-auto bg-gray-50 min-w-0">
        {rightPane}
      </div>
    </div>
  );
}