'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParticipant } from '@/contexts/ParticipantContext';
import { toast } from 'react-hot-toast';

type Question = {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  options?: string[];
  minValue?: number;
  maxValue?: number;
  maxRating?: number;
};

type SurveyStageProps = {
  stage: {
    id: string;
    surveyId?: string;
    title: string;
    description: string;
    questions?: Question[];
  };
  onNext: () => void;
};

// Create module-level cache to prevent duplicate fetches
const loadedSurveys = new Map<string, any>();
let fetchCount = 0;

export default function SurveyStage({ stage, onNext }: SurveyStageProps) {
  // Track renders for debugging
  const { isStageTransitioning, saveStageResponse, surveyResponses, setSurveyResponses } = useParticipant();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [surveyData, setSurveyData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Add refs to track state
  const isMountedRef = useRef(true);
  const hasInitiatedLoadingRef = useRef(false);
  const isFetchingRef = useRef(false);
  const renderCountRef = useRef(0);
  const stageIdRef = useRef(stage.id);
  const surveyIdRef = useRef(stage.surveyId);
  
  // Debug render tracking
  renderCountRef.current++;
  console.log(`SurveyStage render #${renderCountRef.current} for stage ${stage.id}, surveyId: ${stage.surveyId}`);
  
  // Use a stable reference to the fetch function to prevent recreating it on every render
  const fetchSurveyData = useCallback(async (surveyId: string) => {
    // Skip if no surveyId provided
    if (!surveyId) {
      console.log('No survey ID provided, skipping fetch');
      return false;
    }
    
    // Check if already in cache
    if (loadedSurveys.has(surveyId)) {
      console.log(`Using cached survey data for ${surveyId}`);
      if (isMountedRef.current && surveyId === surveyIdRef.current) {
        setSurveyData(loadedSurveys.get(surveyId));
        setIsLoading(false);
        setError(null);
      }
      return true;
    }
    
    // Don't fetch if already fetching
    if (isFetchingRef.current) {
      console.log(`Already fetching survey ${surveyId}, skipping duplicate call`);
      return false;
    }
    
    fetchCount++;
    const currentFetchId = fetchCount;
    console.log(`Fetching survey ${surveyId} (fetch #${currentFetchId})`);
    
    // Mark as fetching
    isFetchingRef.current = true;
    setIsLoading(true);
    
    try {
      // Use AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`/api/admin/surveys/${surveyId}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check if component is still mounted and this is still the relevant survey
      if (!isMountedRef.current || surveyId !== surveyIdRef.current) {
        console.log('Component unmounted or survey changed during fetch, aborting');
        isFetchingRef.current = false;
        return false;
      }
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.survey) {
          console.log(`Successfully loaded survey with ${data.survey.questions?.length || 0} questions`);
          
          // Store in cache
          loadedSurveys.set(surveyId, data.survey);
          
          // Update state
          if (isMountedRef.current && surveyId === surveyIdRef.current) {
            setSurveyData(data.survey);
            setError(null);
            initializeAnswers(stageIdRef.current, data.survey.questions || []);
          }
          
          isFetchingRef.current = false;
          setIsLoading(false);
          return true;
        } else {
          console.error('Invalid survey data structure:', data);
          if (isMountedRef.current && surveyId === surveyIdRef.current) {
            setError('Failed to load survey data');
            setIsLoading(false);
          }
          
          isFetchingRef.current = false;
          return false;
        }
      } else {
        console.error(`Failed to load survey: ${response.status}`);
        if (isMountedRef.current && surveyId === surveyIdRef.current) {
          setError(`Failed to load survey (${response.status})`);
          setIsLoading(false);
        }
        
        isFetchingRef.current = false;
        return false;
      }
    } catch (err) {
      console.error('Error fetching survey:', err);
      if (isMountedRef.current && surveyId === surveyIdRef.current) {
        setError(`Error: ${err.message || 'Failed to load survey'}`);
        setIsLoading(false);
      }
      
      isFetchingRef.current = false;
      return false;
    }
  }, []); // No dependencies to ensure it's stable
  
  // Setup survey loading only once when the component mounts
  useEffect(() => {
    // Mark as mounted (redundant but clear)
    isMountedRef.current = true;
    console.log('Component mounted effect running');
    
    // One-time initialization effect
    const initSurvey = async () => {
      if (!isMountedRef.current) return;
      
      const currentSurveyId = stage.surveyId;
      stageIdRef.current = stage.id;
      surveyIdRef.current = currentSurveyId;
      
      // Skip if no survey ID
      if (!currentSurveyId) {
        console.log('No survey ID provided on initialization, skipping fetch');
        return;
      }
      
      // Set loading flag - will be reset by fetchSurveyData
      hasInitiatedLoadingRef.current = true;
      
      // This will check cache first, then fetch if needed
      console.log(`Initial survey load for ${currentSurveyId}`);
      await fetchSurveyData(currentSurveyId);
    };
    
    // Start initialization
    initSurvey();
    
    // Cleanup when component unmounts
    return () => {
      console.log('Component unmount cleanup running');
      isMountedRef.current = false;
      isFetchingRef.current = false;
    };
    
    // This effect should run exactly once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Effect to handle survey ID changes
  useEffect(() => {
    // Skip if component is unmounted
    if (!isMountedRef.current) return;
    
    const prevSurveyId = surveyIdRef.current;
    const newSurveyId = stage.surveyId;
    const prevStageId = stageIdRef.current;
    const newStageId = stage.id;
    
    // Log all transitions for debugging
    console.log(`Survey ID check: ${prevSurveyId} → ${newSurveyId}, Stage ID: ${prevStageId} → ${newStageId}`);
    
    // Update refs with new values
    surveyIdRef.current = newSurveyId;
    stageIdRef.current = newStageId;
    
    // Skip if survey ID didn't change or new survey ID is undefined
    if (prevSurveyId === newSurveyId || !newSurveyId) {
      return;
    }
    
    console.log(`Survey ID changed from ${prevSurveyId} to ${newSurveyId}`);
    
    // Reset state for new survey
    setError(null);
    hasInitiatedLoadingRef.current = true;
    
    // This will check cache first, then fetch if needed
    fetchSurveyData(newSurveyId);
    
  }, [stage.surveyId, stage.id]);
  
  // Initialize answers for the questions
  const initializeAnswers = (stageId: string, questions: Question[]) => {
    if (!questions || questions.length === 0) return;
    
    const initialAnswers: Record<string, any> = {};
    
    // Initialize with empty values based on question type
    questions.forEach(question => {
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
      [stageId]: initialAnswers
    }));
  };
  
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
  
  // Get questions from either the direct stage or the fetched survey data
  const getQuestionsToDisplay = () => {
    // If we have survey data loaded from MongoDB, use those questions
    if (surveyData && Array.isArray(surveyData.questions)) {
      return surveyData.questions;
    }
    
    // Fall back to questions provided directly in the stage
    if (stage.questions && stage.questions.length > 0) {
      return stage.questions;
    }
    
    // No questions available
    return [];
  };
  
  // Get the questions to display
  const questionsToDisplay = getQuestionsToDisplay();
  
  // Loading state
  if (isLoading) {
    return (
      <div className="w-full p-4 bg-white rounded border shadow-sm">
        <div className="mb-4 pb-3 border-b border-gray-200">
          <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
          <p className="text-gray-600">{stage.description}</p>
        </div>
        
        <div className="p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading survey questions...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="w-full p-4 bg-white rounded border shadow-sm">
        <div className="mb-4 pb-3 border-b border-gray-200">
          <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
          <p className="text-gray-600">{stage.description}</p>
        </div>
        
        <div className="p-4 bg-red-50 rounded border border-red-200 mb-5 text-center">
          <p className="text-red-600 font-medium">{error}</p>
          <p className="mt-2 text-gray-600">Please try refreshing the page or contact support if the problem persists.</p>
        </div>
        
        <div className="flex justify-center">
          <button 
            onClick={onNext}
            className="px-6 py-2 bg-blue-500 text-white rounded"
          >
            Skip to Next Stage
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full p-4 bg-white rounded border shadow-sm">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{surveyData?.title || stage.title}</h3>
        <p className="text-gray-600">{surveyData?.description || stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <p className="font-medium mb-4">Please answer the following questions:</p>
        
        {questionsToDisplay.length > 0 ? (
          <div className="space-y-6">
            {questionsToDisplay.map((question, index) => (
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
                
                {/* Scale question with configurable range */}
                {question.type === 'scale' && (
                  <div className="flex flex-wrap justify-between items-center mt-2">
                    {Array.from(
                      { length: (question.maxValue || 10) - (question.minValue || 1) + 1 },
                      (_, i) => i + (question.minValue || 1)
                    ).map((number) => (
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
                        {number === (question.minValue || 1) && 
                          <div className="text-xs mt-1">Min</div>
                        }
                        {number === (question.maxValue || 10) && 
                          <div className="text-xs mt-1">Max</div>
                        }
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Rating with stars */}
                {question.type === 'rating' && (
                  <div className="flex justify-center gap-4 mt-4">
                    {Array.from({ length: question.maxRating || 5 }, (_, i) => i + 1).map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => handleInputChange(question.id, rating)}
                        className="flex flex-col items-center"
                      >
                        <span className={`text-2xl ${
                          surveyResponses[stage.id]?.[question.id] >= rating
                            ? 'text-yellow-400'
                            : 'text-gray-300'
                        }`}>
                          ★
                        </span>
                        <span className="text-xs mt-1">{rating}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-600">No questions defined for this survey.</p>
            <p className="text-gray-500 text-sm mt-2">
              {stage.surveyId ? `Survey ID: ${stage.surveyId}` : 'No Survey ID provided'}
            </p>
          </div>
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