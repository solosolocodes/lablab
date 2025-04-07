'use client';

import { useState, useEffect } from 'react';
import { usePreview } from '@/contexts/PreviewContext';
import ReactMarkdown from 'react-markdown';

export default function InstructionsStage() {
  const { currentStage, timeRemaining, goToNextStage } = usePreview();
  const [showNextButton, setShowNextButton] = useState(false);
  
  // When time is up, show the Next button
  useEffect(() => {
    if (timeRemaining === 0) {
      setShowNextButton(true);
    }
  }, [timeRemaining]);

  if (!currentStage || currentStage.type !== 'instructions') {
    return <div>Invalid stage type</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentStage.title}</h2>
        
        <div className="prose max-w-none">
          {currentStage.format === 'markdown' ? (
            <ReactMarkdown>{currentStage.content || ''}</ReactMarkdown>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: currentStage.content || '' }} />
          )}
        </div>
      </div>
      
      {showNextButton && (
        <div className="flex justify-center">
          <button
            onClick={goToNextStage}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium shadow-md transition-all"
          >
            Next
          </button>
        </div>
      )}
      
      {timeRemaining === 0 && (
        <div className="text-center mt-4 text-gray-500">
          <p>Auto-advancing in a few seconds...</p>
        </div>
      )}
    </div>
  );
}