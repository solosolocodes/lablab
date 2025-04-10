'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

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
  // Core state
  const { currentStage: contextStage, goToNextStage } = usePreview();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [surveyData, setSurveyData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // API call retry mechanism
  const [shouldRetry, setShouldRetry] = useState(false);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const retryDelay = 200; // milliseconds
  
  // Use prop stage if available, otherwise fall back to context stage
  const currentStage = useMemo(() => propStage || contextStage, [propStage, contextStage]);
  
  // Use external handler if provided, otherwise use context handler
  const nextStageHandler = useMemo(() => externalNextHandler || goToNextStage, [externalNextHandler, goToNextStage]);
  
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
  
  // Main fetch function
  const fetchSurveyData = useCallback(async () => {
    // For instructions type, we create synthetic survey data
    if (currentStage?.type === 'instructions') {
      const instructionsSurvey = {
        title: currentStage.title || "Instructions",
        description: currentStage.description || "",
        questions: [
          {
            id: "instructions-question",
            type: "text",
            text: currentStage.content || "Please review the instructions and continue when ready.",
            required: false
          }
        ]
      };
      
      setSurveyData(instructionsSurvey);
      setIsLoading(false);
      return true; // Successfully loaded data
    }
    
    // Regular survey flow
    if (!currentStage?.surveyId) {
      setError("No survey ID available");
      setIsLoading(false);
      return false; // Failed to load data
    }
    
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`/api/admin/surveys/${currentStage.surveyId}?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.survey) {
          setSurveyData(data.survey);
          setError(null);
          setIsLoading(false);
          return true; // Successfully loaded data
        } else {
          setError("Survey data structure invalid");
          return false; // Failed to load data
        }
      } else {
        setError(`Failed to load survey (${response.status})`);
        return false; // Failed to load data
      }
    } catch (error) {
      setError("Error loading survey: " + (error.message || "Unknown error"));
      return false; // Failed to load data
    }
  }, [currentStage]);
  
  // Load data on initial mount
  useEffect(() => {
    let isMounted = true;
    let retryTimeoutId = null;
    
    // Reset retry count when stage changes
    retryCountRef.current = 0;
    
    const performFetch = async () => {
      if (!isMounted) return;
      
      console.log(`Fetching survey data (attempt ${retryCountRef.current + 1}/${maxRetries + 1})...`);
      setIsLoading(true);
      
      const success = await fetchSurveyData();
      
      // If component is unmounted, don't update state
      if (!isMounted) return;
      
      if (success) {
        // Successfully loaded data
        console.log('Successfully loaded survey data');
        setIsLoading(false);
        setShouldRetry(false);
      } else if (retryCountRef.current < maxRetries) {
        // Failed to load data, schedule retry
        retryCountRef.current += 1;
        console.log(`Scheduling retry ${retryCountRef.current} in ${retryDelay}ms...`);
        
        // Schedule retry
        retryTimeoutId = setTimeout(() => {
          setShouldRetry(prev => !prev); // Toggle to trigger effect
        }, retryDelay);
      } else {
        // Out of retries
        console.log('Failed to load survey data after all retries');
        setIsLoading(false);
      }
    };
    
    performFetch();
    
    // Cleanup
    return () => {
      isMounted = false;
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
    };
  }, [fetchSurveyData, shouldRetry, currentStage?.id]);
  
  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    console.log('Manual refresh triggered');
    retryCountRef.current = 0; // Reset retry count
    setIsLoading(true);
    fetchSurveyData().then(success => {
      if (!success) {
        setIsLoading(false);
      }
    });
  }, [fetchSurveyData]);
  
  // Handle parent's forceRefreshSignal
  useEffect(() => {
    if (forceRefreshSignal) {
      console.log('Parent-triggered refresh');
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
  
  // Loading state
  if (isLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px' 
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

// Define a simple comparison function for React.memo
const arePropsEqual = (prevProps, nextProps) => {
  // Re-render when forceRefreshSignal changes from false to true
  if (nextProps.forceRefreshSignal === true && prevProps.forceRefreshSignal === false) {
    return false;
  }
  
  // Re-render if stage ID changed
  const prevStageId = prevProps.stage?.id;
  const nextStageId = nextProps.stage?.id;
  if (prevStageId !== nextStageId) {
    return false;
  }
  
  // Otherwise, consider props equal
  return true;
};

// Export the memoized component
export default React.memo(SurveyStageComponent, arePropsEqual);