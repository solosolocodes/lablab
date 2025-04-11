'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

// Create singleton caches to track which surveys have been loaded and store their data
// Using a module-level cache that persists between renders and component instances
const loadedSurveys = new Set();
const loadedSurveysData = new Map(); // Maps surveyId to the actual data

// Debug counter to track render cycles - helps debug continuous fetching
let renderCount = 0;

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
  // Increment render counter for debugging
  renderCount++;
  console.log(`SurveyStage render #${renderCount}`);
  
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
    // Prioritize existing IDs
    if (currentStage?.id) {
      return currentStage.id;
    }
    if (currentStage?.surveyId) {
      return currentStage.surveyId;
    }

    // Handle instructions type specifically if no ID is present
    if (currentStage?.type === 'instructions') {
      // Use a stable identifier instead of Date.now()
      // For multiple instruction stages, we create a more unique stable ID
      // based on title or content if available
      if (currentStage.title) {
        return `instructions-${currentStage.title.toLowerCase().replace(/\s+/g, '-')}`;
      }
      
      console.warn("Instruction stage lacks a unique 'id', 'surveyId', or 'title'. Using generic identifier 'instructions-stage'.");
      return 'instructions-stage'; // Stable identifier
    }

    // Fallback if no identifiable information is found
    console.warn("Could not determine a stable stageId.");
    return null;
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
  
  // We no longer need to track current question as we display all questions
  
  // Reset component state when stage changes
  useEffect(() => {
    // Only run this on stage ID change
    if (stageId !== stageIdRef.current) {
      // Store current stage ID
      stageIdRef.current = stageId;
      
      // Reset retry counter
      retryCountRef.current = 0;
      
      // Important: reset the loading initiation tracker when stage changes
      hasInitiatedLoadingRef.current = false;
      
      console.log(`Stage changed to: ${stageId}`);
      
      // If we have data in the cache for this survey, retrieve it immediately
      if (stageId && loadedSurveys.has(stageId) && loadedSurveysData.has(stageId)) {
        console.log(`Loading survey ${stageId} from memory cache`);
        setSurveyData(loadedSurveysData.get(stageId));
        setIsLoading(false);
        setError(null);
      } 
      // Clear survey data if switching to a different stage that's not cached
      else if (stageId && !loadedSurveys.has(stageId)) {
        setSurveyData(null);
        setError(null);
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
    
    // Skip if we've already loaded this survey - this is the key check to prevent loops
    if (!force && stageId && loadedSurveys.has(stageId)) {
      console.log(`Skipping fetch: survey ${stageId} already loaded from global cache`);
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
          
          // Mark as loaded and store data
          if (stageId) {
            loadedSurveys.add(stageId);
            loadedSurveysData.set(stageId, instructionsSurvey);
          }
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
      
      // Use a longer timeout for survey fetch (15 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`/api/admin/surveys/${currentStage.surveyId}?t=${timestamp}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
            
            // Store survey data in the global cache by ID
            if (stageId) {
              console.log(`Adding survey ${stageId} to global cache`);
              loadedSurveys.add(stageId);
              loadedSurveysData.set(stageId, data.survey);
            }
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
  }, [currentStage, stageId]); // Remove questions.length from dependency array to prevent loops
  
  // Prevent the initial loading screen flash by immediately 
  // checking if we already have the data in our cache
  useEffect(() => {
    // Set immediate state based on whether data is already loaded
    if (stageId && loadedSurveys.has(stageId)) {
      // Data is already in our cache, no need to show loading
      setIsLoading(false);
    }
  }, [stageId]);
  
  // Create the current stageId ref at component level, not inside the effect
  const currentStageIdRef = useRef(stageId);
  
  // Update ref when stageId changes
  useEffect(() => {
    currentStageIdRef.current = stageId;
  }, [stageId]);
  
  // Use a ref to track whether we've already initiated loading for this stage
  const hasInitiatedLoadingRef = useRef(false);

  // Initial data loading - run only once per stage, with strict controls to prevent continuous loading
  useEffect(() => {
    const needsLoading = stageId && 
                        !hasInitiatedLoadingRef.current && 
                        !isFetchingRef.current && 
                        !loadedSurveys.has(stageId);
    
    // Log the decision process for debugging
    console.log(`Load decision for ${stageId}: ${needsLoading ? 'WILL LOAD' : 'SKIPPING'}`, {
      stageId: !!stageId,
      hasInitiatedLoading: hasInitiatedLoadingRef.current,
      isFetching: isFetchingRef.current,
      inCache: loadedSurveys.has(stageId)
    });
    
    // If we've determined we don't need to load, exit early
    if (!needsLoading) {
      // Still update state based on cache
      if (stageId && loadedSurveys.has(stageId) && loadedSurveysData.has(stageId)) {
        console.log(`Using cached data for survey ${stageId}`);
        setSurveyData(loadedSurveysData.get(stageId));
        setIsLoading(false);
        setError(null);
      }
      return;
    }

    // Mark that we've initiated loading for this stage - this is crucial to prevent loops
    hasInitiatedLoadingRef.current = true;
    
    // Reset retry counter
    retryCountRef.current = 0;
    
    // Show loading state
    setIsLoading(true);
    
    // Define loading function with retries
    const loadWithRetries = async () => {
      // Safety check - has component unmounted or stage changed?
      if (!isComponentMountedRef.current || currentStageIdRef.current !== stageId) return;
      
      console.log(`Loading survey data for stage ${stageId}`);
      const success = await fetchSurveyData();
      
      // If successful or unmounted, we're done
      if (!isComponentMountedRef.current || currentStageIdRef.current !== stageId || success) return;
      
      // Handle failure with retries
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log(`Retry ${retryCountRef.current}/${maxRetries} for survey ${stageId} in ${retryDelayMs}ms`);
        
        setTimeout(() => {
          if (isComponentMountedRef.current && currentStageIdRef.current === stageId) {
            loadWithRetries();
          }
        }, retryDelayMs);
      } else {
        console.log(`Failed to load survey ${stageId} after ${maxRetries} retries`);
      }
    };
    
    // Start the loading process
    loadWithRetries();
    
    // Clean up function
    return () => {
      if (stageId === currentStageIdRef.current) {
        isFetchingRef.current = false;
      }
    };
    
    // Only depend on stageId to ensure this runs exactly once per stage ID
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
    
    console.log('Manual refresh triggered for survey', stageId);
    lastRefreshTimeRef.current = now;
    
    // Reset loading states
    retryCountRef.current = 0;
    hasInitiatedLoadingRef.current = false;
    
    // Remove from loaded surveys to force a fresh fetch
    if (stageId) {
      loadedSurveys.delete(stageId);
      loadedSurveysData.delete(stageId);
      console.log(`Removed ${stageId} from cache for refresh`);
    }
    
    // Reset state
    setIsLoading(true);
    setError(null);
    setSurveyData(null);
    
    // Force fetch with cache clearing
    fetchSurveyData(true);
  }, [fetchSurveyData, stageId]);
  
  // Handle parent's forceRefreshSignal
  const lastRefreshSignalRef = useRef(false);
  
  useEffect(() => {
    // Only trigger refresh if the signal changed from false to true
    // This prevents multiple refreshes when the component re-renders
    const isNewRefreshSignal = forceRefreshSignal && !lastRefreshSignalRef.current;
    lastRefreshSignalRef.current = !!forceRefreshSignal;
    
    if (isNewRefreshSignal) {
      const now = Date.now();
      // Check if sufficient time has passed since last refresh
      if (now - lastRefreshTimeRef.current >= refreshMinIntervalMs) {
        console.log('Parent component triggered refresh for survey', stageId);
        handleRefresh();
      } else {
        console.log('Parent refresh ignored - too soon since last refresh');
      }
    }
  }, [forceRefreshSignal, handleRefresh, refreshMinIntervalMs, stageId]);
  
  // We no longer need Next/Prev handlers for carousel navigation
  // since we're showing all questions at once
  
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
  
  // Don't show loading state if:
  // 1. This is the first render
  // 2. During stage transitions
  // 3. We already have questions to show
  // This prevents flickering during stage navigation
  const shouldShowLoading = isLoading && 
                         !isStageTransitioning && 
                         !firstRenderRef.current &&
                         questions.length === 0;
  
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
  
  // Note: We handle the loading state in the shouldShowLoading variable above
  // If we have questions, we never show loading even if isLoading is true
  
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
  
  // Main survey rendering - display all questions at once
  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: 'white',
      border: '1px solid #ccc',
      borderRadius: '4px',
      maxWidth: '800px',
      margin: '0 auto'
    }}>
      <h3 style={{ marginBottom: '20px', color: '#333' }}>
        {surveyData?.title || currentStage.title || "Survey"}
      </h3>
      
      {/* Survey description if available */}
      {surveyData?.description && (
        <div style={{ marginBottom: '20px', color: '#666' }}>
          {surveyData.description}
        </div>
      )}

      {/* Display all questions in one view */}
      <div style={{ marginBottom: '20px' }}>
        {questions.length > 0 ? (
          <div>
            {questions.map((question, idx) => (
              <div key={question.id || idx} style={{ 
                margin: '0 0 25px 0', 
                padding: '15px', 
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9' 
              }}>
                <p style={{ 
                  fontWeight: 'bold', 
                  marginBottom: '15px',
                  color: '#333',
                  fontSize: '16px'
                }}>
                  {idx + 1}. {question.text}
                  {question.required && (
                    <span style={{ color: 'red', marginLeft: '4px' }}>*</span>
                  )}
                </p>
                
                {/* Question UI based on type */}
                {question.type === 'text' && (
                  <input 
                    type="text" 
                    placeholder="Your answer" 
                    style={{ 
                      display: 'block', 
                      width: '100%', 
                      padding: '10px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      marginTop: '10px' 
                    }}
                    disabled={true} // Disabled for preview
                  />
                )}
                
                {question.type === 'multipleChoice' && (
                  <div style={{ marginTop: '10px' }}>
                    {Array.isArray(question.options) && question.options.map((option, optIdx) => (
                      <div key={optIdx} style={{ margin: '10px 0' }}>
                        <label style={{ display: 'flex', alignItems: 'center' }}>
                          <input 
                            type="radio" 
                            name={`question-${idx}`} 
                            style={{ marginRight: '10px' }} 
                            disabled={true} // Disabled for preview
                          /> 
                          <span>{option}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {question.type === 'checkboxes' && (
                  <div style={{ marginTop: '10px' }}>
                    {Array.isArray(question.options) && question.options.map((option, optIdx) => (
                      <div key={optIdx} style={{ margin: '10px 0' }}>
                        <label style={{ display: 'flex', alignItems: 'center' }}>
                          <input 
                            type="checkbox" 
                            style={{ marginRight: '10px' }} 
                            disabled={true} // Disabled for preview
                          /> 
                          <span>{option}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {question.type === 'scale' && (
                  <div style={{ marginTop: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span>Min: {question.minValue || 1}</span>
                      <span>Max: {question.maxValue || 10}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      {Array.from({ length: (question.maxValue || 10) - (question.minValue || 1) + 1 }, (_, i) => i + (question.minValue || 1)).map(num => (
                        <label key={num} style={{ textAlign: 'center' }}>
                          <input 
                            type="radio" 
                            name={`scale-${idx}`}
                            style={{ display: 'block', margin: '0 auto 5px' }}
                            disabled={true} // Disabled for preview
                          />
                          <span>{num}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                
                {question.type === 'rating' && (
                  <div style={{ marginTop: '15px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                    {Array.from({ length: question.maxRating || 5 }, (_, i) => i + 1).map(star => (
                      <div key={star} style={{ textAlign: 'center' }}>
                        <label>
                          <input 
                            type="radio" 
                            name={`rating-${idx}`}
                            style={{ display: 'block', margin: '0 auto 5px' }}
                            disabled={true} // Disabled for preview
                          />
                          <span style={{ fontSize: '24px', color: '#ffd700' }}>★</span>
                          <span style={{ display: 'block', fontSize: '12px' }}>{star}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: '#666' }}>
            No questions found in this survey.
          </p>
        )}
      </div>
      
      {/* Survey footer with Next button */}
      <div style={{ 
        marginTop: '20px', 
        display: 'flex', 
        justifyContent: 'flex-end',
        borderTop: '1px solid #eee',
        paddingTop: '20px'
      }}>
        <div style={{ marginRight: 'auto', color: '#666', fontSize: '14px' }}>
          {questions.length} {questions.length === 1 ? 'question' : 'questions'} total
        </div>
        
        <button 
          onClick={nextStageHandler}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Next Stage
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