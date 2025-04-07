'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PreviewProvider, usePreview } from '@/contexts/PreviewContext';

// Define basic interfaces for stage types
// Question interface to replace any type
interface Question {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface Stage {
  id: string;
  type: string;
  title: string;
  description: string;
  content?: string;
  format?: string;
  message?: string;
  scenarioId?: string;
  rounds?: number;
  roundDuration?: number;
  questions?: Question[];
}

interface InstructionsStage extends Stage {
  type: 'instructions';
  content: string;
  format?: string;
}

// Type guard function to check if a stage is an instructions stage
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isInstructionsStage(stage: Stage): stage is InstructionsStage {
  return stage.type === 'instructions' && typeof stage.content === 'string';
}

function InstructionsView({ stage, onNext }: { stage: InstructionsStage; onNext: () => void }) {
  const { isStageTransitioning } = usePreview();
  // Enhanced markdown-like rendering function
  const renderContent = (content: string) => {
    if (!content) return '<p>No content available</p>';
    
    // Replace markdown headers
    let formattedContent = content
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-3 mb-2">$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4 class="text-md font-semibold mt-2 mb-1">$1</h4>');
    
    // Replace lists
    formattedContent = formattedContent.replace(/^(\d+)\. (.*)$/gm, '<li class="ml-5 list-decimal mb-1">$2</li>');
    formattedContent = formattedContent.replace(/^\* (.*)$/gm, '<li class="ml-5 list-disc mb-1">$1</li>');
    
    // Replace line breaks with paragraphs
    const paragraphs = formattedContent
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Process each paragraph
    const processedParagraphs = paragraphs.map(p => {
      if (p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<h4')) {
        return p; // Don't wrap headers
      } else if (p.startsWith('<li')) {
        return `<ul class="my-2">${p}</ul>`; // Wrap list items
      } else {
        return `<p class="mb-2">${p}</p>`; // Wrap normal paragraphs
      }
    }).join('');
    
    return processedParagraphs;
  };
  
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div 
        className="p-4 bg-gray-50 rounded border mb-5 prose max-w-none"
        dangerouslySetInnerHTML={{ __html: renderContent(stage.content) }}
      />
      
      <div className="flex justify-center">
        <button 
          onClick={onNext}
          disabled={isStageTransitioning}
          className={`px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${isStageTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function BreakStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning } = usePreview();
  const [timeRemaining, setTimeRemaining] = useState(stage.durationSeconds || 0);
  const [timerComplete, setTimerComplete] = useState(false);
  
  // Handle countdown timer
  useEffect(() => {
    // Don't start timer if there's no duration
    if (!stage.durationSeconds || stage.durationSeconds <= 0) {
      setTimerComplete(true);
      return;
    }
    
    // Set initial time
    setTimeRemaining(stage.durationSeconds);
    
    // Create interval to decrement timer
    const interval = setInterval(() => {
      setTimeRemaining(prevTime => {
        if (prevTime <= 1) {
          clearInterval(interval);
          setTimerComplete(true);
          return 0;
        }
        return prevTime - 1;
      });
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
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
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
          onClick={onNext}
          disabled={isStageTransitioning || !timerComplete}
          className={`px-6 py-2 ${timerComplete ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'} text-white rounded transition-colors ${isStageTransitioning ? 'opacity-50' : ''}`}
        >
          {timerComplete ? 'Continue' : 'Please wait...'}
        </button>
      </div>
    </div>
  );
}

function ScenarioStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning } = usePreview();
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState(stage.roundDuration || 60);
  const [scenarioComplete, setScenarioComplete] = useState(false);
  const totalRounds = stage.rounds || 1;
  
