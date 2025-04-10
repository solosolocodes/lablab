'use client';

import { useState, useEffect, useRef } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

// Ultra-minimal survey component for preview only - fixed for stability
export default function SurveyStage({ externalNextHandler }: { externalNextHandler?: () => void }) {
  const { currentStage, goToNextStage } = usePreview();
  
  // Use external handler if provided, otherwise use context handler
  const nextStageHandler = externalNextHandler || goToNextStage;
  const [surveyData, setSurveyData] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasAttemptedFetch = useRef(false);
  
  // One-time fetch survey data at component mount with loading state protection
  useEffect(() => {
    if (currentStage?.type !== 'survey' || !currentStage?.surveyId || hasAttemptedFetch.current) {
      return;
    }
    
    hasAttemptedFetch.current = true; // Set flag to prevent multiple fetches
    
    const fetchSurvey = async () => {
      try {
        // Show loading state while fetching
        setIsLoading(true);
        
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
            // Set survey data state
            setSurveyData(data.survey);
          } else {
            setError("Survey data structure invalid");
          }
        } else {
          setError("Failed to load survey");
        }
      } catch (error) {
        console.error("Failed to load survey:", error);
        setError("Error loading survey");
      } finally {
        // Always turn off loading state
        setIsLoading(false);
      }
    };
    
    // Fetch with delay to avoid race conditions with rendering
    const timeoutId = setTimeout(() => {
      fetchSurvey();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [currentStage]);
  
  // Validate stage
  if (!currentStage || currentStage.type !== 'survey') {
    return <div style={{ padding: '20px', backgroundColor: 'white' }}>Invalid stage</div>;
  }
  
  // Handle loading state
  if (isLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px' 
      }}>
        <p>Loading survey data...</p>
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
        <h3>{currentStage.title || "Survey"}</h3>
        <p style={{ color: 'red' }}>{error}</p>
        <p>Falling back to static questions if available.</p>
        {currentStage.questions && currentStage.questions.length > 0 ? (
          <p>Static questions available: {currentStage.questions.length}</p>
        ) : (
          <p>No static questions available.</p>
        )}
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
      <h3 style={{ marginBottom: '20px' }}>
        {surveyData?.title || currentStage.title || "Survey"}
      </h3>
      
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