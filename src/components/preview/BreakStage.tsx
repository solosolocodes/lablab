'use client';

import { useState, useEffect } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

export default function BreakStage() {
  const { currentStage, timeRemaining, goToNextStage } = usePreview();
  const [showNextButton, setShowNextButton] = useState(false);
  
  // Show next button when time expires
  useEffect(() => {
    if (timeRemaining === 0) {
      setShowNextButton(true);
      // Automatically proceed after 5 seconds
      const timeout = setTimeout(() => {
        goToNextStage();
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [timeRemaining, goToNextStage]);

  if (!currentStage || currentStage.type !== 'break') {
    return <div>Invalid stage type</div>;
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center max-w-xl mx-auto p-8 bg-white rounded-lg shadow-lg">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{currentStage.title}</h2>
        </div>
        
        <p className="text-xl text-gray-600 mb-6">
          {currentStage.message || 'Take a short break before continuing to the next stage.'}
        </p>
        
        {showNextButton ? (
          <div>
            <button
              onClick={goToNextStage}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium shadow-md transition-all"
            >
              Continue
            </button>
            <p className="mt-3 text-sm text-gray-500">Automatically continuing in a few seconds...</p>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-4 inline-block">
            <p className="text-gray-600">Break time remaining:</p>
            <div className="text-2xl font-mono font-bold text-gray-800">
              {Math.floor(timeRemaining / 60)}:{timeRemaining % 60 < 10 ? '0' : ''}{timeRemaining % 60}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}