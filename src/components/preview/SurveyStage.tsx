'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePreview } from '@/contexts/PreviewContext';

interface Question {
  id: string;
  text: string;
  type: 'text' | 'multipleChoice' | 'checkboxes' | 'rating' | 'scale';
  required: boolean;
  options?: string[];
  minValue?: number;
  maxValue?: number;
  maxRating?: number;
  order?: number;
}

interface SurveyData {
  _id: string;
  title: string;
  description: string;
  questions: Question[];
  status: 'draft' | 'published' | 'archived';
}

export default function SurveyStage() {
  const { currentStage, goToNextStage } = usePreview();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [isLoadingSurvey, setIsLoadingSurvey] = useState(false);
  const [isPreparingQuestions, setIsPreparingQuestions] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Function to fetch survey data from MongoDB
  const fetchSurveyData = useCallback(async (surveyId: string) => {
    if (!surveyId) {
      setLoadError('No survey ID provided');
      return;
    }

    try {
      setIsLoadingSurvey(true);
      console.log('Fetching survey data for ID:', surveyId);
      
      // Add a cache buster to prevent caching issues
      const cacheBuster = Date.now();
      const response = await fetch(`/api/admin/surveys/${surveyId}?t=${cacheBuster}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch survey: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Survey data received:', data);
      
      if (data.success && data.survey) {
        // Start preparation state with loading indicator
        setIsPreparingQuestions(true);
        setIsLoadingSurvey(false);
        
        // Use setTimeout to create a deliberate delay before showing questions
        setTimeout(() => {
          setSurveyData(data.survey);
          // Reset to first question
          setCurrentQuestionIndex(0);
          setFormValues({});
          setValidationErrors({});
          setIsPreparingQuestions(false);
        }, 3000); // 3 second delay before showing questions
      } else {
        throw new Error('Invalid survey data format');
      }
    } catch (error) {
      console.error('Error fetching survey data:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to load survey');
      setIsLoadingSurvey(false);
    }
  }, []);

  // Fetch survey data when the component mounts, if surveyId is available
  useEffect(() => {
    if (currentStage?.type === 'survey' && currentStage.surveyId) {
      fetchSurveyData(currentStage.surveyId);
    }
  }, [currentStage, fetchSurveyData]);

  if (!currentStage || currentStage.type !== 'survey') {
    return <div>Invalid stage type</div>;
  }

  // Use questions from MongoDB survey or fall back to inline questions
  const questions = (surveyData?.questions || currentStage.questions || [])
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  
  const currentQuestion = questions[currentQuestionIndex] || null;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const progress = questions.length > 0 ? ((currentQuestionIndex + 1) / questions.length) * 100 : 0;
  
  // Update validation as user makes changes
  useEffect(() => {
    if (!currentQuestion) return;
    
    // Clear error when user changes any value
    if (formValues[currentQuestion.id]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[currentQuestion.id];
        return newErrors;
      });
    }
  }, [formValues, currentQuestion]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInputChange = (questionId: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const validateCurrentQuestion = (): boolean => {
    if (!currentQuestion) return true;
    
    // Check if current question is required and has a value
    if (currentQuestion.required && !formValues[currentQuestion.id]) {
      setValidationErrors(prev => ({
        ...prev,
        [currentQuestion.id]: 'This question requires an answer'
      }));
      return false;
    }
    
    return true;
  };

  // Add state for question transition
  const [isQuestionTransitioning, setIsQuestionTransitioning] = useState(false);
  
  const handleNext = () => {
    // Validate current question first
    if (!validateCurrentQuestion()) return;
    
    // Start transition animation
    setIsQuestionTransitioning(true);
    
    // Move to next question if not the last one
    if (!isLastQuestion) {
      // Delay to create smooth transition effect
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev + 1);
        setIsQuestionTransitioning(false);
      }, 400); // Short delay for question transition
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      // Start transition animation
      setIsQuestionTransitioning(true);
      
      // Delay to create smooth transition effect
      setTimeout(() => {
        setCurrentQuestionIndex(prev => prev - 1);
        setIsQuestionTransitioning(false);
      }, 400); // Short delay for question transition
    }
  };

  const handleSubmit = () => {
    // Check if all required questions are answered
    const requiredQuestions = questions.filter((q: Question) => q.required);
    const unansweredQuestions = requiredQuestions.filter((q: Question) => !formValues[q.id]);
    
    if (unansweredQuestions.length > 0) {
      const newValidationErrors: Record<string, string> = {};
      
      unansweredQuestions.forEach(q => {
        newValidationErrors[q.id] = 'This question requires an answer';
      });
      
      setValidationErrors(newValidationErrors);
      
      // If current question is not answered, show error
      // Otherwise, jump to the first unanswered question
      if (newValidationErrors[currentQuestion?.id || '']) {
        return;
      } else {
        const firstUnansweredIndex = questions.findIndex(q => 
          q.id === unansweredQuestions[0].id
        );
        setCurrentQuestionIndex(firstUnansweredIndex);
        return;
      }
    }
    
    // If all validations pass, show thank you message and proceed
    setIsSubmitting(true);
    setShowThankYou(true);
    
    // After a delay, go to the next stage
    setTimeout(() => {
      goToNextStage();
    }, 1500);
  };

  const renderQuestionInput = (question: Question) => {
    const hasError = !!validationErrors[question.id];
    
    switch (question.type) {
      case 'text':
        return (
          <>
            <input
              type="text"
              className={`w-full px-3 py-2 border rounded-md ${hasError ? 'border-red-500' : 'border-gray-300'}`}
              value={formValues[question.id] || ''}
              onChange={e => handleInputChange(question.id, e.target.value)}
              disabled={isSubmitting}
              placeholder="Type your answer here..."
            />
            {hasError && <p className="text-red-500 text-sm mt-1">{validationErrors[question.id]}</p>}
          </>
        );
      
      case 'multipleChoice':
        return (
          <div className="space-y-3">
            {(question.options || []).map((option: string, idx: number) => (
              <div 
                key={idx} 
                className={`flex items-center p-3 border rounded-md ${
                  formValues[question.id] === option 
                    ? 'bg-purple-50 border-purple-300' 
                    : 'border-gray-200 hover:bg-gray-50'
                } cursor-pointer transition-colors`}
                onClick={() => handleInputChange(question.id, option)}
              >
                <div className={`w-5 h-5 rounded-full border ${
                  formValues[question.id] === option 
                    ? 'border-purple-500 bg-purple-500' 
                    : 'border-gray-400'
                } flex items-center justify-center mr-3`}>
                  {formValues[question.id] === option && (
                    <span className="text-white text-xs">✓</span>
                  )}
                </div>
                <label className="cursor-pointer flex-1">{option}</label>
              </div>
            ))}
            {hasError && <p className="text-red-500 text-sm mt-1">{validationErrors[question.id]}</p>}
          </div>
        );
      
      case 'checkboxes':
        return (
          <div className="space-y-3">
            {(question.options || []).map((option: string, idx: number) => {
              const values = formValues[question.id] || [];
              const isChecked = values.includes(option);
              
              return (
                <div 
                  key={idx} 
                  className={`flex items-center p-3 border rounded-md ${
                    isChecked 
                      ? 'bg-purple-50 border-purple-300' 
                      : 'border-gray-200 hover:bg-gray-50'
                  } cursor-pointer transition-colors`}
                  onClick={() => {
                    const updatedValues = isChecked
                      ? (formValues[question.id] || []).filter((v: string) => v !== option)
                      : [...(formValues[question.id] || []), option];
                    handleInputChange(question.id, updatedValues);
                  }}
                >
                  <div className={`w-5 h-5 rounded border ${
                    isChecked 
                      ? 'border-purple-500 bg-purple-500' 
                      : 'border-gray-400'
                  } flex items-center justify-center mr-3`}>
                    {isChecked && (
                      <span className="text-white text-xs">✓</span>
                    )}
                  </div>
                  <label className="cursor-pointer flex-1">{option}</label>
                </div>
              );
            })}
            {hasError && <p className="text-red-500 text-sm mt-1">{validationErrors[question.id]}</p>}
          </div>
        );
      
      case 'rating':
        const maxRating = question.maxRating || 5;
        return (
          <div className="my-4">
            <div className="flex space-x-2 justify-between">
              {Array.from({length: maxRating}, (_, i) => i + 1).map(rating => (
                <button
                  key={rating}
                  type="button"
                  className={`w-12 h-12 rounded-full ${
                    formValues[question.id] === rating
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  } transition-colors`}
                  onClick={() => handleInputChange(question.id, rating)}
                  disabled={isSubmitting}
                >
                  {rating}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-sm text-gray-500">
              <span>Poor</span>
              <span>Excellent</span>
            </div>
            {hasError && <p className="text-red-500 text-sm mt-1">{validationErrors[question.id]}</p>}
          </div>
        );
        
      case 'scale':
        const minValue = question.minValue || 1;
        const maxValue = question.maxValue || 10;
        const scaleValues = Array.from(
          {length: maxValue - minValue + 1}, 
          (_, i) => i + minValue
        );
        
        return (
          <div className="my-4">
            <div className="flex justify-between mb-2">
              {scaleValues.map(value => (
                <button
                  key={value}
                  type="button"
                  className={`w-8 h-8 rounded-full ${
                    formValues[question.id] === value
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200'
                  } text-sm transition-colors flex items-center justify-center`}
                  onClick={() => handleInputChange(question.id, value)}
                  disabled={isSubmitting}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>{minValue}</span>
              <span>{maxValue}</span>
            </div>
            {hasError && <p className="text-red-500 text-sm mt-1">{validationErrors[question.id]}</p>}
          </div>
        );
      
      default:
        return <div>Unsupported question type</div>;
    }
  };

  // Show thank you message
  if (showThankYou) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Thank You!</h2>
          <p className="text-gray-600 mb-6">Your responses have been recorded.</p>
          <p className="text-purple-600">Proceeding to next stage...</p>
        </div>
      </div>
    );
  }

  // No questions
  if (questions.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{currentStage.title}</h2>
          <p className="text-gray-600 mb-6">{currentStage.description}</p>
          <p className="text-gray-700 mb-6">This survey has no questions.</p>
          <button
            onClick={goToNextStage}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium shadow-md"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Loading state - with different messages for fetching vs preparing
  if (isLoadingSurvey || isPreparingQuestions) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent mb-4"></div>
          
          {isLoadingSurvey ? (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Loading Survey Questions</h2>
              <p className="text-gray-600">Please wait while we fetch the survey from the database...</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Preparing Your Questions</h2>
              <p className="text-gray-600">Setting up your survey experience...</p>
              
              <div className="mt-6 max-w-md mx-auto">
                <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                </div>
                <p className="text-sm text-gray-500 mt-2">Almost ready...</p>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Error state
  if (loadError) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-3xl">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="bg-red-50 rounded-lg p-4 mb-4 border border-red-100">
            <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Survey</h2>
            <p className="text-gray-700">{loadError}</p>
          </div>
          <p className="text-gray-600 mb-4">Using fallback questions if available.</p>
          <button
            onClick={() => goToNextStage()}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
          >
            Skip to Next Stage
          </button>
        </div>
      </div>
    );
  }

  // Question carousel
  return (
    <div className="container mx-auto py-8 px-4 max-w-3xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Use survey title/description from MongoDB if available, otherwise fall back to stage values */}
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {surveyData?.title || currentStage.title}
        </h2>
        <p className="text-gray-600 mb-4">
          {surveyData?.description || currentStage.description}
        </p>
        
        {/* MongoDB source indicator */}
        {surveyData && (
          <p className="text-xs text-blue-600 mb-6">
            Survey loaded from MongoDB (ID: {surveyData._id})
          </p>
        )}
        
        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
          <div 
            className="bg-purple-600 h-2.5 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        {/* Question count */}
        <div className="flex justify-between text-sm text-gray-500 mb-8">
          <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
          <span>{Math.round(progress)}% complete</span>
        </div>
        
        {/* Current question with transition effect */}
        {currentQuestion && (
          <div 
            className={`mb-8 transition-opacity duration-300 ${
              isQuestionTransitioning ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className="flex items-start mb-4">
              <div className="bg-purple-100 text-purple-700 rounded-full w-8 h-8 flex items-center justify-center mr-3 font-medium">
                {currentQuestionIndex + 1}
              </div>
              <div className="flex-1">
                <label className="block font-medium text-gray-800 text-lg">
                  {currentQuestion.text}
                  {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              </div>
            </div>
            
            <div className="ml-11">
              {renderQuestionInput(currentQuestion)}
            </div>
          </div>
        )}
        
        {/* Navigation buttons */}
        <div className="flex justify-between mt-8 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0 || isSubmitting || isQuestionTransitioning}
            className={`px-4 py-2 rounded ${
              currentQuestionIndex === 0 || isSubmitting || isQuestionTransitioning
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            } transition-colors flex items-center`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Previous
          </button>
          
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting || isQuestionTransitioning}
            className={`px-6 py-2 rounded ${
              isSubmitting || isQuestionTransitioning
                ? 'bg-purple-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white transition-colors flex items-center`}
          >
            {isLastQuestion ? 'Submit' : (
              <>
                Next
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}