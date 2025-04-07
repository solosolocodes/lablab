'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PreviewProvider, usePreview } from '@/contexts/PreviewContext';
import InstructionsStage from '@/components/preview/InstructionsStage';
import ScenarioStage from '@/components/preview/ScenarioStage';
import SurveyStage from '@/components/preview/SurveyStage';
import BreakStage from '@/components/preview/BreakStage';

function ExperimentPreviewContent() {
  const { 
    experiment, 
    currentStage, 
    timeRemaining, 
    loadExperiment, 
    isLoading, 
    error,
    progress
  } = usePreview();
  
  // Add force timeout for loading state to prevent UI from getting stuck
  const [forceTimeout, setForceTimeout] = useState(false);
  
  const params = useParams();
  const experimentId = params.id as string;

  useEffect(() => {
    if (experimentId) {
      console.log(`Preview page: Loading experiment: ${experimentId}`);
      loadExperiment(experimentId);
      
      // Set a timeout to force-exit loading state after 10 seconds
      const timeoutId = setTimeout(() => {
        console.log('Preview page: Force timeout triggered');
        setForceTimeout(true);
      }, 10000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [experimentId, loadExperiment]);

  // Debug logging
  useEffect(() => {
    console.log('Preview page state:', {
      isLoading,
      hasError: !!error,
      hasExperiment: !!experiment,
      hasCurrentStage: !!currentStage
    });
  }, [isLoading, error, experiment, currentStage]);

  if (isLoading && !forceTimeout) {
    console.log('Rendering loading state...');
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Loading Experiment...</h2>
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-red-50 rounded-lg border border-red-200">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <Link 
            href="/admin/experiments" 
            className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Return to Experiments
          </Link>
        </div>
      </div>
    );
  }

  // Forced show content even if loading is stuck
  if (forceTimeout && !error) {
    console.log('Force timeout triggered - showing content anyway');
    
    if (!experiment || !currentStage) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center max-w-md mx-auto p-6 bg-yellow-50 rounded-lg border border-yellow-200">
            <h2 className="text-xl font-semibold text-yellow-600 mb-2">Loading Timeout</h2>
            <p className="text-gray-700 mb-4">The experiment is taking too long to load. Please try refreshing the page or check your connection.</p>
            <div className="flex space-x-4 justify-center">
              <button 
                onClick={() => window.location.reload()}
                className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                Refresh Page
              </button>
              <Link 
                href={`/admin/experiments/${experimentId}/designer`}
                className="inline-block px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Go to Designer
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  if (!experiment || !currentStage) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6 bg-yellow-50 rounded-lg border border-yellow-200">
          <h2 className="text-xl font-semibold text-yellow-600 mb-2">No Stages Found</h2>
          <p className="text-gray-700 mb-4">This experiment doesn&apos;t have any stages to preview. Please add stages in the experiment designer.</p>
          <Link 
            href={`/admin/experiments/${experimentId}/designer`}
            className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Go to Designer
          </Link>
        </div>
      </div>
    );
  }

  // Format time remaining into minutes and seconds
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation and Time Bar */}
      <div className="bg-white border-b shadow-sm p-3 sticky top-0 z-10">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{experiment.name}</h1>
            <p className="text-sm text-gray-500">Preview Mode</p>
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
              <div className="text-sm text-gray-500">Time Remaining</div>
              <div className={`font-mono text-lg font-bold ${timeRemaining < 30 ? 'text-red-600' : 'text-gray-700'}`}>
                {formattedTime}
              </div>
            </div>
            
            <Link
              href={`/admin/experiments/${experimentId}/designer`}
              className="bg-purple-600 text-white px-3 py-2 rounded hover:bg-purple-700"
            >
              Exit Preview
            </Link>
          </div>
        </div>
      </div>

      {/* Current Stage */}
      <div className="flex-grow">
        {currentStage.type === 'instructions' && <InstructionsStage />}
        {currentStage.type === 'scenario' && <ScenarioStage />}
        {currentStage.type === 'survey' && <SurveyStage />}
        {currentStage.type === 'break' && <BreakStage />}
      </div>
    </div>
  );
}

export default function ExperimentPreviewPage() {
  return (
    <PreviewProvider>
      <ExperimentPreviewContent />
    </PreviewProvider>
  );
}