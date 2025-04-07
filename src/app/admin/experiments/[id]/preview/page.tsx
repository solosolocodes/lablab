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
  // Simple markdown-like rendering function
  const renderContent = (content: string) => {
    // Replace markdown headers
    const withHeaders = content
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-3 mb-2">$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4 class="text-md font-semibold mt-2 mb-1">$1</h4>');
    
    // Replace line breaks with paragraphs
    const withParagraphs = withHeaders
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0)
      .map(p => `<p class="mb-2">${p}</p>`)
      .join('');
    
    return withParagraphs;
  };
  
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <h3 className="text-lg font-bold mb-2">{stage.title}</h3>
      <p className="mb-4">{stage.description}</p>
      <div 
        className="p-4 bg-gray-50 rounded border mb-4 prose"
        dangerouslySetInnerHTML={{ __html: renderContent(stage.content) }}
      />
      <button 
        onClick={onNext}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Next
      </button>
    </div>
  );
}

function PlaceholderStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <h3 className="text-lg font-bold mb-2">{stage.title}</h3>
      <p className="mb-4">{stage.description}</p>
      <div className="p-3 bg-gray-50 rounded border mb-4">
        <p>Stage type: {stage.type}</p>
        <p className="mt-2">This stage is currently a placeholder.</p>
      </div>
      <button 
        onClick={onNext}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Next
      </button>
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