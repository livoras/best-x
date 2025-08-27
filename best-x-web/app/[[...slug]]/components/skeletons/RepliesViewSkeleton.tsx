'use client';

import React from 'react';

export default function RepliesViewSkeleton() {
  return (
    <div className="p-4 animate-pulse">
      <div className="bg-white rounded-t-lg px-4 py-3 border-b border-gray-200 shadow-sm">
        <div className="h-5 bg-gray-200 rounded w-24"/>
      </div>
      
      <div className="bg-white rounded-b-lg shadow-sm divide-y divide-gray-100">
        {[1, 2, 3, 4].map((item) => (
          <article key={item} className="px-4 py-4">
            <div className="flex gap-3">
              {/* Avatar */}
              <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0"/>
              
              <div className="flex-1 min-w-0">
                {/* Author info */}
                <div className="flex items-baseline gap-2 mb-2">
                  <div className="h-4 bg-gray-200 rounded w-24"/>
                  <div className="h-4 bg-gray-200 rounded w-20"/>
                  <div className="h-4 bg-gray-200 rounded w-16"/>
                </div>
                
                {/* Reply content */}
                <div className="space-y-1 mb-3">
                  <div className="h-4 bg-gray-200 rounded w-full"/>
                  <div className="h-4 bg-gray-200 rounded w-5/6"/>
                  {item === 2 && <div className="h-4 bg-gray-200 rounded w-3/4"/>}
                </div>
                
                {/* Media skeleton for some items */}
                {item === 3 && (
                  <div className="mt-3 h-40 bg-gray-200 rounded-2xl"/>
                )}
                
                {/* Interaction buttons */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 rounded"/>
                    <div className="h-3 bg-gray-200 rounded w-8"/>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 rounded"/>
                    <div className="h-3 bg-gray-200 rounded w-8"/>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-200 rounded"/>
                    <div className="h-3 bg-gray-200 rounded w-8"/>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}