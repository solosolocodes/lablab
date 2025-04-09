'use client';

import { useState, useEffect, useRef } from 'react';
import { useParticipant } from '@/contexts/ParticipantContext';

type BreakStageProps = {
  stage: {
    id: string;
    title: string;
    description: string;
    message?: string;
    durationSeconds: number;
  };
  onNext: () => void;
};

export default function BreakStage({ stage, onNext }: BreakStageProps) {
  const { isStageTransitioning, saveStageResponse } = useParticipant();
  const [timeRemaining, setTimeRemaining] = useState(stage.durationSeconds || 0);
  const [timerComplete, setTimerComplete] = useState(false);
  
  // Add ref to track component mount state
  const isMountedRef = useRef(true);
  
  // Effect to clean up when component unmounts
  useEffect(() => {
    // Set the mounted flag to true (it already is, but this is for clarity)
    isMountedRef.current = true;
    
    // Clean up function that runs when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const handleNext = async () => {
    // Don't proceed if component is unmounted
    if (!isMountedRef.current) return;
    
    try {
      // Mark this stage as completed with a "done" response
      await saveStageResponse(stage.id, 'break', 'done');
      
      // Only proceed if component is still mounted
      if (isMountedRef.current) {
        onNext();
      }
    } catch (error) {
      console.error('Error completing break stage:', error);
      // Still try to proceed if we encounter an error with saving the response
      if (isMountedRef.current) {
        onNext();
      }
    }
  };
  
  // Handle countdown timer
  useEffect(() => {
    // Don't start timer if there's no duration
    if (!stage.durationSeconds || stage.durationSeconds <= 0) {
      if (isMountedRef.current) {
        setTimerComplete(true);
      }
      return;
    }
    
    // Set initial time only if mounted
    if (isMountedRef.current) {
      setTimeRemaining(stage.durationSeconds);
    }
    
    // Create interval to decrement timer
    const interval = setInterval(() => {
      if (isMountedRef.current) {
        setTimeRemaining(prevTime => {
          if (prevTime <= 1) {
            clearInterval(interval);
            if (isMountedRef.current) {
              setTimerComplete(true);
            }
            return 0;
          }
          return prevTime - 1;
        });
      }
    }, 1000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [stage.durationSeconds]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  return (
    <div className="w-full p-4 bg-white rounded border shadow-sm">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-5 bg-gray-50 rounded border mb-5 text-center">
        <div className="text-gray-500 mb-3">BREAK</div>
        <p className="font-medium mb-3 text-lg">{stage.message || "Take a short break before continuing"}</p>
        
        {/* Timer section */}
        <div className="my-6">
          <div className="bg-white py-4 px-6 rounded-lg shadow-sm inline-block">
            <div className="text-sm text-gray-600 mb-1">Time remaining:</div>
            <div className="text-3xl font-mono font-bold text-purple-700">
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>
        
        {timerComplete ? (
          <p className="text-green-600 font-medium">Break time complete! You can now continue.</p>
        ) : (
          <p className="text-gray-600">Please wait until the timer reaches zero to continue.</p>
        )}
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={handleNext}
          disabled={isStageTransitioning || !timerComplete}
          className={`px-6 py-2 ${timerComplete ? 'bg-blue-500' : 'bg-gray-400 cursor-not-allowed'} text-white rounded ${isStageTransitioning ? 'opacity-50' : ''}`}
        >
          {timerComplete ? 'Continue' : 'Please wait...'}
        </button>
      </div>
    </div>
  );
}