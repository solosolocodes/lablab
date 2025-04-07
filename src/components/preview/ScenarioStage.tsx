'use client';

import { useState, useEffect } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

export default function ScenarioStage() {
  const { currentStage, goToNextStage } = usePreview();
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState(0);
  const [scenarioComplete, setScenarioComplete] = useState(false);

  if (!currentStage || currentStage.type !== 'scenario') {
    return <div>Invalid stage type</div>;
  }

  const totalRounds = currentStage.rounds || 1;
  const roundDuration = currentStage.roundDuration || 60;
  
  // Handle round timer
  useEffect(() => {
    // Initialize on first load
    setCurrentRound(1);
    setRoundTimeRemaining(roundDuration);
    setScenarioComplete(false);
    
    // Create interval to decrement timer
    const interval = setInterval(() => {
      setRoundTimeRemaining(prevTime => {
        if (prevTime <= 1) {
          // Time for this round is up
          if (currentRound < totalRounds) {
            // Move to next round
            setCurrentRound(prev => prev + 1);
            return roundDuration; // Reset timer for next round
          } else {
            // All rounds complete
            clearInterval(interval);
            setScenarioComplete(true);
            return 0;
          }
        }
        return prevTime - 1;
      });
    }, 1000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [currentStage.id, roundDuration, totalRounds]); // Add currentStage.id to reset when stage changes
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  // Calculate progress percentage
  const progressPercentage = ((currentRound - 1) * 100 / totalRounds) + 
    (roundTimeRemaining === 0 ? 100 : (1 - roundTimeRemaining / roundDuration) * 100 / totalRounds);
  
  // Auto-advance after completion with delay
  useEffect(() => {
    if (scenarioComplete) {
      const timeout = setTimeout(() => {
        goToNextStage();
      }, 10000); // Auto-advance after 10 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [scenarioComplete, goToNextStage]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{currentStage.title}</h2>
        <p className="text-gray-600 mb-6">{currentStage.description}</p>
        
        {/* Round and Timer display */}
        <div className="mb-6 bg-blue-50 p-5 rounded-lg border border-blue-100">
          <div className="flex justify-between items-center mb-3">
            <div>
              <span className="font-medium text-blue-800">Round:</span>
              <span className="ml-2 text-2xl font-bold text-blue-900">{currentRound} of {totalRounds}</span>
            </div>
            <div>
              <span className="font-medium text-blue-800">Time Remaining:</span>
              <span className="ml-2 text-2xl font-mono font-bold text-blue-900">{formatTime(roundTimeRemaining)}</span>
            </div>
          </div>
          
          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mt-2">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-1000"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          
          {/* Status message */}
          <div className="mt-3 text-center">
            {scenarioComplete ? (
              <div className="bg-green-50 border border-green-200 rounded-md p-3 text-green-700 font-medium">
                All rounds completed! Proceeding to next stage shortly...
              </div>
            ) : (
              <p className="text-gray-600">
                {`${totalRounds - currentRound} ${totalRounds - currentRound === 1 ? 'round' : 'rounds'} remaining after this one`}
              </p>
            )}
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-3">Scenario Interface</h3>
              <div className="bg-gray-100 rounded-lg p-6 min-h-32 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-600 mb-2">Trading Interface Placeholder</p>
                  {scenarioComplete ? (
                    <p className="text-sm text-green-600 font-medium">
                      All rounds completed!
                    </p>
                  ) : (
                    <p className="text-sm text-blue-600">
                      Round {currentRound} of {totalRounds} in progress
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-blue-800">Scenario Details</h3>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Scenario ID:</span>
                  <span className="font-medium">{currentStage.scenarioId || 'Default'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Rounds:</span>
                  <span className="font-medium">{totalRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Round Duration:</span>
                  <span className="font-medium">{roundDuration} seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Duration:</span>
                  <span className="font-medium">{currentStage.durationSeconds} seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Status:</span>
                  <span className="font-medium text-blue-700">{scenarioComplete ? 'Complete' : 'In Progress'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-6">
          {scenarioComplete ? (
            <button
              onClick={goToNextStage}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium shadow-md transition-all"
            >
              Continue to Next Stage
            </button>
          ) : (
            <button
              disabled={true}
              className="bg-gray-400 text-white px-6 py-3 rounded-lg cursor-not-allowed opacity-70 font-medium shadow-md"
            >
              Please complete all rounds...
            </button>
          )}
        </div>
      </div>
    </div>
  );
}