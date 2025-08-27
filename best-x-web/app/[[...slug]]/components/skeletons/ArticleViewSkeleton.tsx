'use client';

import React from 'react';

export default function ArticleViewSkeleton() {
  return (
    <article className="bg-white rounded-xl border border-gray-100 p-6 animate-pulse">
      {/* Author Header Skeleton */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <div className="w-12 h-12 bg-gray-200 rounded-full"/>
        <div className="flex-1">
          <div className="h-5 bg-gray-200 rounded w-32 mb-2"/>
          <div className="h-4 bg-gray-200 rounded w-24"/>
        </div>
        <div className="ml-auto text-right">
          <div className="h-4 bg-gray-200 rounded w-24 ml-auto mb-1"/>
          <div className="h-3 bg-gray-200 rounded w-20 ml-auto"/>
        </div>
      </div>

      {/* Tweet Content Skeletons */}
      <div className="space-y-6">
        {[1, 2, 3].map((item) => (
          <div key={item} className={item > 1 ? "pt-4 border-t border-gray-100" : ""}>
            {/* Text content skeleton */}
            <div className="space-y-2 mb-3">
              <div className="h-4 bg-gray-200 rounded w-full"/>
              <div className="h-4 bg-gray-200 rounded w-11/12"/>
              <div className="h-4 bg-gray-200 rounded w-10/12"/>
              {item === 1 && (
                <>
                  <div className="h-4 bg-gray-200 rounded w-full"/>
                  <div className="h-4 bg-gray-200 rounded w-9/12"/>
                </>
              )}
            </div>
            
            {/* Media skeleton (only for second item) */}
            {item === 2 && (
              <div className="mt-3 grid gap-2 grid-cols-2">
                <div className="h-48 bg-gray-200 rounded-lg"/>
                <div className="h-48 bg-gray-200 rounded-lg"/>
              </div>
            )}
            
            {/* Twitter Card skeleton (only for third item) */}
            {item === 3 && (
              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                <div className="h-32 bg-gray-200"/>
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-24"/>
                  <div className="h-4 bg-gray-200 rounded w-full"/>
                  <div className="h-3 bg-gray-200 rounded w-3/4"/>
                </div>
              </div>
            )}
            
            {/* Time stamp skeleton for multiple tweets */}
            {item > 1 && (
              <div className="h-3 bg-gray-200 rounded w-20 mt-2"/>
            )}
          </div>
        ))}
      </div>

      {/* Bottom link skeleton */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex items-center gap-3">
        <div className="h-4 bg-gray-200 rounded w-24"/>
        <div className="h-4 bg-gray-200 rounded w-20"/>
      </div>
    </article>
  );
}