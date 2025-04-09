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

  // Function to fetch survey data from MongoDB - simplified with less delay
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
        // Minimal delay - just enough for smooth transition
        setTimeout(() => {
          setSurveyData(data.survey);
          // Reset to first question
          setCurrentQuestionIndex(0);
          setFormValues({});
          setValidationErrors({});
          setIsLoadingSurvey(false);
        }, 300); // Minimal delay before showing questions
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

  // Simplified question navigation without transitions to prevent flickering
  const handleNext = () => {
    // Validate current question first
    if (!validateCurrentQuestion()) return;
    
    // Move to next question if not the last one - direct with no animation
    if (!isLastQuestion) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
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

  // Simplified thank you message
  if (showThankYou) {
    return (
      <div className="container mx-auto py-4 px-3 max-w-2xl">
        <div className="bg-white rounded p-4 text-center">
          <p className="text-green-600 mb-2">✓ Thank you</p>
          <p className="text-gray-600 text-sm">Proceeding to next stage...</p>
        </div>
      </div>
    );
  }

  // No questions - simplified
  if (questions.length === 0) {
    return (
      <div className="container mx-auto py-4 px-3 max-w-2xl">
        <div className="bg-white rounded p-4 text-center">
          <h2 className="text-lg font-medium text-gray-800 mb-2">{currentStage.title}</h2>
          <p className="text-gray-600 mb-4">No questions available.</p>
          <button
            onClick={goToNextStage}
            className="bg-purple-600 text-white px-4 py-2 rounded"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // Bare minimum loading state
  if (isLoadingSurvey) {
    return (
      <div className="container mx-auto py-4 px-3 max-w-2xl">
        <div className="bg-white rounded p-4 text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Simplified error state
  if (loadError) {
    return (
      <div className="container mx-auto py-4 px-3 max-w-2xl">
        <div className="bg-white rounded p-4">
          <p className="text-red-600 mb-2">Error loading survey</p>
          <button
            onClick={goToNextStage}
            className="mt-2 px-4 py-2 bg-purple-600 text-white rounded"
          >
            Skip to Next Stage
          </button>
        </div>
      </div>
    );
  }

  // Question carousel - simplified UI to reduce flickering
  return (
    <div className="container mx-auto py-4 px-3 max-w-2xl">
      <div className="bg-white rounded p-4">
        {/* Basic title and description */}
        <h2 className="text-xl font-medium text-gray-800 mb-2">
          {surveyData?.title || currentStage.title}
        </h2>
        
        {/* Simple progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-purple-600 h-2 rounded-full"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        {/* Simple question counter */}
        <div className="text-sm text-gray-500 mb-4">
          Question {currentQuestionIndex + 1} of {questions.length}
        </div>
        
        {/* Current question - simplified without transitions */}
        {currentQuestion && (
          <div className="mb-8">
            <div className="mb-4">
              <label className="block font-medium text-gray-800 text-lg">
                {currentQuestion.text}
                {currentQuestion.required && <span className="text-red-500">*</span>}
              </label>
            </div>
            
            <div>
              {renderQuestionInput(currentQuestion)}
            </div>
          </div>
        )}
        
        {/* Simplified navigation buttons */}
        <div className="flex justify-between mt-6 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentQuestionIndex === 0 || isSubmitting}
            className={`px-4 py-2 rounded ${
              currentQuestionIndex === 0 || isSubmitting
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Previous
          </button>
          
          <button
            type="button"
            onClick={handleNext}
            disabled={isSubmitting}
            className={`px-6 py-2 rounded ${
              isSubmitting
                ? 'bg-purple-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white`}
          >
            {isLastQuestion ? 'Submit' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}