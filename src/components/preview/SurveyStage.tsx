'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

// Ultra-minimal survey component for preview only - fixed for stability
// Create a memoized version of the component to prevent unnecessary re-renders
function SurveyStageComponent({ 
  externalNextHandler, 
  forceRefreshSignal,
  stage: propStage  // Accept stage as a prop
}: { 
  externalNextHandler?: () => void;
  forceRefreshSignal?: boolean;
  stage?: any;  // Allow stage to be passed from parent
}) {
  // Get context stage but prefer the prop stage
  const { currentStage: contextStage, goToNextStage } = usePreview();
  
  // Use prop stage if available, otherwise fall back to context stage
  // This should fix issues where the component is used both directly and as a child
  const currentStage = propStage || contextStage;
  
  // Only log stage source when debugging is needed
  const hasLoggedStageSource = useRef(false);
  useEffect(() => {
    // Only log once per component instance to reduce console spam
    if (hasLoggedStageSource.current) return;
    
    if (!propStage && !contextStage) {
      console.error('SurveyStage has no stage data from props or context!');
    }
    
    hasLoggedStageSource.current = true;
  }, [propStage, contextStage]);
  
  // Use external handler if provided, otherwise use context handler
  const nextStageHandler = externalNextHandler || goToNextStage;
  const [surveyData, setSurveyData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasAttemptedFetch = useRef(false);
  
  // Track the previous value of forceRefreshSignal to detect changes
  const prevForceRefreshSignal = useRef(forceRefreshSignal);
  
  // Function to fetch survey data that can be called multiple times
  const fetchSurveyData = useCallback(async (isRefresh = false) => {
    // For instructions type, we just show the content directly without fetch
    if (currentStage?.type === 'instructions') {
      // Create synthetic survey data from instructions content
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
      
      // Only log if this is an explicit refresh, not on normal render
      if (isRefresh) {
        console.log("Using instructions content as survey data");
      }
      
      setSurveyData(instructionsSurvey);
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }
    
    // Regular survey flow
    if (!currentStage?.surveyId) {
      setError("No survey ID available");
      setIsLoading(false);
      return;
    }
    
    try {
      // Show loading or refreshing state
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      console.log(`Fetching survey data for ID: ${currentStage.surveyId} (${isRefresh ? 'refresh' : 'initial'})`);
      
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
          console.log("Survey data loaded successfully");
          // Set survey data state
          setSurveyData(data.survey);
          setError(null); // Clear any previous errors
        } else {
          console.error("Invalid survey data structure:", data);
          setError("Survey data structure invalid");
        }
      } else {
        console.error(`Failed to load survey: ${response.status}`);
        setError(`Failed to load survey (${response.status})`);
      }
    } catch (error) {
      console.error("Failed to load survey:", error);
      setError("Error loading survey: " + (error.message || "Unknown error"));
    } finally {
      // Reset loading states
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentStage?.surveyId, currentStage?.type, currentStage?.title, currentStage?.description, currentStage?.content]);
  
  // Handle manual refresh button click
  const handleRefresh = useCallback(() => {
    fetchSurveyData(true);
  }, [fetchSurveyData]);
  
  // Keep track of fetched survey IDs in localStorage as a more permanent solution
  // This will prevent refetching even when the component remounts
  const didMountRef = useRef(false);
  
  // One-time fetch survey data at component mount with cross-session tracking
  useEffect(() => {
    if (didMountRef.current) {
      // Already mounted - do nothing
      return;
    }
    
    // Mark as mounted to prevent multiple executions
    didMountRef.current = true;
    
    // For instructions type, we just show the content directly without fetch
    if (currentStage?.type === 'instructions') {
      // Reduced logging to prevent console spam
      fetchSurveyData(false);
      return;
    }
    
    // Skip if no valid survey ID
    if (!currentStage?.surveyId) {
      // Reduced logging
      return;
    }
    
    // Use localStorage to track fetched surveys
    const STORAGE_KEY = 'fetchedSurveys';
    const fetchedSurveys = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const surveyKey = currentStage.surveyId;
    
    // Check if we've fetched this survey recently (within last 5 minutes)
    const now = Date.now();
    const recentThreshold = 5 * 60 * 1000; // 5 minutes
    
    if (fetchedSurveys[surveyKey] && (now - fetchedSurveys[surveyKey]) < recentThreshold) {
      // Skip silently using cached data
      return;
    }
    
    // Mark this survey as fetched with timestamp
    fetchedSurveys[surveyKey] = now;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fetchedSurveys));
    
    // Fetch once with delay to avoid race conditions
    const timeoutId = setTimeout(() => {
      fetchSurveyData(false);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [currentStage?.type, currentStage?.surveyId, fetchSurveyData]);
  
  // Effect to handle forced refresh from parent component
  useEffect(() => {
    // Check if forceRefreshSignal changed from false to true
    if (forceRefreshSignal === true && prevForceRefreshSignal.current === false) {
      console.log('Force refresh triggered from parent component');
      
      // Reset local storage cache for this survey if available
      if (currentStage?.surveyId) {
        try {
          const STORAGE_KEY = 'fetchedSurveys';
          const fetchedSurveys = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
          delete fetchedSurveys[currentStage.surveyId];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(fetchedSurveys));
        } catch (e) {
          console.error('Error clearing survey cache:', e);
        }
      }
      
      // Clear any existing errors
      setError(null);
      
      // Set loading state
      setIsLoading(true);
      
      // Fetch survey data directly without delay
      if (currentStage?.surveyId) {
        fetchSurveyData(true);
      } else if (currentStage?.type === 'instructions') {
        fetchSurveyData(true);
      } else {
        setError("No valid survey data available for refresh");
        setIsLoading(false);
      }
    }
    
    // Update previous value reference
    prevForceRefreshSignal.current = forceRefreshSignal;
  }, [forceRefreshSignal, currentStage, fetchSurveyData]);
  
  // Validate stage but accept both survey and instructions types
  if (!currentStage) {
    console.error('Survey stage error: currentStage is null or undefined');
    return <div style={{ padding: '20px', backgroundColor: 'white' }}>
      <p>Error: Stage data not available</p>
      <button onClick={handleRefresh} style={{marginTop: '10px', padding: '5px 10px', backgroundColor: '#4285f4', color: 'white', border: 'none', borderRadius: '4px'}}>
        Try Refresh
      </button>
    </div>;
  }
  
  // Accept both survey and instructions types for maximum compatibility
  const isSupportedType = currentStage.type === 'survey' || currentStage.type === 'instructions';
  
  if (!isSupportedType) {
    console.error(`Survey stage error: Expected type 'survey' or 'instructions' but got '${currentStage.type}'`, currentStage);
    return <div style={{ padding: '20px', backgroundColor: 'white' }}>
      <p>Error: Unsupported stage type ({currentStage.type})</p>
      <p>Expected: survey or instructions</p>
      <pre style={{fontSize: '12px', padding: '10px', backgroundColor: '#f5f5f5', overflowX: 'auto', marginTop: '10px'}}>
        {JSON.stringify(currentStage, null, 2)}
      </pre>
    </div>;
  }
  
  // Handle loading state with timeout detection
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  // Effect to detect prolonged loading
  useEffect(() => {
    if (!isLoading) {
      setLoadingTimeout(false);
      return;
    }
    
    // Set a timeout to detect if loading is taking too long
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setLoadingTimeout(true);
      }
    }, 5000); // 5 seconds
    
    return () => clearTimeout(timeoutId);
  }, [isLoading]);
  
  // Handle loading state
  if (isLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <div>
            <p>{loadingTimeout ? 'Still loading survey data...' : 'Loading survey data...'}</p>
            {loadingTimeout && (
              <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                This is taking longer than expected. You can try refreshing.
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              padding: '5px 10px',
              backgroundColor: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              opacity: isRefreshing ? 0.5 : 1
            }}
          >
            Refresh Data
          </button>
        </div>
        
        {/* Loading progress bar */}
        <div style={{ height: '4px', width: '100%', backgroundColor: '#f0f0f0', borderRadius: '2px', overflow: 'hidden' }}>
          <div 
            style={{ 
              height: '100%', 
              width: '30%', 
              backgroundColor: loadingTimeout ? '#ff9800' : '#4285f4',
              animation: 'loading 1.5s infinite ease-in-out',
              transformOrigin: 'left center'
            }} 
          />
        </div>
        
        {/* Skip button shows after timeout */}
        {loadingTimeout && (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={() => { setIsLoading(false); setError("Loading skipped by user"); }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Skip Loading
            </button>
          </div>
        )}
        
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
  
  // Handle error state 
  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px' 
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
          <h3 style={{ margin: 0 }}>{currentStage.title || "Survey"}</h3>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            style={{
              padding: '5px 10px',
              backgroundColor: isRefreshing ? '#ccc' : '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: isRefreshing ? 'not-allowed' : 'pointer'
            }}
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh Survey Data'}
          </button>
        </div>
        
        <div style={{ 
          padding: '10px',
          marginBottom: '15px', 
          backgroundColor: '#fff0f0', 
          border: '1px solid #ffd7d7',
          borderRadius: '4px'
        }}>
          <p style={{ color: '#d32f2f', margin: '0 0 10px 0' }}>
            <strong>Error: </strong>{error}
          </p>
          <p style={{ margin: '0', fontSize: '14px' }}>
            Trying to use static questions if available. You can also try to refresh the data.
          </p>
        </div>
        
        {currentStage.questions && currentStage.questions.length > 0 ? (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#f5f5f5', 
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            <p style={{ margin: '0' }}>
              <strong>Fallback available:</strong> {currentStage.questions.length} static questions found
            </p>
          </div>
        ) : (
          <div style={{ 
            padding: '10px', 
            backgroundColor: '#fff9e6', 
            border: '1px solid #ffe7a0',
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            <p style={{ margin: '0', color: '#856404' }}>
              <strong>Warning:</strong> No static questions available as fallback
            </p>
          </div>
        )}
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
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
  
  // Get questions from survey data or fallback to inline
  // Use safe, stable accessor patterns to prevent undefined errors
  const questions = [];
  
  // First try to get questions from MongoDB survey data
  if (surveyData && Array.isArray(surveyData.questions)) {
    questions.push(...surveyData.questions);
  } 
  // Then fallback to inline questions from the stage
  else if (currentStage && Array.isArray(currentStage.questions)) {
    questions.push(...currentStage.questions);
  }
  
  // Track if we've already logged the question count (for selective logging)
  const hasLoggedQuestions = useRef(false);
  
  // Only log questions when they change, not on every render
  useEffect(() => {
    if (!hasLoggedQuestions.current && questions.length > 0) {
      console.log(`Loaded ${questions.length} questions for survey`);
      hasLoggedQuestions.current = true;
    }
  }, [questions.length]);
  
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
  
  const currentQuestion = questions[currentIndex] || null;
  const hasMoreQuestions = currentIndex < questions.length - 1;
  
  const handleNext = () => {
    if (hasMoreQuestions) {
      console.log('Moving to next question:', currentIndex + 1);
      setCurrentIndex(currentIndex + 1);
    } else {
      console.log('No more questions, going to next stage');
      // Ensure the appropriate next handler is called
      try {
        nextStageHandler(); // Use the external handler if provided
      } catch (error) {
        console.error('Error in nextStageHandler:', error);
      }
    }
  };
  
  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  // Super-minimal rendering of questions - absolute bare minimum for stability
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'white',
      border: '1px solid #ccc',
      borderRadius: '4px',
      maxWidth: '600px',
      margin: '0 auto'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>
          {surveyData?.title || currentStage.title || "Survey"}
        </h3>
        
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{
            padding: '5px 10px',
            backgroundColor: isRefreshing ? '#ccc' : '#f5f5f5',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '12px',
            cursor: isRefreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          {isRefreshing ? 'Refreshing...' : 'Refresh Survey'}
          {isRefreshing && (
            <span style={{ 
              display: 'inline-block', 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              border: '2px solid #ccc',
              borderTopColor: '#666',
              animation: 'spin 1s linear infinite'
            }}></span>
          )}
        </button>
        
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
      
      {currentQuestion && (
        <div style={{ margin: '20px 0', padding: '10px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '15px' }}>
            {currentQuestion.text}
          </p>
          
          {/* Ultra-minimal question UI based on type */}
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
}

// Define a custom comparison function for React.memo
// This prevents unnecessary re-renders by only updating when important props change
const arePropsEqual = (prevProps, nextProps) => {
  // Always re-render when forceRefreshSignal changes from false to true
  if (nextProps.forceRefreshSignal === true && prevProps.forceRefreshSignal === false) {
    return false;
  }
  
  // Check if stage ID changed
  const prevStageId = prevProps.stage?.id;
  const nextStageId = nextProps.stage?.id;
  if (prevStageId !== nextStageId) {
    return false;
  }
  
  // Check if stage type changed
  const prevType = prevProps.stage?.type;
  const nextType = nextProps.stage?.type;
  if (prevType !== nextType) {
    return false;
  }
  
  // Check if surveyId changed
  const prevSurveyId = prevProps.stage?.surveyId;
  const nextSurveyId = nextProps.stage?.surveyId;
  if (prevSurveyId !== nextSurveyId) {
    return false;
  }
  
  // Otherwise, consider props equal and prevent re-render
  return true;
};

// Export the memoized component to prevent unnecessary re-renders
export default React.memo(SurveyStageComponent, arePropsEqual);