'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

// Create a singleton cache to track which surveys have been successfully loaded
// This prevents duplicate fetches across component mounts
const loadedSurveys = new Set();

// Simple survey component for preview mode
const SurveyStageComponent = ({ 
  externalNextHandler, 
  forceRefreshSignal,
  stage: propStage
}: { 
  externalNextHandler?: () => void;
  forceRefreshSignal?: boolean;
  stage?: any;
}) => {
  // Destructure needed context values
  const { currentStage: contextStage, goToNextStage, isStageTransitioning } = usePreview();
  
  // Core component state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [surveyData, setSurveyData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use this to prevent initial loading flash during stage transitions
  const firstRenderRef = useRef(true);
  
  // Retry mechanism state
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const retryDelayMs = 200;
  
  // Flags to prevent duplicate operations
  const isFetchingRef = useRef(false);
  const isComponentMountedRef = useRef(true);
  const stageIdRef = useRef(null);
  
  // Track whether parent refresh is in progress
  const lastRefreshTimeRef = useRef(0);
  const refreshMinIntervalMs = 500; // Minimum time between refreshes
  
  // Use prop stage if available, otherwise fall back to context stage
  const currentStage = useMemo(() => propStage || contextStage, [propStage, contextStage]);
  
  // Use external handler if provided, otherwise use context handler
  const nextStageHandler = useMemo(() => externalNextHandler || goToNextStage, [externalNextHandler, goToNextStage]);
  
  // Get current stage ID, handling different formats
  const stageId = useMemo(() => {
    return currentStage?.id || 
           currentStage?.surveyId || 
           (currentStage?.type === 'instructions' ? 'instructions-' + Date.now() : null);
  }, [currentStage]);
  
  // Extract questions from either surveyData or directly from stage
  const questions = useMemo(() => {
    const result = [];
    
    // First try to get questions from MongoDB survey data
    if (surveyData && Array.isArray(surveyData.questions)) {
      result.push(...surveyData.questions);
    } 
    // Then fallback to inline questions from the stage
    else if (currentStage && Array.isArray(currentStage.questions)) {
      result.push(...currentStage.questions);
    }
    
    return result;
  }, [surveyData, currentStage]);
  
  // Current question and navigation state
  const currentQuestion = questions[currentIndex] || null;
  const hasMoreQuestions = currentIndex < questions.length - 1;
  
  // Reset component state when stage changes
  useEffect(() => {
    // Only run this on stage ID change
    if (stageId !== stageIdRef.current) {
      // Store current stage ID
      stageIdRef.current = stageId;
      
      // Reset component state
      retryCountRef.current = 0;
      setCurrentIndex(0);
      
      console.log(`Stage changed to: ${stageId}`);
      
      // Clear survey data if switching to a different stage
      if (stageId && !loadedSurveys.has(stageId)) {
        setSurveyData(null);
      }
    }
  }, [stageId]);
  
  // Component cleanup
  useEffect(() => {
    isComponentMountedRef.current = true;
    
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);
  
  // Main fetch function
  const fetchSurveyData = useCallback(async (force = false) => {
    // Skip if we're already fetching or the component is unmounted
    if (isFetchingRef.current || !isComponentMountedRef.current) {
      console.log('Skipping fetch: already in progress or component unmounted');
      return false;
    }
    
    // Skip if we've already loaded this survey
    if (!force && stageId && loadedSurveys.has(stageId) && questions.length > 0) {
      console.log(`Skipping fetch: survey ${stageId} already loaded`);
      return true;
    }
    
    // Set fetching flag to prevent duplicate requests
    isFetchingRef.current = true;
    setIsLoading(true);
    
    try {
      // For instructions type, we create synthetic survey data
      if (currentStage?.type === 'instructions') {
        // Create a survey-compatible object from instructions
        const instructionsSurvey = {
          title: currentStage.title || "Instructions",
          description: currentStage.description || "",
          questions: [
            {
              id: "instructions-content",
              type: "text",
              text: currentStage.content || "Please review the instructions and continue when ready.",
              required: false
            }
          ]
        };
        
        console.log('Using instructions content as survey data');
        
        if (isComponentMountedRef.current) {
          setSurveyData(instructionsSurvey);
          setError(null);
          setIsLoading(false);
          
          // Mark as loaded
          if (stageId) loadedSurveys.add(stageId);
        }
        
        isFetchingRef.current = false;
        return true;
      }
      
      // Regular survey flow
      if (!currentStage?.surveyId) {
        console.error('No survey ID available');
        
        if (isComponentMountedRef.current) {
          setError("No survey ID available");
          setIsLoading(false);
        }
        
        isFetchingRef.current = false;
        return false;
      }
      
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      console.log(`Fetching survey ${currentStage.surveyId} (attempt ${retryCountRef.current + 1}/${maxRetries + 1})...`);
      
      const response = await fetch(`/api/admin/surveys/${currentStage.surveyId}?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      // If component unmounted during fetch, don't update state
      if (!isComponentMountedRef.current) {
        isFetchingRef.current = false;
        return false;
      }
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.survey) {
          console.log(`Successfully loaded survey data with ${data.survey.questions?.length || 0} questions`);
          
          if (isComponentMountedRef.current) {
            setSurveyData(data.survey);
            setError(null);
            setIsLoading(false);
            
            // Mark as successfully loaded
            if (stageId) loadedSurveys.add(stageId);
          }
          
          isFetchingRef.current = false;
          return true;
        } else {
          console.error('Invalid survey data structure:', data);
          
          if (isComponentMountedRef.current) {
            setError("Survey data structure invalid");
            setIsLoading(false);
          }
          
          isFetchingRef.current = false;
          return false;
        }
      } else {
        console.error(`Failed to load survey: ${response.status}`);
        
        if (isComponentMountedRef.current) {
          setError(`Failed to load survey (${response.status})`);
          setIsLoading(false);
        }
        
        isFetchingRef.current = false;
        return false;
      }
    } catch (error) {
      console.error('Failed to load survey:', error);
      
      if (isComponentMountedRef.current) {
        setError("Error loading survey: " + (error.message || "Unknown error"));
        setIsLoading(false);
      }
      
      isFetchingRef.current = false;
      return false;
    }
  }, [currentStage, questions.length, stageId]);
  
  // Prevent the initial loading screen flash by immediately 
  // checking if we already have the data in our cache
  useEffect(() => {
    // Set immediate state based on whether data is already loaded
    if (stageId && loadedSurveys.has(stageId)) {
      // Data is already in our cache, no need to show loading
      setIsLoading(false);
    }
  }, [stageId]);
  
  // Initial data loading - run only once for this stage
  useEffect(() => {
    // Return early if:
    // 1. We don't have a stage ID
    // 2. A fetch is already in progress
    // 3. We've already loaded this survey and have questions
    if (!stageId || 
        isFetchingRef.current || 
        (loadedSurveys.has(stageId) && questions.length > 0)) {
      if (loadedSurveys.has(stageId)) {
        console.log(`Survey ${stageId} already in global cache, skipping fetch`);
      }
      return;
    }
    
    // Reset retry counter
    retryCountRef.current = 0;
    
    // Only show loading state if we don't already have questions
    if (questions.length === 0) {
      setIsLoading(true);
    }
    
    const loadWithRetries = async () => {
      // Skip if component is no longer mounted
      if (!isComponentMountedRef.current) return;
      
      console.log(`Initial load for stage ${stageId}`);
      const success = await fetchSurveyData();
      
      // Skip if component unmounted or fetching was successful
      if (!isComponentMountedRef.current || success) return;
      
      // Retry if fetch failed and we haven't exceeded max retries
      if (!success && retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        
        console.log(`Scheduling retry ${retryCountRef.current} in ${retryDelayMs}ms...`);
        
        // Schedule retry after delay
        setTimeout(() => {
          if (isComponentMountedRef.current) {
            loadWithRetries();
          }
        }, retryDelayMs);
      } else if (!success) {
        console.log('Failed to load survey data after all retries');
      }
    };
    
    loadWithRetries();
    
    // Only depend on stageId to ensure this effect runs exactly once per stage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageId]);
  
  // Handle manual refresh button click
  const handleRefresh = useCallback(() => {
    // Prevent rapid refreshes
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < refreshMinIntervalMs) {
      console.log('Refresh triggered too soon, skipping');
      return;
    }
    
    console.log('Manual refresh triggered');
    lastRefreshTimeRef.current = now;
    
    // Reset retry counter
    retryCountRef.current = 0;
    
    // Remove from loaded surveys to force a fresh fetch
    if (stageId) loadedSurveys.delete(stageId);
    
    // Force fetch with cache clearing
    fetchSurveyData(true);
  }, [fetchSurveyData, stageId]);
  
  // Handle parent's forceRefreshSignal
  useEffect(() => {
    const now = Date.now();
    
    // Only trigger refresh if signal is true and sufficient time has passed
    if (forceRefreshSignal && now - lastRefreshTimeRef.current >= refreshMinIntervalMs) {
      console.log('Parent component triggered refresh');
      handleRefresh();
    }
  }, [forceRefreshSignal, handleRefresh]);
  
  // Navigation functions
  const handleNext = useCallback(() => {
    if (hasMoreQuestions) {
      setCurrentIndex(currentIndex + 1);
    } else {
      nextStageHandler();
    }
  }, [hasMoreQuestions, currentIndex, nextStageHandler]);
  
  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);
  
  // Missing stage check
  if (!currentStage) {
    return (
      <div style={{ padding: '20px', backgroundColor: 'white' }}>
        <p>Error: Stage data not available</p>
      </div>
    );
  }
  
  // Stage type check
  const isSupportedType = currentStage.type === 'survey' || currentStage.type === 'instructions';
  if (!isSupportedType) {
    return (
      <div style={{ padding: '20px', backgroundColor: 'white' }}>
        <p>Error: Unsupported stage type ({currentStage.type})</p>
        <p>Expected: survey or instructions</p>
      </div>
    );
  }
  
  // Mark first render complete after component mounts
  useEffect(() => {
    // After a short delay, mark first render as complete
    const timer = setTimeout(() => {
      firstRenderRef.current = false;
    }, 50);
    return () => clearTimeout(timer);
  }, []);
  
  // Don't show loading state if this is the first render or during stage transitions
  // This prevents flickering during stage navigation
  const shouldShowLoading = isLoading && 
                          !isStageTransitioning && 
                          !firstRenderRef.current;
  
  // Loading state
  if (shouldShowLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        opacity: isStageTransitioning ? 0 : 1,
        transition: 'opacity 0.15s ease-in-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '15px' }}>
          <p style={{ fontWeight: 'bold' }}>Loading survey data...</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            {retryCountRef.current > 0 ? `Attempt ${retryCountRef.current + 1}/${maxRetries + 1}` : ''}
          </p>
        </div>
        
        {/* Simple loading bar */}
        <div style={{ 
          height: '4px', 
          width: '100%', 
          backgroundColor: '#f0f0f0', 
          borderRadius: '2px', 
          overflow: 'hidden', 
          marginBottom: '20px' 
        }}>
          <div style={{ 
            height: '100%', 
            width: '30%', 
            backgroundColor: '#4285f4',
            animation: 'loading 1.5s infinite ease-in-out',
            transformOrigin: 'left center'
          }} />
        </div>
        
        <style jsx>{`
          @keyframes loading {
            0% { transform: translateX(0) scaleX(0.1); }
            50% { transform: translateX(300%) scaleX(1.5); }
            100% { transform: translateX(1000%) scaleX(0.1); }
          }
        `}</style>
      </div>
    );
  }
  
  // During stage transitions, if we have questions, render them directly 
  // without showing loading to prevent flickering
  if (isLoading && questions.length > 0) {
    isLoading = false; // Override loading state
  }
  
  // Error state 
  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px' 
      }}>
        <div style={{ marginBottom: '15px' }}>
          <h3 style={{ margin: '0 0 10px 0' }}>{currentStage.title || "Survey"}</h3>
          <div style={{ 
            padding: '10px',
            backgroundColor: '#fff0f0', 
            border: '1px solid #ffd7d7',
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            <p style={{ color: '#d32f2f', margin: '0 0 10px 0' }}>
              <strong>Error: </strong>{error}
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <button 
            onClick={handleRefresh}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
          
          <button 
            onClick={nextStageHandler}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Skip to Next Stage
          </button>
        </div>
      </div>
    );
  }
  
  // No questions case
  if (!questions.length) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px' 
      }}>
        <h3>{surveyData?.title || currentStage.title || "Survey"}</h3>
        <p>No questions found.</p>
        <button 
          onClick={nextStageHandler}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Next Stage
        </button>
      </div>
    );
  }
  
  // Main survey rendering - carousel of questions
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'white',
      border: '1px solid #ccc',
      borderRadius: '4px',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <h3 style={{ marginBottom: '20px' }}>
        {surveyData?.title || currentStage.title || "Survey"}
      </h3>
      
      {currentQuestion && (
        <div style={{ margin: '20px 0', padding: '10px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '15px' }}>
            {currentQuestion.text}
          </p>
          
          {/* Question UI based on type */}
          {currentQuestion.type === 'text' && (
            <input 
              type="text" 
              placeholder="Your answer" 
              style={{ 
                display: 'block', 
                width: '100%', 
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                marginTop: '10px' 
              }}
            />
          )}
          
          {currentQuestion.type === 'multipleChoice' && (
            <div style={{ marginTop: '10px' }}>
              {Array.isArray(currentQuestion.options) && currentQuestion.options.map((option, idx) => (
                <div key={idx} style={{ margin: '10px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="radio" 
                      name="choice" 
                      style={{ marginRight: '10px' }} 
                    /> 
                    <span>{option}</span>
                  </label>
                </div>
              ))}
            </div>
          )}
          
          {currentQuestion.type === 'checkboxes' && (
            <div style={{ marginTop: '10px' }}>
              {Array.isArray(currentQuestion.options) && currentQuestion.options.map((option, idx) => (
                <div key={idx} style={{ margin: '10px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="checkbox" 
                      style={{ marginRight: '10px' }} 
                    /> 
                    <span>{option}</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div style={{ 
        marginTop: '30px', 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <button 
          onClick={handlePrev} 
          disabled={currentIndex === 0}
          style={{ 
            padding: '8px 16px',
            backgroundColor: currentIndex === 0 ? '#ccc' : '#f0f0f0',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === 0 ? 0.5 : 1 
          }}
        >
          Previous
        </button>
        
        <span style={{ fontSize: '14px', color: '#666' }}>
          Question {currentIndex + 1} of {questions.length}
        </span>
        
        <button 
          onClick={handleNext}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {hasMoreQuestions ? 'Next' : 'Finish'}
        </button>
      </div>
    </div>
  );
};

// Define a comparison function for React.memo to prevent unnecessary re-renders
const arePropsEqual = (prevProps, nextProps) => {
  // Always re-render if stage changes
  if (prevProps.stage?.id !== nextProps.stage?.id) return false;
  
  // Always re-render if survey ID changes
  if (prevProps.stage?.surveyId !== nextProps.stage?.surveyId) return false;
  
  // Always re-render if a forced refresh is requested
  if (prevProps.forceRefreshSignal !== nextProps.forceRefreshSignal) return false;
  
  // Otherwise, consider props equal
  return true;
};

// Export the memoized component
export default React.memo(SurveyStageComponent, arePropsEqual);