'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PreviewProvider, usePreview } from '@/contexts/PreviewContext';

// Define basic interfaces for stage types
interface Stage {
  id: string;
  type: string;
  title: string;
  description: string;
  content?: string;
  format?: string;
  message?: string;
  scenarioId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  questions?: Array<any>;
}

interface InstructionsStage extends Stage {
  type: 'instructions';
  content: string;
  format?: string;
}

// Type guard function to check if a stage is an instructions stage
function isInstructionsStage(stage: Stage): stage is InstructionsStage {
  return stage.type === 'instructions' && typeof stage.content === 'string';
}

function InstructionsView({ stage, onNext }: { stage: InstructionsStage; onNext: () => void }) {
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
          className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function BreakStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-5 bg-gray-50 rounded border mb-5 text-center">
        <div className="text-gray-500 mb-3">BREAK</div>
        <p className="font-medium mb-3 text-lg">{stage.message || "Take a short break before continuing"}</p>
        <p className="text-gray-600">When you&apos;re ready, click Continue to proceed to the next stage.</p>
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={onNext}
          className="px-6 py-2 bg-blue-500 text-white rounded"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function ScenarioStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <div className="text-center py-4">
          <p className="font-medium mb-3">Scenario Simulation</p>
          <div className="border border-gray-300 rounded p-4 mb-4 bg-white">
            <div className="bg-gray-200 h-20 rounded flex items-center justify-center mb-4">
              <p className="text-gray-600">Scenario Interface Placeholder</p>
            </div>
            <div className="flex justify-between border-t pt-3">
              <div>
                <p className="text-sm text-gray-700">Scenario ID: {stage.scenarioId || 'Default'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-700">Rounds: {stage.rounds || '1'}</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">In the actual experiment, participants will interact with the scenario here.</p>
        </div>
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={onNext}
          className="px-6 py-2 bg-blue-500 text-white rounded"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function SurveyStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
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
            {stage.questions.map((q, i) => (
              <div key={q.id || i} className="mb-4 p-3 bg-white rounded border">
                <p className="font-medium">
                  {i+1}. {q.text} {q.required && <span className="text-red-500">*</span>}
                </p>
                <p className="text-sm text-gray-500 mt-1">Type: {q.type}</p>
                
                {q.type === 'multipleChoice' && q.options && (
                  <div className="mt-2 pl-4">
                    {q.options.map((option, idx) => (
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
          className="px-6 py-2 bg-blue-500 text-white rounded"
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function PlaceholderStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
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
          className="px-6 py-2 bg-blue-500 text-white rounded"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function SimplePreviewContent() {
  const { experiment, currentStage, loadExperiment, goToNextStage } = usePreview();
  const [showWelcome, setShowWelcome] = useState(true);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isLastStage, setIsLastStage] = useState(false);
  const params = useParams();
  const experimentId = params.id as string;

  useEffect(() => {
    if (experimentId) {
      loadExperiment(experimentId);
    }
  }, [experimentId, loadExperiment]);

  // Check if this is the last stage
  useEffect(() => {
    if (experiment && currentStage) {
      // Sort stages by order
      const sortedStages = [...experiment.stages].sort((a, b) => a.order - b.order);
      // Check if current stage is the last one
      const currentIndex = sortedStages.findIndex(stage => stage.id === currentStage.id);
      setIsLastStage(currentIndex === sortedStages.length - 1);
    }
  }, [experiment, currentStage]);

  // Handle the Next button click on the welcome screen
  const handleWelcomeNext = () => {
    setShowWelcome(false);
  };
  
  // Handle Next button on the last stage
  const handleLastStageNext = () => {
    setShowThankYou(true);
  };
  
  // Handle exit button
  const handleExit = () => {
    window.location.href = `/admin/experiments/${experimentId}/designer`;
  };
  
  // Show Thank You screen
  if (showThankYou) {
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
  
  // Simple welcome screen
  if (showWelcome) {
    return (
      <div className="p-4">
        <div className="max-w-2xl mx-auto p-4 bg-white rounded border text-center">
          <h3 className="text-lg font-bold mb-4">Welcome</h3>
          <p className="mb-6">Thank you. Please click Next to begin the experiment.</p>
          <button 
            onClick={handleWelcomeNext}
            className="px-6 py-2 bg-blue-500 text-white rounded"
          >
            Next
          </button>
        </div>
      </div>
    );
  }
  
  // No experiment or stage yet
  if (!experiment || !currentStage) {
    return (
      <div className="p-4">
        <div className="max-w-2xl mx-auto p-4 bg-white rounded border text-center">
          <p>Loading experiment...</p>
        </div>
      </div>
    );
  }
  
  // Display appropriate stage
  return (
    <div className="p-4">
      <div className="flex justify-between items-center max-w-2xl mx-auto mb-4">
        <div>
          <p className="text-sm text-gray-500">Stage {currentStage.order + 1} of {experiment.stages.length}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Experiment: {experiment.name}</p>
        </div>
      </div>
      
      {isInstructionsStage(currentStage) ? (
        <InstructionsView 
          stage={currentStage} 
          onNext={isLastStage ? handleLastStageNext : goToNextStage} 
        />
      ) : (
        <PlaceholderStage 
          stage={currentStage} 
          onNext={isLastStage ? handleLastStageNext : goToNextStage} 
        />
      )}
    </div>
  );
}

export default function SimplifiedPreviewPage() {
  return (
    <PreviewProvider>
      <SimplePreviewContent />
    </PreviewProvider>
  );
}