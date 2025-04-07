'use client';

import { useState, useEffect } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

// Interface for Scenario data from MongoDB
interface ScenarioData {
  id: string;
  name: string;
  description: string;
  rounds: number;
  roundDuration: number;
  [key: string]: unknown;
}

export default function ScenarioStage() {
  const { currentStage, goToNextStage } = usePreview();
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState(0);
  const [scenarioComplete, setScenarioComplete] = useState(false);
  const [scenarioData, setScenarioData] = useState<ScenarioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!currentStage || currentStage.type !== 'scenario') {
    return <div>Invalid stage type</div>;
  }
  
  // Fetch scenario data from MongoDB when the component mounts
  useEffect(() => {
    async function fetchScenarioData() {
      if (!currentStage.scenarioId) {
        setError("No scenario ID provided");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        console.log(`Fetching scenario data for ID: ${currentStage.scenarioId}`);
        
        const response = await fetch(`/api/scenarios/${currentStage.scenarioId}?preview=true`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch scenario: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Scenario data fetched:", data);
        setScenarioData(data);
        setCurrentRound(1); // Reset to first round when scenario loads
        
        // Reset timer with the actual duration from MongoDB
        if (data.roundDuration) {
          setRoundTimeRemaining(data.roundDuration);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching scenario data:", err);
        setError(err instanceof Error ? err.message : "Failed to load scenario data");
        setIsLoading(false);
      }
    }
    
    fetchScenarioData();
  }, [currentStage.scenarioId]);
  
  // Use the data from MongoDB, or fall back to the stage data if not available yet
  const totalRounds = scenarioData?.rounds || currentStage.rounds || 1;
  const roundDuration = scenarioData?.roundDuration || currentStage.roundDuration || 60;
  
  // Handle round timer - only start once we have the scenario data
  useEffect(() => {
    // Only initialize timer if we have scenario data and we're not in an error state
    if (isLoading || error || !scenarioData) {
      return;
    }
    
    console.log(`Starting timer with ${totalRounds} rounds and ${roundDuration} seconds per round`);
    // Initialize once scenarioData is loaded
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
  }, [currentStage.id, roundDuration, totalRounds, isLoading, error, scenarioData]); // Add dependencies
  
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

  // Handle loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Loading Scenario...</h2>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <p className="text-gray-600 mt-4">Fetching scenario data from database</p>
        </div>
      </div>
    );
  }
  
  // Handle error state
  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Scenario</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200 mb-4">
            <p className="text-red-700">
              Could not fetch scenario data from MongoDB. 
              This may be due to a connection issue or missing scenario in the database.
            </p>
          </div>
          <div className="text-center">
            <button
              onClick={goToNextStage}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium shadow-md transition-all"
            >
              Skip to Next Stage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {scenarioData?.name || currentStage.title}
        </h2>
        <p className="text-gray-600 mb-6">
          {scenarioData?.description || currentStage.description}
        </p>
        
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
              <h3 className="font-semibold text-blue-800">Scenario Details from MongoDB</h3>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Scenario ID:</span>
                  <span className="font-medium">{currentStage.scenarioId || 'Default'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Scenario Name:</span>
                  <span className="font-medium">{scenarioData?.name || 'Unknown'}</span>
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
                  <span className="font-medium">{totalRounds * roundDuration} seconds</span>
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