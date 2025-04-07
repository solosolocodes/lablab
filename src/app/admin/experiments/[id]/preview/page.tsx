'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PreviewProvider, usePreview } from '@/contexts/PreviewContext';

// Type definitions for stages
interface BaseStage {
  id: string;
  type: string;
  title: string;
  description: string;
  durationSeconds: number;
  required: boolean;
  order: number;
}

interface InstructionsStage extends BaseStage {
  type: 'instructions';
  content: string;
  format?: string;
}

interface SurveyStage extends BaseStage {
  type: 'survey';
  questions: {
    id: string;
    text: string;
    type: string;
    required?: boolean;
    options?: string[];
  }[];
}

interface BreakStage extends BaseStage {
  type: 'break';
  message: string;
}

interface ScenarioStage extends BaseStage {
  type: 'scenario';
  scenarioId?: string;
  rounds?: number;
  roundDuration?: number;
}

type Stage = InstructionsStage | SurveyStage | BreakStage | ScenarioStage;

// Types for userGroups and branches
interface UserGroup {
  userGroupId: string;
  condition: string;
  maxParticipants?: number;
}

interface BranchCondition {
  type: string;
  sourceStageId?: string;
  targetStageId: string;
  questionId?: string;
  expectedResponse?: string;
  operator?: string;
  threshold?: number;
  probability?: number;
}

interface Branch {
  fromStageId: string;
  conditions: BranchCondition[];
  defaultTargetStageId: string;
}

// Experiment interface
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Experiment {
  id: string;
  name: string;
  description: string;
  status: string;
  stages: Stage[];
  createdBy?: {
    id?: string;
    name?: string;
    email?: string;
  };
  userGroups?: UserGroup[];
  branches?: Branch[];
  startStageId?: string;
  createdAt?: string;
  updatedAt?: string;
  lastEditedAt?: string;
}

// Simplified stage components
function SimpleInstructionsStage({ stage, onNext }: { stage: InstructionsStage; onNext: () => void }) {
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <h3 className="text-lg font-bold mb-2">{stage.title}</h3>
      <p className="mb-4">{stage.description}</p>
      <div className="p-3 bg-gray-50 rounded border mb-4">
        {stage.content}
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

function SimpleSurveyStage({ stage, onNext }: { stage: SurveyStage; onNext: () => void }) {
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };
  
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <h3 className="text-lg font-bold mb-2">{stage.title}</h3>
      <p className="mb-4">{stage.description}</p>
      
      <form onSubmit={handleSubmit}>
        {stage.questions && stage.questions.map((q, i: number) => (
          <div key={q.id || i} className="mb-4 p-3 bg-gray-50 rounded border">
            <p className="font-medium">{q.text} {q.required && <span className="text-red-500">*</span>}</p>
            
            {q.type === 'text' && (
              <input 
                type="text" 
                className="w-full mt-2 p-2 border rounded"
                onChange={() => setAnswered({...answered, [q.id]: true})}
                required={q.required}
              />
            )}
            
            {q.type === 'multipleChoice' && q.options && (
              <div className="mt-2">
                {q.options.map((option: string, idx: number) => (
                  <div key={idx} className="flex items-center mt-1">
                    <input 
                      type="radio" 
                      id={`${q.id}-${idx}`} 
                      name={q.id}
                      onChange={() => setAnswered({...answered, [q.id]: true})}
                      required={q.required}
                    />
                    <label htmlFor={`${q.id}-${idx}`} className="ml-2">{option}</label>
                  </div>
                ))}
              </div>
            )}
            
            {q.type === 'rating' && (
              <div className="flex space-x-2 mt-2">
                {[1, 2, 3, 4, 5].map((rating: number) => (
                  <button
                    key={rating}
                    type="button"
                    className="w-10 h-10 border rounded-full"
                    onClick={() => setAnswered({...answered, [q.id]: true})}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        
        <button 
          type="submit" 
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Submit
        </button>
      </form>
    </div>
  );
}

function SimpleBreakStage({ stage, onNext }: { stage: BreakStage; onNext: () => void }) {
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white rounded border">
      <h3 className="text-lg font-bold mb-2">{stage.title}</h3>
      <p className="mb-4">{stage.description}</p>
      <div className="p-3 bg-gray-50 rounded border mb-4">
        {stage.message}
      </div>
      <button 
        onClick={onNext}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Continue
      </button>
    </div>
  );
}

function SimplePreviewContent() {
  const { 
    experiment, 
    currentStage, 
    goToNextStage, 
    loadExperiment, 
    progress
  } = usePreview();
  
  const params = useParams();
  const experimentId = params.id as string;

  useEffect(() => {
    if (experimentId) {
      loadExperiment(experimentId);
    }
  }, [experimentId, loadExperiment]);

  // Always show the welcome screen regardless of experiment state
  return (
    <div className="p-4">
      <div className="max-w-2xl mx-auto p-4 bg-white rounded border text-center">
        <h3 className="text-lg font-bold mb-4">Welcome</h3>
        <p className="mb-6">Thank you. Please click Next.</p>
        <button 
          onClick={goToNextStage}
          className="px-6 py-2 bg-blue-500 text-white rounded"
        >
          Next
        </button>
      </div>
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