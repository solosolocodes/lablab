'use client';

import { useEffect, useState } from 'react';
import { useParticipant } from '@/contexts/ParticipantContext';
import InstructionsStage from './InstructionsStage';
import BreakStage from './BreakStage';
import ScenarioStage from './ScenarioStage';
import SurveyStage from './SurveyStage';
import { toast } from 'react-hot-toast';

interface ExperimentRunnerProps {
  experimentId: string;
  onComplete?: () => void;
}

export default function ExperimentRunner({ experimentId, onComplete }: ExperimentRunnerProps) {
  const { 
    experiment, 
    progress, 
    currentStageIndex, 
    currentStage,
    loadExperiment, 
    goToNextStage, 
    completeExperiment 
  } = useParticipant();
  
  const [viewMode, setViewMode] = useState<'welcome' | 'experiment' | 'thankyou'>('welcome');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load experiment data
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);
        await loadExperiment(experimentId);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading experiment:', err);
        setError('Failed to load experiment data. Please try again later.');
        setIsLoading(false);
      }
    }
    
    if (experimentId) {
      loadData();
    }
  }, [experimentId, loadExperiment]);
  
  // Handle the Next button click on the welcome screen
  const handleWelcomeNext = () => {
    setViewMode('experiment');
  };
  
  // Handle stage navigation
  const handleStageNext = () => {
    if (!experiment) return;
    
    // Check if this is the last stage
    if (currentStageIndex >= experiment.stages.length - 1) {
      // Complete the experiment if this is the last stage
      completeExperiment().then(() => {
        setViewMode('thankyou');
        toast.success('Experiment completed!');
        
        // If an onComplete callback was provided, call it
        if (onComplete) {
          onComplete();
        }
      });
    } else {
      // Otherwise, go to the next stage
      goToNextStage();
    }
  };
  
  // Handle exit button
  const handleExit = () => {
    window.location.href = '/participant/dashboard';
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="w-full p-8 bg-white rounded shadow text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading experiment...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="p-4">
        <div className="w-full p-8 bg-white rounded shadow text-center">
          <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold mb-2">Error Loading Experiment</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={handleExit}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  // No experiment data loaded
  if (!experiment || !progress) {
    return (
      <div className="p-4">
        <div className="w-full p-8 bg-white rounded shadow text-center">
          <h3 className="text-lg font-bold mb-2">Experiment Not Found</h3>
          <p className="text-gray-600 mb-4">The experiment you're looking for does not exist or you do not have access to it.</p>
          <button 
            onClick={handleExit}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  // Thank You screen view
  if (viewMode === 'thankyou' || progress.status === 'completed') {
    return (
      <div className="p-4">
        <div className="w-full p-8 bg-white rounded shadow text-center">
          <div className="text-green-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold mb-2">Thank You!</h3>
          <p className="text-lg text-gray-600 mb-6">You have successfully completed the experiment.</p>
          <p className="text-gray-500 mb-8">Your responses have been recorded.</p>
          <button 
            onClick={handleExit}
            className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  // Welcome screen view with stages overview
  if (viewMode === 'welcome') {
    return (
      <div className="p-4">
        <div className="w-full p-6 bg-white rounded shadow">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold mb-3">{experiment.name}</h3>
            <p className="text-gray-600 mb-2">{experiment.description}</p>
            <div className="text-gray-600 bg-blue-50 p-2 rounded-md inline-block">
              <p>This experiment consists of {experiment.stages.length} stages.</p>
            </div>
          </div>

          {experiment.stages.length > 0 && (
            <div className="bg-gray-50 rounded border p-6 mb-6">
              <h4 className="font-medium mb-4 text-lg">What to expect:</h4>
              <div className="space-y-2">
                {experiment.stages.map((stage, index) => (
                  <div key={stage.id} className="flex items-center py-2 border-b border-gray-100 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 text-sm font-medium text-blue-700">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{stage.title}</p>
                      <p className="text-sm text-gray-500">{stage.type}</p>
                    </div>
                    <div className="text-sm px-2 py-1 rounded bg-gray-100 text-gray-700">
                      {stage.durationSeconds && stage.durationSeconds > 0 
                        ? `${Math.ceil(stage.durationSeconds / 60)} min` 
                        : 'No time limit'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="text-center p-4 bg-blue-50 rounded mb-6">
            <p className="text-gray-700 mb-3">
              Your progress will be automatically saved as you complete each stage.
              You can return to this experiment later if you need to take a break.
            </p>
            {progress.status === 'in_progress' && (
              <p className="text-blue-700 font-medium">
                You've already started this experiment. You'll continue from where you left off.
              </p>
            )}
          </div>
          
          <div className="text-center">
            <button 
              onClick={handleWelcomeNext}
              className="px-8 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-lg font-medium"
            >
              Begin Experiment
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Experiment stage view
  if (viewMode === 'experiment' && experiment.stages.length > 0) {
    if (!currentStage) return (
      <div className="p-4 text-center">
        <p>No current stage found. Please try refreshing the page.</p>
      </div>
    );
    
    return (
      <div className="p-4">
        <div className="flex justify-between items-center w-full mb-4 bg-white px-4 py-2 rounded shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Stage {currentStageIndex + 1} of {experiment.stages.length}</p>
          </div>
          <div>
            <p className="text-sm font-medium">{experiment.name}</p>
          </div>
          <div>
            {/* Simple progress text - easier to render than animated progress bar */}
            <span className="text-xs text-gray-600">
              {Math.round(((currentStageIndex + 1) / experiment.stages.length) * 100)}% complete
            </span>
          </div>
        </div>
        
        <div className="w-full">
          {currentStage.type === 'instructions' && (
            <InstructionsStage 
              stage={currentStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {currentStage.type === 'break' && (
            <BreakStage 
              stage={currentStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {currentStage.type === 'scenario' && (
            <ScenarioStage 
              stage={currentStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {currentStage.type === 'survey' && (
            <SurveyStage 
              stage={currentStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {!['instructions', 'break', 'scenario', 'survey'].includes(currentStage.type) && (
            <div className="w-full p-4 bg-white rounded border shadow-sm">
              <div className="mb-4 pb-3 border-b border-gray-200">
                <h3 className="text-xl font-bold mb-2">{currentStage.title}</h3>
                <p className="text-gray-600">{currentStage.description}</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded border mb-5">
                <p className="font-medium">Unknown stage type: {currentStage.type}</p>
                <p className="mt-2 text-gray-600">This stage type is not recognized and is displayed as a placeholder.</p>
              </div>
              
              <div className="flex justify-center">
                <button 
                  onClick={handleStageNext}
                  className="px-6 py-2 bg-blue-500 text-white rounded"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return null;
}