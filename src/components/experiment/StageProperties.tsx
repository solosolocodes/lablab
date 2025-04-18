'use client';

import React, { useState, useEffect } from 'react';
import { Node } from '@reactflow/core';
import { toast } from 'react-hot-toast';
import { 
  NodeData, 
  InstructionsStageData,
  ScenarioStageData,
  SurveyStageData,
  BreakStageData
} from './StageNodes';

// This custom hook is no longer used directly, but we're keeping it here 
// in case we need to reintroduce it in the future
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function calculateDuration(rounds: number, roundDuration: number): number {
  return rounds * roundDuration;
}

type StagePropertiesProps = {
  selectedNode: Node<NodeData> | null;
  onUpdateNode: (nodeId: string, data: NodeData) => void;
  scenarios: Array<{ id: string; name: string }>;
  userGroups?: Array<{ id: string; name: string }>; // Made optional since we don't use it
};

export const StageProperties: React.FC<StagePropertiesProps> = ({ 
  selectedNode, 
  onUpdateNode,
  scenarios
}) => {
  const [stageData, setStageData] = useState<NodeData | null>(null);

  // Update local state when selected node changes
  React.useEffect(() => {
    if (selectedNode) {
      setStageData(selectedNode.data);
    } else {
      setStageData(null);
    }
  }, [selectedNode]);

  // Handle field updates
  const handleChange = (field: string, value: string) => {
    if (!stageData || !selectedNode) return;
    
    const updatedData = { 
      ...stageData,
      [field]: value 
    };
    
    setStageData(updatedData);
    onUpdateNode(selectedNode.id, updatedData);
  };

  const handleStageDataChange = (field: string, value: unknown) => {
    if (!stageData || !selectedNode) return;
    
    const updatedData = { 
      ...stageData,
      stageData: {
        ...stageData.stageData,
        [field]: value
      }
    };
    
    setStageData(updatedData);
    onUpdateNode(selectedNode.id, updatedData);
  };

  // If no node is selected
  if (!selectedNode || !stageData) {
    return (
      <div className="text-center py-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
        </svg>
        <p className="text-gray-500 text-sm">Select a component to view and edit its properties</p>
      </div>
    );
  }

  // Common properties for all stage types
  const renderCommonProperties = () => (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={stageData.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          className="w-full px-3 py-2 border rounded-md text-sm"
          rows={2}
          value={stageData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>
      
      {/* Duration field - Not shown for scenario type since it's calculated */}
      {stageData.type !== 'scenario' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration (seconds)
          </label>
          <input
            type="number"
            min="0"
            className="w-full px-3 py-2 border rounded-md text-sm"
            value={stageData.stageData?.durationSeconds || 30}
            onChange={(e) => handleStageDataChange('durationSeconds', parseInt(e.target.value))}
          />
        </div>
      )}
      
      <div className="flex items-center">
        <input
          type="checkbox"
          id="required"
          className="mr-2"
          checked={stageData.stageData?.required !== false}
          onChange={(e) => handleStageDataChange('required', e.target.checked)}
        />
        <label htmlFor="required" className="text-sm font-medium text-gray-700">
          Required stage
        </label>
      </div>
    </div>
  );

  // Scenario Properties Component
const ScenarioProperties = ({ 
  scenarioData, 
  scenarios, 
  handleStageDataChange 
}: { 
  scenarioData: ScenarioStageData; 
  scenarios: Array<{ id: string; name: string }>; 
  handleStageDataChange: (field: string, value: unknown) => void;
}) => {
  // Create local state for scenario ID and details
  const [scenarioId, setScenarioId] = useState(scenarioData?.scenarioId ? String(scenarioData.scenarioId) : '');
  const [scenarioDetails, setScenarioDetails] = useState<{
    rounds: number;
    roundDuration: number;
    loading: boolean;
    error: string | null;
  }>({
    rounds: Number(scenarioData?.rounds || 1),
    roundDuration: Number(scenarioData?.roundDuration || 60),
    loading: false,
    error: null
  });
  
  // Calculate duration from the scenario details
  const calculatedDuration = scenarioDetails.rounds * scenarioDetails.roundDuration;
  
  // Fetch scenario details when scenarioId changes
  useEffect(() => {
    if (!scenarioId) {
      // Keep some sensible defaults if no scenario selected
      setScenarioDetails(prev => ({
        ...prev,
        rounds: 1,
        roundDuration: 60,
        loading: false,
        error: null
      }));
      
      // Update the stage data with default values
      handleStageDataChange('rounds', 1);
      handleStageDataChange('roundDuration', 60);
      handleStageDataChange('durationSeconds', 60);
      return;
    }
    
    const fetchScenarioDetails = async () => {
      // Set loading state
      setScenarioDetails(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        // Make API request to get scenario details
        const response = await fetch(`/api/scenarios/${scenarioId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch scenario details: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Update scenario details with actual data from API
        setScenarioDetails({
          rounds: Number(data.rounds || 1),
          roundDuration: Number(data.roundDuration || 60),
          loading: false,
          error: null
        });
        
        // Update stage data with scenario values
        handleStageDataChange('rounds', Number(data.rounds || 1));
        handleStageDataChange('roundDuration', Number(data.roundDuration || 60));
        handleStageDataChange('durationSeconds', Number(data.rounds || 1) * Number(data.roundDuration || 60));
        
      } catch (error) {
        console.error('Error fetching scenario details:', error);
        
        // Set error state but keep any previous valid values
        setScenarioDetails(prev => ({
          rounds: prev.rounds,
          roundDuration: prev.roundDuration,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }));
        
        // Show error toast
        toast.error('Failed to fetch scenario details. Using default values.');
        
        // Keep values in sync with what's displayed
        handleStageDataChange('durationSeconds', scenarioDetails.rounds * scenarioDetails.roundDuration);
      }
    };
    
    // Implement retry mechanism with timeout
    let retryCount = 0;
    const maxRetries = 2;
    
    const fetchWithRetry = async () => {
      try {
        await fetchScenarioDetails();
      } catch {
        if (retryCount < maxRetries) {
          retryCount++;
          // Exponential backoff: 2s, 4s
          const delay = 1000 * Math.pow(2, retryCount);
          console.log(`Retrying fetch (${retryCount}/${maxRetries}) after ${delay}ms`);
          setTimeout(fetchWithRetry, delay);
        }
      }
    };
    
    fetchWithRetry();
  }, [scenarioId, handleStageDataChange, scenarioDetails.rounds, scenarioDetails.roundDuration]);
  
  // Update parent state when scenarioId changes
  useEffect(() => {
    if (scenarioId !== (scenarioData?.scenarioId ? String(scenarioData.scenarioId) : '')) {
      handleStageDataChange('scenarioId', scenarioId);
    }
  }, [scenarioId, scenarioData?.scenarioId, handleStageDataChange]);
  
  // Update local state when props change
  useEffect(() => {
    setScenarioId(scenarioData?.scenarioId ? String(scenarioData.scenarioId) : '');
  }, [scenarioData?.scenarioId]);
  
  return (
    <div className="mt-4">
      {/* Scenario selection at the top */}
      <div className="mb-4 border-b pb-3">
        <label className="block text-sm font-medium text-gray-700 mb-1 text-base">
          Select Scenario
        </label>
        <select
          className="w-full px-3 py-2 border rounded-md text-sm bg-white border-blue-300 focus:border-blue-500 focus:ring focus:ring-blue-200"
          value={scenarioId}
          onChange={(e) => setScenarioId(e.target.value)}
        >
          <option value="">-- Select a scenario --</option>
          {scenarios.map(scenario => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.name}
            </option>
          ))}
        </select>
      </div>
      
      {/* Total Duration at the top below the scenario selection */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-blue-700">Total Duration:</span>
          <span className="text-sm font-medium text-blue-900">
            {scenarioDetails.loading ? 'Calculating...' : `${calculatedDuration} seconds`}
          </span>
        </div>
        <p className="text-xs text-blue-600 mt-1">
          {scenarioId 
            ? `${scenarioDetails.rounds} rounds × ${scenarioDetails.roundDuration} seconds per round`
            : `${scenarioDetails.rounds} rounds × ${scenarioDetails.roundDuration} seconds per round (default values)`}
        </p>
      </div>
      
      {/* Scenario details */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of Rounds
          </label>
          <input
            type="number"
            min="1"
            className={`w-full px-3 py-2 border rounded-md text-sm ${
              !scenarioId ? 'bg-white' : 'bg-gray-100'
            } ${scenarioDetails.loading ? 'opacity-50' : ''}`}
            value={scenarioDetails.loading ? 'Loading...' : scenarioDetails.rounds}
            readOnly
            disabled={!!scenarioId}
          />
          <p className="text-xs text-gray-500 mt-1">
            {scenarioId ? 'Set in scenario settings' : 'Default value'}
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Round Duration (seconds)
          </label>
          <input
            type="number"
            min="10"
            className={`w-full px-3 py-2 border rounded-md text-sm ${
              !scenarioId ? 'bg-white' : 'bg-gray-100'
            } ${scenarioDetails.loading ? 'opacity-50' : ''}`}
            value={scenarioDetails.loading ? 'Loading...' : scenarioDetails.roundDuration}
            readOnly
            disabled={!!scenarioId}
          />
          <p className="text-xs text-gray-500 mt-1">
            {scenarioId ? 'Set in scenario settings' : 'Default value'}
          </p>
        </div>
      </div>
      
      {scenarioDetails.error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          Error loading scenario details: {scenarioDetails.error}
          <p className="mt-1 text-xs">Using default values for calculation.</p>
        </div>
      )}
      
      <div className="mt-5">
        <button 
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
          onClick={() => {
            // Apply scenario changes if scenario is selected
            if (!scenarioId) {
              toast.error('Please select a scenario first');
              return;
            }
            
            // Update the duration calculation
            const calculatedDuration = scenarioDetails.rounds * scenarioDetails.roundDuration;
            handleStageDataChange('durationSeconds', calculatedDuration);
            
            // Show confirmation message
            toast.success('Scenario settings applied to stage');
          }}
        >
          Apply Scenario Settings
        </button>
      </div>
    </div>
  );
};

// Instructions Properties Component
const InstructionsProperties = ({
  instructionsData,
  handleStageDataChange
}: {
  instructionsData: InstructionsStageData;
  handleStageDataChange: (field: string, value: unknown) => void;
}) => {
  // Create a local state for the content to fix the cursor issue
  const [contentValue, setContentValue] = useState(instructionsData?.content || '');
  
  // Update the parent's state when done editing
  const updateContent = () => {
    handleStageDataChange('content', contentValue);
  };
  
  // Update local state on prop changes
  useEffect(() => {
    setContentValue(instructionsData?.content || '');
  }, [instructionsData?.content]);
  
  return (
    <div className="mt-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content
        </label>
        <textarea
          className="w-full px-3 py-2 border rounded-md text-sm"
          rows={5}
          value={contentValue}
          onChange={(e) => setContentValue(e.target.value)}
          onBlur={updateContent}
        />
      </div>
      
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Duration (seconds)
        </label>
        <input
          type="number"
          min="5"
          className="w-full px-3 py-2 border rounded-md text-sm"
          value={instructionsData?.durationSeconds || 30}
          onChange={(e) => handleStageDataChange('durationSeconds', parseInt(e.target.value) || 30)}
        />
        <p className="text-xs text-gray-500 mt-1">How long participants should have to read instructions</p>
      </div>
      
      <div className="mt-5">
        <button 
          className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded"
          onClick={() => {
            updateContent();
            toast.success('Instructions updated successfully!');
          }}
        >
          Save Instructions
        </button>
      </div>
    </div>
  );
};

// Survey Properties Component
const SurveyProperties = ({
  surveyData,
  handleStageDataChange
}: {
  surveyData: SurveyStageData;
  handleStageDataChange: (field: string, value: unknown) => void;
}) => {
  const questions = surveyData?.questions || [];
  
  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Questions ({questions.length})
        </label>
        <button 
          className="text-purple-600 hover:text-purple-800 text-xs font-medium"
          onClick={() => {
            const newQuestion = {
              id: `q${Date.now()}`,
              text: 'New Question',
              type: 'text',
              required: true
            };
            handleStageDataChange('questions', [...questions, newQuestion]);
          }}
        >
          + Add Question
        </button>
      </div>
      
      {questions.length > 0 ? (
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {questions.map((question: Record<string, unknown>, index: number) => (
            <div key={String(question.id)} className="border border-gray-200 rounded-md p-2">
              <div className="flex justify-between items-start">
                <input
                  type="text"
                  className="w-full px-2 py-1 text-xs border rounded"
                  value={String(question.text || '')}
                  onChange={(e) => {
                    const updatedQuestions = [...questions];
                    updatedQuestions[index].text = e.target.value;
                    handleStageDataChange('questions', updatedQuestions);
                  }}
                />
                <button 
                  className="ml-2 text-red-500 hover:text-red-700"
                  onClick={() => {
                    const updatedQuestions = questions.filter((_, i) => i !== index);
                    handleStageDataChange('questions', updatedQuestions);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              
              <div className="mt-1 flex items-center space-x-2">
                <select
                  className="px-2 py-1 text-xs border rounded"
                  value={String(question.type || 'text')}
                  onChange={(e) => {
                    const updatedQuestions = [...questions];
                    updatedQuestions[index].type = e.target.value as 'text' | 'multipleChoice' | 'rating' | 'checkboxes';
                    handleStageDataChange('questions', updatedQuestions);
                  }}
                >
                  <option value="text">Text</option>
                  <option value="multipleChoice">Multiple Choice</option>
                  <option value="rating">Rating</option>
                  <option value="checkboxes">Checkboxes</option>
                </select>
                
                <label className="text-xs flex items-center">
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={Boolean(question.required)}
                    onChange={(e) => {
                      const updatedQuestions = [...questions];
                      updatedQuestions[index].required = e.target.checked;
                      handleStageDataChange('questions', updatedQuestions);
                    }}
                  />
                  Required
                </label>
              </div>
              
              {(String(question.type) === 'multipleChoice' || String(question.type) === 'checkboxes') && (
                <div className="mt-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Options:</span>
                    <button 
                      className="text-purple-600 hover:text-purple-800 text-xs"
                      onClick={() => {
                        const updatedQuestions = [...questions];
                        const options = Array.isArray(updatedQuestions[index].options) 
                          ? updatedQuestions[index].options 
                          : [];
                        updatedQuestions[index].options = [...options, `Option ${options.length + 1}`];
                        handleStageDataChange('questions', updatedQuestions);
                      }}
                    >
                      + Add
                    </button>
                  </div>
                  {(Array.isArray(question.options) ? question.options : []).map((option: string, optionIndex: number) => (
                    <div key={optionIndex} className="flex items-center mb-1">
                      <input
                        type="text"
                        className="flex-1 px-2 py-1 text-xs border rounded"
                        value={option}
                        onChange={(e) => {
                          const updatedQuestions = [...questions];
                          // Ensure options array exists
                          if (!Array.isArray(updatedQuestions[index].options)) {
                            updatedQuestions[index].options = [];
                          }
                          // Now safely assign the value
                          if (updatedQuestions[index].options) {
                            updatedQuestions[index].options[optionIndex] = e.target.value;
                          }
                          handleStageDataChange('questions', updatedQuestions);
                        }}
                      />
                      <button 
                        className="ml-1 text-red-500 hover:text-red-700"
                        onClick={() => {
                          const updatedQuestions = [...questions];
                          // Ensure options array exists and filter out the removed option
                          updatedQuestions[index].options = Array.isArray(updatedQuestions[index].options) ? 
                            updatedQuestions[index].options.filter((_, i: number) => i !== optionIndex) : [];
                          handleStageDataChange('questions', updatedQuestions);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-3 border border-dashed border-gray-300 rounded-md">
          <p className="text-gray-400 text-sm">No questions added yet</p>
        </div>
      )}
      
      <div className="mt-3">
        <button 
          className="w-full py-2 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium rounded border border-green-200"
          onClick={() => {
            const demographicQuestions = [
              {
                id: `q${Date.now()}-age`,
                text: 'What is your age?',
                type: 'multipleChoice',
                required: true,
                options: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+']
              },
              {
                id: `q${Date.now()}-gender`,
                text: 'What is your gender?',
                type: 'multipleChoice',
                required: true,
                options: ['Male', 'Female', 'Non-binary', 'Prefer not to say']
              },
              {
                id: `q${Date.now()}-education`,
                text: 'What is your highest level of education?',
                type: 'multipleChoice',
                required: true,
                options: ['High School', 'Some College', 'Bachelor\'s Degree', 'Master\'s Degree', 'Doctorate', 'Other']
              },
              {
                id: `q${Date.now()}-occupation`,
                text: 'What is your current occupation?',
                type: 'multipleChoice',
                required: true,
                options: ['Student', 'Employed (full-time)', 'Employed (part-time)', 'Self-employed', 'Unemployed', 'Retired', 'Other']
              },
              {
                id: `q${Date.now()}-income`,
                text: 'What is your annual income range?',
                type: 'multipleChoice',
                required: true,
                options: ['Under $25,000', '$25,000-$49,999', '$50,000-$74,999', '$75,000-$99,999', '$100,000+', 'Prefer not to say']
              },
              {
                id: `q${Date.now()}-trading-exp`,
                text: 'How much experience do you have with financial trading?',
                type: 'multipleChoice',
                required: true,
                options: ['None', 'Beginner (less than 1 year)', 'Intermediate (1-3 years)', 'Advanced (3-5 years)', 'Expert (5+ years)']
              },
              {
                id: `q${Date.now()}-crypto-exp`,
                text: 'How much experience do you have with cryptocurrency trading?',
                type: 'multipleChoice',
                required: true,
                options: ['None', 'Beginner (less than 1 year)', 'Intermediate (1-3 years)', 'Advanced (3-5 years)', 'Expert (5+ years)']
              },
              {
                id: `q${Date.now()}-risk`,
                text: 'How would you describe your risk tolerance in financial matters?',
                type: 'multipleChoice',
                required: true,
                options: ['Very Low (highly risk-averse)', 'Low', 'Moderate', 'High', 'Very High (risk-seeking)']
              },
              {
                id: `q${Date.now()}-invest-horizon`,
                text: 'What is your typical investment time horizon?',
                type: 'multipleChoice',
                required: true,
                options: ['Very short-term (days/weeks)', 'Short-term (months)', 'Medium-term (1-3 years)', 'Long-term (3-10 years)', 'Very long-term (10+ years)']
              },
              {
                id: `q${Date.now()}-decision`,
                text: 'How would you describe your decision-making style when trading?',
                type: 'multipleChoice',
                required: true,
                options: ['Very analytical/methodical', 'Somewhat analytical', 'Balanced between analysis and intuition', 'Somewhat intuitive', 'Very intuitive/gut feeling-based']
              }
            ];
            
            handleStageDataChange('questions', [...questions, ...demographicQuestions]);
            toast.success('Demographic questions added successfully!');
          }}
        >
          Add Demographic Questions
        </button>
      </div>
      
      <div className="mt-5">
        <button 
          className="w-full py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded"
          onClick={() => {
            // Apply changes and show confirmation
            toast.success('Survey questions updated successfully!');
          }}
        >
          Save Survey
        </button>
      </div>
    </div>
  );
};

// Break Properties Component
const BreakProperties = ({
  breakData,
  handleStageDataChange
}: {
  breakData: BreakStageData;
  handleStageDataChange: (field: string, value: unknown) => void;
}) => {
  return (
    <div className="mt-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Break Message
        </label>
        <textarea
          className="w-full px-3 py-2 border rounded-md text-sm"
          rows={3}
          value={breakData?.message || 'Take a short break before continuing...'}
          onChange={(e) => handleStageDataChange('message', e.target.value)}
        />
      </div>
      
      <div className="mt-5">
        <button 
          className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded"
          onClick={() => {
            // Apply changes and show confirmation
            toast.success('Break settings updated successfully!');
          }}
        >
          Save Break
        </button>
      </div>
    </div>
  );
};

// Type-specific properties
const renderTypeSpecificProperties = () => {
  switch (stageData.type) {
    case 'instructions':
      // Get the proper typed data
      const instructionsData = stageData.stageData as InstructionsStageData;
      return <InstructionsProperties instructionsData={instructionsData} handleStageDataChange={handleStageDataChange} />;
        
    case 'scenario':
      // Get the properly typed data
      const scenarioData = stageData.stageData as ScenarioStageData;
      return <ScenarioProperties 
        scenarioData={scenarioData} 
        scenarios={scenarios} 
        handleStageDataChange={handleStageDataChange} 
      />;
        
    case 'survey':
      // Get the properly typed data
      const surveyData = stageData.stageData as SurveyStageData;
      return <SurveyProperties 
        surveyData={surveyData}
        handleStageDataChange={handleStageDataChange}
      />;
        
    case 'break':
      // Get the properly typed data
      const breakData = stageData.stageData as BreakStageData;
      return <BreakProperties 
        breakData={breakData}
        handleStageDataChange={handleStageDataChange}
      />;
        
    default:
      return null;
  }
};

  return (
    <div className="p-4">
      {renderCommonProperties()}
      {renderTypeSpecificProperties()}
    </div>
  );
}