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

function PlaceholderStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <p className="font-medium">Stage type: {stage.type}</p>
        <p className="mt-2 text-gray-600">This stage type is currently displayed as a placeholder.</p>
        
        {stage.type === 'survey' && stage.questions && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <p className="font-medium mb-2">Survey has {stage.questions.length} questions</p>
            <p className="text-sm text-gray-600">Survey questions will be displayed here in the final version.</p>
          </div>
        )}
        
        {stage.type === 'break' && stage.message && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <p className="font-medium mb-2">Break Message:</p>
            <p className="text-gray-700">{stage.message}</p>
          </div>
        )}
        
        {stage.type === 'scenario' && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <p className="font-medium mb-2">Scenario ID: {stage.scenarioId || 'Not specified'}</p>
            <p className="text-sm text-gray-600">The scenario interface will be displayed here in the final version.</p>
          </div>
        )}
      </div>
      
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

function SimplePreviewContent() {
  const { experiment, currentStage, loadExperiment, goToNextStage } = usePreview();
  const [showWelcome, setShowWelcome] = useState(true);
  const params = useParams();
  const experimentId = params.id as string;

  useEffect(() => {
    if (experimentId) {
      loadExperiment(experimentId);
    }
  }, [experimentId, loadExperiment]);

  // Handle the Next button click on the welcome screen
  const handleWelcomeNext = () => {
    setShowWelcome(false);
  };
  
  // Simple welcome screen
  if (showWelcome) {
    return (
      <div className="p-4">
        <div className="max-w-2xl mx-auto p-4 bg-white rounded border text-center">
          <h3 className="text-lg font-bold mb-4">Welcome</h3>
          <p className="mb-6">Thank you. Please click Next.</p>
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
      {isInstructionsStage(currentStage) ? (
        <InstructionsView 
          stage={currentStage} 
          onNext={goToNextStage} 
        />
      ) : (
        <PlaceholderStage 
          stage={currentStage} 
          onNext={goToNextStage} 
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