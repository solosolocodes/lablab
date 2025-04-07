import React from 'react';
import Link from 'next/link';
import { usePreview } from '@/contexts/PreviewContext';

export default function PreviewLayout({ 
  children,
  experimentId
}: { 
  children: React.ReactNode,
  experimentId: string
}) {
  const { progress, timeRemaining } = usePreview();
  
  // Format time remaining into minutes and seconds
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation and Time Bar */}
      <div className="bg-white border-b shadow-sm p-3 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Preview Mode</h1>
              <p className="text-sm text-gray-500">Experiment Stage</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-32 bg-gray-200 rounded-full h-2.5 mr-2">
                <div 
                  className="bg-purple-600 h-2.5 rounded-full" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-600">{progress}%</span>
            </div>
            
            <div className="text-center bg-gray-100 px-3 py-2 rounded-lg">
              <div className="text-xs text-gray-500">Remaining</div>
              <div className={`font-mono font-bold ${timeRemaining < 30 ? 'text-red-600' : 'text-gray-700'}`}>
                {formattedTime}
              </div>
            </div>
            
            <Link
              href={`/admin/experiments/${experimentId}/designer`}
              className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700 text-sm"
            >
              Exit Preview
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow">
        {children}
      </div>
    </div>
  );
}