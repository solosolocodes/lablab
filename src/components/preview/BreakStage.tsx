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
      // Automatically proceed after 8 seconds
      const timeout = setTimeout(() => {
        goToNextStage();
      }, 8000);
      
      return () => clearTimeout(timeout);
    }
  }, [timeRemaining, goToNextStage]);

  if (!currentStage || currentStage.type !== 'break') {
    return <div>Invalid stage type</div>;
  }

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

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
            <div className="mb-4 px-5 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 inline-block">
              Break time complete!
            </div>
            <button
              onClick={goToNextStage}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium shadow-md transition-all"
            >
              Continue
            </button>
            <p className="mt-3 text-sm text-gray-500">Automatically continuing in a few seconds...</p>
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm inline-block mb-4">
              <p className="text-gray-600 mb-1">Break time remaining:</p>
              <div className="text-3xl font-mono font-bold text-purple-700">
                {formatTime(timeRemaining)}
              </div>
            </div>
            <div className="mt-2">
              <p className="text-gray-600">Please wait until the timer reaches zero to continue.</p>
              <button
                disabled={true}
                className="mt-4 bg-gray-400 text-white px-6 py-3 rounded-lg cursor-not-allowed opacity-70 font-medium shadow-md"
              >
                Please wait...
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}