  // Handle round timer
  useEffect(() => {
    // Reset state if it's a new scenario
    setCurrentRound(1);
    setRoundTimeRemaining(stage.roundDuration || 60);
    setScenarioComplete(false);
    
    // Don't start timer if no rounds or duration
    if (!stage.rounds || !stage.roundDuration) {
      setScenarioComplete(true);
      return;
    }
    
    // Create interval to decrement timer
    const interval = setInterval(() => {
      setRoundTimeRemaining(prevTime => {
        if (prevTime <= 1) {
          // Time for this round is up
          if (currentRound < totalRounds) {
            // Move to next round
            setCurrentRound(prev => prev + 1);
            return stage.roundDuration || 60; // Reset timer for next round
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
  }, [stage.rounds, stage.roundDuration, totalRounds]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  // Calculate progress percentage
  const progressPercentage = ((currentRound - 1) * 100 / totalRounds) + 
    (roundTimeRemaining === 0 ? 100 : (1 - roundTimeRemaining / (stage.roundDuration || 60)) * 100 / totalRounds);
  
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      {/* Round and Timer display */}
      <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
        <div className="flex justify-between items-center mb-2">
          <div>
            <span className="font-medium text-blue-800">Round:</span>
            <span className="ml-2 text-xl font-bold text-blue-900">{currentRound} of {totalRounds}</span>
          </div>
          <div>
            <span className="font-medium text-blue-800">Time Remaining:</span>
            <span className="ml-2 text-xl font-mono font-bold text-blue-900">{formatTime(roundTimeRemaining)}</span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
          <div 
            className="bg-blue-600 h-2.5 rounded-full" 
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        
        {/* Status message */}
        <div className="mt-2 text-center text-sm">
          {scenarioComplete ? (
            <p className="text-green-600 font-medium">All rounds completed!</p>
          ) : (
            <p className="text-gray-600">
              {`${totalRounds - currentRound} ${totalRounds - currentRound === 1 ? 'round' : 'rounds'} remaining after this one`}
            </p>
          )}
        </div>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <div className="text-center py-4">
          <p className="font-medium mb-3">Scenario Simulation</p>
          <div className="border border-gray-300 rounded p-4 mb-4 bg-white">
            <div className="bg-gray-200 h-32 rounded flex items-center justify-center mb-4">
              <div className="text-center">
                <p className="text-gray-600 mb-2">Scenario Interface Placeholder</p>
                <p className="text-sm text-gray-500">
                  Round {currentRound} of {totalRounds} in progress
                </p>
              </div>
            </div>
            <div className="flex justify-between border-t pt-3">
              <div>
                <p className="text-sm text-gray-700">Scenario ID: {stage.scenarioId || 'Default'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-700">Duration: {stage.roundDuration || 60}s per round</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">In the actual experiment, participants will interact with the scenario here.</p>
        </div>
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={onNext}
          disabled={isStageTransitioning || !scenarioComplete}
          className={`px-6 py-2 ${scenarioComplete ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'} text-white rounded transition-colors ${isStageTransitioning ? 'opacity-50' : ''}`}
        >
          {scenarioComplete ? 'Continue' : 'Please complete all rounds...'}
        </button>
      </div>
    </div>
  );
}

function SurveyStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning } = usePreview();
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <p className="font-medium mb-3">Survey Questions</p>
        
        {stage.questions && stage.questions.length > 0 ? (
          <div>
            {stage.questions.map((q: Question, i: number) => (
              <div key={q.id || i} className="mb-4 p-3 bg-white rounded border">
                <p className="font-medium">
                  {i+1}. {q.text} {q.required && <span className="text-red-500">*</span>}
                </p>
                <p className="text-sm text-gray-500 mt-1">Type: {q.type}</p>
                
                {q.type === 'multipleChoice' && q.options && (
                  <div className="mt-2 pl-4">
                    {q.options.map((option: string, idx: number) => (
                      <div key={idx} className="flex items-center mt-1">
                        <span className="w-4 h-4 border border-gray-300 rounded-full mr-2"></span>
                        <span className="text-gray-700">{option}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No questions defined for this survey.</p>
        )}
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={onNext}
          disabled={isStageTransitioning}
          className={`px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${isStageTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function PlaceholderStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning } = usePreview();
  // Render different stage types with appropriate placeholders
  if (stage.type === 'break') {
    return <BreakStage stage={stage} onNext={onNext} />;
  }
  
  if (stage.type === 'scenario') {
    return <ScenarioStage stage={stage} onNext={onNext} />;
  }
  
  if (stage.type === 'survey') {
    return <SurveyStage stage={stage} onNext={onNext} />;
  }
  
  // Default placeholder for unknown stage types
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <p className="font-medium">Unknown stage type: {stage.type}</p>
        <p className="mt-2 text-gray-600">This stage type is not recognized and is displayed as a placeholder.</p>
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={onNext}
          disabled={isStageTransitioning}
          className={`px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${isStageTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function SimplePreviewContent() {
  const { experiment, loadExperiment } = usePreview();
  const [viewMode, setViewMode] = useState<'welcome' | 'experiment' | 'thankyou'>('welcome');
  const [currentStageNumber, setCurrentStageNumber] = useState(0);
  const params = useParams();
  const experimentId = params.id as string;

  useEffect(() => {
    if (experimentId) {
      loadExperiment(experimentId);
    }
  }, [experimentId, loadExperiment]);

  // Handle the Next button click on the welcome screen
  const handleWelcomeNext = () => {
    setViewMode('experiment');
  };
  
  // Handle Next button click for stage navigation
  const handleStageNext = () => {
    if (!experiment) return;
    
    if (currentStageNumber < experiment.stages.length - 1) {
      setCurrentStageNumber(prev => prev + 1);
    } else {
      setViewMode('thankyou');
    }
  };
  
  // Handle exit button
  const handleExit = () => {
    window.location.href = `/admin/experiments/${experimentId}/designer`;
  };
  
  // No experiment loaded yet
  if (!experiment) {
    return (
      <div className="p-4">
        <div className="max-w-2xl mx-auto p-4 bg-white rounded border text-center">
          <p>Loading experiment...</p>
        </div>
      </div>
    );
  }
  
  // Thank You screen view
  if (viewMode === 'thankyou') {
    return (
      <div className="p-4">
        <div className="max-w-2xl mx-auto p-4 bg-white rounded border text-center">
          <h3 className="text-lg font-bold mb-4">Thank You</h3>
          <p className="mb-6">You have completed all stages of this experiment.</p>
          <button 
            onClick={handleExit}
            className="px-6 py-2 bg-blue-500 text-white rounded"
          >
            Exit
          </button>
        </div>
      </div>
    );
  }
  
  // Welcome screen view with stages overview
  if (viewMode === 'welcome') {
    return (
      <div className="p-4">
        <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
          <div className="text-center mb-5">
            <h3 className="text-xl font-bold mb-2">Welcome to {experiment.name}</h3>
            <p className="text-gray-600 mb-2">{experiment.description || ''}</p>
            <div className="text-gray-600">
              <p>This experiment consists of {experiment.stages.length} stages.</p>
            </div>
          </div>

          {experiment.stages.length > 0 && (
            <div className="bg-gray-50 rounded border p-4 mb-5">
              <h4 className="font-medium mb-2">Stages Overview:</h4>
              <div className="space-y-1">
                {[...experiment.stages]
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((stage, index) => (
                    <div key={stage.id} className="flex items-center py-1 border-b border-gray-100 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 text-sm font-medium text-blue-700">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{stage.title}</p>
                        <p className="text-xs text-gray-500">{stage.type}</p>
                      </div>
                      <div className="text-sm text-gray-500">
                        {stage.durationSeconds > 0 ? `${stage.durationSeconds} sec` : 'No time limit'}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          
          <div className="text-center">
            <button 
              onClick={handleWelcomeNext}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
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
    const stage = experiment.stages[currentStageNumber];
    if (!stage) return null;
    
    return (
      <div className="p-4">
        <div className="flex justify-between items-center max-w-2xl mx-auto mb-4">
          <div>
            <p className="text-sm text-gray-500">Stage {currentStageNumber + 1} of {experiment.stages.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Experiment: {experiment.name}</p>
          </div>
        </div>
        
        <div className="max-w-2xl mx-auto">
          {stage.type === 'instructions' && 'content' in stage && (
            <InstructionsView 
              stage={stage as unknown as InstructionsStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {stage.type === 'break' && (
            <BreakStage 
              stage={stage} 
              onNext={handleStageNext} 
            />
          )}
          
          {stage.type === 'scenario' && (
            <ScenarioStage 
              stage={stage} 
              onNext={handleStageNext} 
            />
          )}
          
          {stage.type === 'survey' && (
            <SurveyStage 
              stage={stage} 
              onNext={handleStageNext} 
            />
          )}
          
          {!['instructions', 'break', 'scenario', 'survey'].includes(stage.type) && (
            <PlaceholderStage 
              stage={stage} 
              onNext={handleStageNext} 
            />
          )}
        </div>
      </div>
    );
  }
  
  return null;
}

export default function SimplifiedPreviewPage() {
  return (
    <PreviewProvider>
      <SimplePreviewContent />
    </PreviewProvider>
  );
}