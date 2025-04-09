'use client';

import { useState, useRef, useEffect } from 'react';
import { useParticipant } from '@/contexts/ParticipantContext';
import { toast } from 'react-hot-toast';

type Question = {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  options?: string[];
};

type SurveyStageProps = {
  stage: {
    id: string;
    title: string;
    description: string;
    questions?: Question[];
  };
  onNext: () => void;
};

export default function SurveyStage({ stage, onNext }: SurveyStageProps) {
  const { isStageTransitioning, saveStageResponse, surveyResponses, setSurveyResponses } = useParticipant();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Add ref to track component mount state
  const isMountedRef = useRef(true);
  
  // Effect to clean up when component unmounts
  useEffect(() => {
    // Set the mounted flag to true (it already is, but this is for clarity)
    isMountedRef.current = true;
    
    // Clean up function that runs when component unmounts
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Initialize answers if needed
  if (!surveyResponses[stage.id]) {
    const initialAnswers: Record<string, any> = {};
    
    // Initialize with empty values based on question type
    stage.questions?.forEach(question => {
      if (question.type === 'multipleChoice') {
        initialAnswers[question.id] = '';
      } else if (question.type === 'checkboxes') {
        initialAnswers[question.id] = [];
      } else if (question.type === 'scale') {
        initialAnswers[question.id] = null;
      } else {
        initialAnswers[question.id] = '';
      }
    });
    
    setSurveyResponses(prev => ({
      ...prev,
      [stage.id]: initialAnswers
    }));
  }
  
  const handleInputChange = (questionId: string, value: string | string[] | number) => {
    setSurveyResponses(prev => ({
      ...prev,
      [stage.id]: {
        ...prev[stage.id],
        [questionId]: value
      }
    }));
  };
  
  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    setSurveyResponses(prev => {
      const currentSelections = Array.isArray(prev[stage.id]?.[questionId])
        ? [...prev[stage.id][questionId]]
        : [];
      
      if (checked) {
        return {
          ...prev,
          [stage.id]: {
            ...prev[stage.id],
            [questionId]: [...currentSelections, option]
          }
        };
      } else {
        return {
          ...prev,
          [stage.id]: {
            ...prev[stage.id],
            [questionId]: currentSelections.filter(item => item !== option)
          }
        };
      }
    });
  };
  
  const handleSubmit = async () => {
    // Don't proceed if component is unmounted
    if (!isMountedRef.current) return;
    
    // Validate required questions
    const currentResponses = surveyResponses[stage.id] || {};
    let hasErrors = false;
    
    stage.questions?.forEach(question => {
      if (question.required) {
        const response = currentResponses[question.id];
        
        if (response === '' || response === null || 
            (Array.isArray(response) && response.length === 0)) {
          if (isMountedRef.current) {
            toast.error(`Please answer question: ${question.text}`);
          }
          hasErrors = true;
        }
      }
    });
    
    if (hasErrors) return;
    
    if (isMountedRef.current) {
      setIsSubmitting(true);
    }
    
    try {
      // Save survey responses
      await saveStageResponse(stage.id, 'survey', currentResponses);
      
      // Proceed to next stage only if still mounted
      if (isMountedRef.current) {
        onNext();
      }
    } catch (error) {
      console.error('Error submitting survey:', error);
      if (isMountedRef.current) {
        toast.error('Failed to submit survey responses');
      }
    } finally {
      if (isMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };
  
  return (
    <div className="w-full p-4 bg-white rounded border shadow-sm">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <p className="font-medium mb-4">Please answer the following questions:</p>
        
        {stage.questions && stage.questions.length > 0 ? (
          <div className="space-y-6">
            {stage.questions.map((question, index) => (
              <div key={question.id} className="p-4 bg-white rounded border">
                <label className="block mb-2 font-medium">
                  {index + 1}. {question.text} {question.required && <span className="text-red-500">*</span>}
                </label>
                
                {/* Text input for short answer questions */}
                {question.type === 'text' && (
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded"
                    value={surveyResponses[stage.id]?.[question.id] || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    required={question.required}
                  />
                )}
                
                {/* Textarea for long answer questions */}
                {question.type === 'textarea' && (
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded"
                    rows={4}
                    value={surveyResponses[stage.id]?.[question.id] || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    required={question.required}
                  />
                )}
                
                {/* Radio buttons for multiple choice */}
                {question.type === 'multipleChoice' && question.options && (
                  <div className="space-y-2 mt-2">
                    {question.options.map((option, idx) => (
                      <div key={idx} className="flex items-center">
                        <input
                          type="radio"
                          id={`${question.id}-option-${idx}`}
                          name={question.id}
                          className="mr-2"
                          checked={surveyResponses[stage.id]?.[question.id] === option}
                          onChange={() => handleInputChange(question.id, option)}
                          required={question.required}
                        />
                        <label htmlFor={`${question.id}-option-${idx}`}>
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Checkboxes for multiple selection */}
                {question.type === 'checkboxes' && question.options && (
                  <div className="space-y-2 mt-2">
                    {question.options.map((option, idx) => (
                      <div key={idx} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`${question.id}-option-${idx}`}
                          className="mr-2"
                          checked={(surveyResponses[stage.id]?.[question.id] || []).includes(option)}
                          onChange={(e) => handleCheckboxChange(question.id, option, e.target.checked)}
                        />
                        <label htmlFor={`${question.id}-option-${idx}`}>
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Scale (1-5, 1-10, etc.) */}
                {question.type === 'scale' && (
                  <div className="flex flex-wrap justify-between items-center mt-2">
                    {[1, 2, 3, 4, 5].map((number) => (
                      <div key={number} className="text-center mx-2 mb-2">
                        <button
                          type="button"
                          className={`w-10 h-10 rounded-full ${
                            surveyResponses[stage.id]?.[question.id] === number
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                          }`}
                          onClick={() => handleInputChange(question.id, number)}
                        >
                          {number}
                        </button>
                        {number === 1 && <div className="text-xs mt-1">Strongly Disagree</div>}
                        {number === 5 && <div className="text-xs mt-1">Strongly Agree</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center p-4">No questions defined for this survey.</p>
        )}
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={handleSubmit}
          disabled={isStageTransitioning || isSubmitting}
          className={`px-6 py-2 bg-blue-500 text-white rounded ${
            (isStageTransitioning || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}