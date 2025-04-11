'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/Button';
import { toast } from 'react-hot-toast';

// Question and Survey type definitions
type QuestionType = 'text' | 'multipleChoice' | 'checkboxes' | 'scale' | 'rating';

type Question = {
  id: string;
  text: string;
  type: QuestionType;
  required: boolean;
  options?: string[];
  minValue?: number; // For scale questions (1-10)
  maxValue?: number; // For scale questions
  maxRating?: number; // For rating questions (1-5 stars)
  order: number;
};

type Survey = {
  _id: string;
  title: string;
  description: string;
  questions: Question[];
  status: 'draft' | 'published' | 'archived';
  createdAt: string;
  updatedAt: string;
};

export default function SurveyEditorPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const surveyId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState<number | null>(null);

  // Fetch survey when the component mounts - only once
  useEffect(() => {
    let mounted = true;
    let fallbackTimer: NodeJS.Timeout | undefined;

    const initSurvey = async () => {
      console.log('Survey editor: initializing', { surveyId, sessionStatus: status, isAdmin: session?.user?.role === 'admin' });
      
      if (!session && status !== 'loading') {
        console.log('Survey editor: no session, redirecting');
        router.push('/admin/login');
        return;
      }
      
      if (session && session.user.role === 'admin' && surveyId) {
        try {
          // Try to fetch existing survey
          console.log('Survey editor: fetching survey data');
          const surveyFetched = await fetchSurvey();
          
          // Only set fallback timer if survey fetch was unsuccessful
          // AND this appears to be a new survey (not an existing one)
          if (!surveyFetched) {
            console.log('Survey editor: survey fetch unsuccessful, checking if new survey');
            
            // Check if this is a new survey by looking at the URL pattern
            // New surveys typically come from the create flow and might not exist in DB yet
            const isNewSurvey = window.location.href.includes('?new=true');
            
            if (isNewSurvey) {
              console.log('Survey editor: detected new survey creation flow');
              // Set immediate fallback timer for new surveys only
              fallbackTimer = setTimeout(() => {
                console.log('Survey editor: checking if fallback needed for new survey');
                // Create empty survey with the ID if not loaded yet
                if (mounted && isLoading) {
                  console.log('Survey editor: creating fallback survey data');
                  setSurvey({
                    _id: surveyId,
                    title: 'New Survey',
                    description: '',
                    questions: [],
                    status: 'draft',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                  });
                  setIsLoading(false);
                  toast.info('Using default survey template. Changes will be saved.');
                }
              }, 5000); // 5 seconds for fallback
            } else {
              console.log('Survey editor: not a new survey, no fallback needed');
            }
          }
        } catch (error) {
          console.error('Survey editor: error initializing survey:', error);
          if (mounted) {
            // On error, immediately use fallback
            console.log('Survey editor: using fallback due to error');
            setSurvey({
              _id: surveyId,
              title: 'New Survey',
              description: '',
              questions: [],
              status: 'draft',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            setIsLoading(false);
            toast.error('Error loading survey. Using default template.');
          }
        }
      } else if (status !== 'loading') {
        console.log('Survey editor: not an admin or no survey ID');
        setIsLoading(false);
      }
    };
    
    initSurvey();
    
    return () => {
      mounted = false;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
    };
  }, [session, status, surveyId]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status !== 'loading' && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // Fetch survey data from API with retry and fallback
  const fetchSurvey = async () => {
    const MAX_RETRIES = 3;
    let attempts = 0;
    
    const attemptFetch = async () => {
      try {
        setIsLoading(true);
        console.log(`Survey editor: fetching survey (attempt ${attempts + 1}/${MAX_RETRIES}):`, surveyId);
        
        // Use fetch instead of XMLHttpRequest for simpler handling
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        try {
          const response = await fetch(`/api/admin/surveys/${surveyId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
          }
          
          const text = await response.text();
          
          try {
            return JSON.parse(text);
          } catch (parseError) {
            console.error('Survey editor: JSON parse error:', parseError, 'Text:', text);
            throw new Error(`Failed to parse API response: ${parseError.message}`);
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          if (fetchError.name === 'AbortError') {
            throw new Error('Request timed out');
          }
          throw fetchError;
        }
      } catch (error) {
        console.error(`Survey editor: Attempt ${attempts + 1} failed:`, error);
        throw error;
      }
    };
    
    while (attempts < MAX_RETRIES) {
      try {
        const data = await attemptFetch();
        console.log('Survey editor: Survey data received:', data);
        
        if (data && data.survey) {
          console.log('Survey editor: Setting survey data');
          setSurvey(data.survey);
          setIsLoading(false);
          return true; // Success
        } else {
          console.error('Survey editor: Received empty survey data');
          throw new Error('Received empty survey data');
        }
      } catch (error) {
        attempts++;
        console.error(`Survey editor: Error fetching survey (attempt ${attempts}/${MAX_RETRIES}):`, error);
        
        if (attempts >= MAX_RETRIES) {
          toast.error(`Failed to load survey after ${MAX_RETRIES} attempts`);
          break;
        } else {
          // Wait before retrying (exponential backoff)
          const delay = 1000 * attempts;
          console.log(`Survey editor: Waiting ${delay}ms before next attempt`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.log('Survey editor: All fetch attempts failed');
    setIsLoading(false);
    return false;
  };

  // Save survey changes - simplified without auto-save
  const saveSurvey = async () => {
    if (!survey) return;
    
    try {
      setIsSaving(true);
      console.log('Saving survey:', surveyId);
      
      // Prepare survey data with appropriate formatting by question type
      const formattedQuestions = survey.questions.map(q => {
        // Basic question properties
        const questionBase = {
          id: q.id,
          text: q.text,
          type: q.type,
          required: q.required,
          order: q.order
        };
        
        // Add type-specific properties
        switch (q.type) {
          case 'multipleChoice':
          case 'checkboxes':
            return {
              ...questionBase,
              options: Array.isArray(q.options) ? q.options.filter(opt => opt.trim() !== '') : []
            };
          case 'scale':
            return {
              ...questionBase,
              // Scale questions have configurable min/max
              minValue: q.minValue || 1,
              maxValue: q.maxValue || 10
            };
          case 'rating':
            return {
              ...questionBase,
              // Rating questions have configurable max stars
              maxRating: q.maxRating || 5
            };
          case 'text':
          default:
            return questionBase;
        }
      });
      
      const minimalSurveyData = {
        title: survey.title,
        description: survey.description, 
        status: survey.status,
        questions: formattedQuestions
      };
      
      // Use XMLHttpRequest instead of fetch for better timeout handling
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `/api/admin/surveys/${surveyId}`, true);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.timeout = 30000; // 30 second timeout to match server limits
      
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          console.log('Survey saved successfully:', xhr.responseText);
          toast.success('Survey saved successfully');
        } else {
          console.error('Error saving survey:', xhr.status, xhr.statusText, xhr.responseText);
          toast.error(`Failed to save survey: ${xhr.status} ${xhr.statusText}`);
        }
        setIsSaving(false);
      };
      
      xhr.onerror = function() {
        console.error('Request error when saving survey');
        toast.error('Network error when saving survey');
        setIsSaving(false);
      };
      
      xhr.ontimeout = function() {
        console.error('Request timeout when saving survey');
        toast.error('Timeout when saving survey - the server took too long to respond');
        setIsSaving(false);
      };
      
      // Send the request
      xhr.send(JSON.stringify(minimalSurveyData));
    } catch (error) {
      console.error('Error in save survey function:', error);
      toast.error('Failed to save survey');
      setIsSaving(false);
    }
  };

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!survey) return;
    setSurvey({ ...survey, title: e.target.value });
  };

  // Handle description change
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!survey) return;
    setSurvey({ ...survey, description: e.target.value });
  };

  // Add a new question with appropriate defaults based on type
  const addQuestion = (type: QuestionType = 'text') => {
    if (!survey) return;
    
    // Create appropriate defaults based on question type
    const defaults: Record<QuestionType, Partial<Question>> = {
      'text': {
        options: []
      },
      'multipleChoice': {
        options: ['Option 1', 'Option 2', 'Option 3']
      },
      'checkboxes': {
        options: ['Option 1', 'Option 2', 'Option 3']
      },
      'scale': {
        options: [],
        minValue: 1,
        maxValue: 10
      },
      'rating': {
        options: [],
        maxRating: 5
      }
    };
    
    // Start with basic question properties
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      text: 'New Question',
      type: type,
      required: false,
      options: defaults[type].options || [],
      order: survey.questions.length
    };
    
    // Add type-specific properties
    if (type === 'scale') {
      newQuestion.minValue = defaults[type].minValue;
      newQuestion.maxValue = defaults[type].maxValue;
    } else if (type === 'rating') {
      newQuestion.maxRating = defaults[type].maxRating;
    }
    
    const updatedQuestions = [...survey.questions, newQuestion];
    setSurvey({ ...survey, questions: updatedQuestions });
    setActiveQuestionIndex(updatedQuestions.length - 1);
  };

  // Delete a question
  const deleteQuestion = (index: number) => {
    if (!survey) return;
    
    const updatedQuestions = [...survey.questions];
    updatedQuestions.splice(index, 1);
    
    // Update order property for all questions
    const reorderedQuestions = updatedQuestions.map((q, idx) => ({
      ...q,
      order: idx
    }));
    
    setSurvey({ ...survey, questions: reorderedQuestions });
    
    if (activeQuestionIndex === index) {
      setActiveQuestionIndex(null);
    } else if (activeQuestionIndex !== null && activeQuestionIndex > index) {
      setActiveQuestionIndex(activeQuestionIndex - 1);
    }
  };

  // Update a question
  const updateQuestion = (index: number, updatedQuestion: Question) => {
    if (!survey) return;
    
    const updatedQuestions = [...survey.questions];
    updatedQuestions[index] = updatedQuestion;
    
    setSurvey({ ...survey, questions: updatedQuestions });
  };

  // Handle question field changes
  const handleQuestionChange = (index: number, field: string, value: any) => {
    if (!survey) return;
    
    const updatedQuestion = { ...survey.questions[index], [field]: value };
    updateQuestion(index, updatedQuestion);
  };

  // Add option to a question
  const addOption = (questionIndex: number) => {
    if (!survey) return;
    
    const question = survey.questions[questionIndex];
    const options = question.options || [];
    const updatedOptions = [...options, ''];
    
    const updatedQuestion = { ...question, options: updatedOptions };
    updateQuestion(questionIndex, updatedQuestion);
  };

  // Update option in a question
  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    if (!survey) return;
    
    const question = survey.questions[questionIndex];
    const options = [...(question.options || [])];
    options[optionIndex] = value;
    
    const updatedQuestion = { ...question, options: options };
    updateQuestion(questionIndex, updatedQuestion);
  };

  // Delete option from a question
  const deleteOption = (questionIndex: number, optionIndex: number) => {
    if (!survey) return;
    
    const question = survey.questions[questionIndex];
    const options = [...(question.options || [])];
    options.splice(optionIndex, 1);
    
    const updatedQuestion = { ...question, options: options };
    updateQuestion(questionIndex, updatedQuestion);
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
          <p className="mt-4 text-gray-500">Loading survey editor...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'admin') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-purple-700 text-white shadow-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">LabLab Admin</h1>
              <Link href="/admin/surveys" className="text-sm hover:underline">
                ← Back to Surveys
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm hidden md:inline-block">
                {session.user.email}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        {survey ? (
          <>
            {/* Survey Details Form */}
            <div className="bg-white shadow overflow-hidden rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Survey Details</h3>
              </div>
              <div className="px-4 py-5 sm:p-6">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="title"
                      id="title"
                      value={survey.title}
                      onChange={handleTitleChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      rows={3}
                      value={survey.description}
                      onChange={handleDescriptionChange}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Questions Management */}
            <div className="bg-white shadow overflow-hidden rounded-lg mb-6">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Questions</h3>
                <div className="mt-1 mb-3 text-sm text-gray-500">
                  <p>For optimal performance, please limit surveys to 50 questions maximum, and 10 options per multiple choice question.</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    onClick={() => addQuestion('text')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Add Text Question
                  </Button>
                  <Button
                    onClick={() => addQuestion('multipleChoice')}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Add Multiple Choice
                  </Button>
                  <Button
                    onClick={() => addQuestion('checkboxes')}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Add Checkboxes
                  </Button>
                  <Button
                    onClick={() => addQuestion('scale')}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Add Scale (1-10)
                  </Button>
                  <Button
                    onClick={() => addQuestion('rating')}
                    className="bg-pink-600 hover:bg-pink-700"
                  >
                    Add Rating (⭐)
                  </Button>
                </div>
              </div>
              <div className="px-4 py-5 sm:p-6">
                {survey.questions.length > 0 ? (
                  survey.questions.map((question, index) => (
                    <div key={question.id} className="mb-6 p-4 border border-gray-200 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="font-medium">Question {index + 1}</h4>
                        <button
                          onClick={() => deleteQuestion(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Question Text
                        </label>
                        <input
                          type="text"
                          value={question.text}
                          onChange={(e) => handleQuestionChange(index, 'text', e.target.value)}
                          className="w-full border border-gray-300 rounded-md p-2"
                        />
                      </div>
                      
                      <div className="mb-4 grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Question Type
                          </label>
                          <select
                            value={question.type}
                            onChange={(e) => {
                              // When type changes, setup default options if needed
                              const newType = e.target.value as QuestionType;
                              let newOptions = question.options || [];
                              
                              // Set default options for choice-based questions
                              if ((newType === 'multipleChoice' || newType === 'checkboxes') && newOptions.length === 0) {
                                newOptions = ['Option 1', 'Option 2', 'Option 3'];
                              }
                              
                              // Update both type and options
                              const updatedQuestion = { 
                                ...question, 
                                type: newType,
                                options: newOptions
                              };
                              updateQuestion(index, updatedQuestion);
                            }}
                            className="w-full border border-gray-300 rounded-md p-2"
                          >
                            <option value="text">Text (Short Answer)</option>
                            <option value="multipleChoice">Multiple Choice (Select One)</option>
                            <option value="checkboxes">Checkboxes (Select Multiple)</option>
                            <option value="scale">Scale (1-10)</option>
                            <option value="rating">Rating (1-5 Stars)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="flex items-center h-full pt-6">
                            <input
                              type="checkbox"
                              checked={question.required}
                              onChange={(e) => handleQuestionChange(index, 'required', e.target.checked)}
                              className="mr-2 h-4 w-4"
                            />
                            <span className="text-sm text-gray-700">Required Question</span>
                          </label>
                        </div>
                      </div>
                      
                      {/* Options for Multiple Choice and Checkboxes */}
                      {(question.type === 'multipleChoice' || question.type === 'checkboxes') && (
                        <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              {question.type === 'multipleChoice' ? 'Multiple Choice Options' : 'Checkbox Options'}
                            </label>
                            <span className="text-xs text-gray-500">
                              ({question.type === 'multipleChoice' ? 'Select one' : 'Select multiple'})
                            </span>
                          </div>
                          
                          {(question.options || []).map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center mb-2">
                              <div className="w-6 text-gray-400 flex-shrink-0">
                                {question.type === 'multipleChoice' ? (
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                                  </svg>
                                )}
                              </div>
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md p-2 mx-2"
                                placeholder={`Option ${optionIndex + 1}`}
                              />
                              <button
                                onClick={() => deleteOption(index, optionIndex)}
                                className="text-red-500 hover:text-red-700"
                                title="Remove option"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          
                          {(question.options || []).length < 10 && (
                            <button
                              onClick={() => addOption(index)}
                              className="mt-2 flex items-center text-blue-600 hover:text-blue-800"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                              </svg>
                              Add Option
                            </button>
                          )}
                        </div>
                      )}
                      
                      {/* Scale specific settings */}
                      {question.type === 'scale' && (
                        <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Scale Options
                          </label>
                          
                          <div className="grid grid-cols-2 gap-4 mb-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Minimum Value
                              </label>
                              <input
                                type="number"
                                min="0"
                                max="9"
                                value={question.minValue || 1}
                                onChange={(e) => {
                                  const min = Math.max(0, parseInt(e.target.value) || 1);
                                  const max = question.maxValue || 10;
                                  // Ensure min is less than max
                                  if (min >= max) return;
                                  handleQuestionChange(index, 'minValue', min);
                                }}
                                className="w-full border border-gray-300 rounded-md p-2"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Maximum Value
                              </label>
                              <input
                                type="number"
                                min="2"
                                max="10"
                                value={question.maxValue || 10}
                                onChange={(e) => {
                                  const max = Math.min(10, parseInt(e.target.value) || 10);
                                  const min = question.minValue || 1;
                                  // Ensure max is greater than min
                                  if (max <= min) return;
                                  handleQuestionChange(index, 'maxValue', max);
                                }}
                                className="w-full border border-gray-300 rounded-md p-2"
                              />
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <div className="text-sm text-gray-500">Min ({question.minValue || 1})</div>
                            <div className="flex-1 px-4">
                              <div className="h-2 bg-gray-300 rounded-full">
                                <div className="h-2 bg-purple-500 rounded-full w-1/2"></div>
                              </div>
                            </div>
                            <div className="text-sm text-gray-500">Max ({question.maxValue || 10})</div>
                          </div>
                          
                          <p className="mt-2 text-xs text-gray-500">
                            Participants will select a value from {question.minValue || 1} to {question.maxValue || 10}
                          </p>
                        </div>
                      )}
                      
                      {/* Rating specific settings */}
                      {question.type === 'rating' && (
                        <div className="mb-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Rating Options (Stars)
                          </label>
                          
                          <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Number of Stars
                            </label>
                            <select
                              value={question.maxRating || 5}
                              onChange={(e) => {
                                handleQuestionChange(index, 'maxRating', parseInt(e.target.value));
                              }}
                              className="w-full border border-gray-300 rounded-md p-2"
                            >
                              <option value="3">3 Stars</option>
                              <option value="4">4 Stars</option>
                              <option value="5">5 Stars</option>
                              <option value="7">7 Stars</option>
                              <option value="10">10 Stars</option>
                            </select>
                          </div>
                          
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: question.maxRating || 5 }, (_, i) => i + 1).map(star => (
                              <svg key={star} className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                              </svg>
                            ))}
                          </div>
                          
                          <p className="mt-2 text-xs text-gray-500">
                            Participants will rate from 1 to {question.maxRating || 5} stars
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No questions yet. Click "Add New Question" to start building your survey.
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between mt-6">
              <Link 
                href="/admin/surveys"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Back to Surveys
              </Link>
              <Button
                onClick={saveSurvey}
                isLoading={isSaving}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Save Survey
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-10">
            <p className="text-red-500">Survey not found or failed to load.</p>
            <Link href="/admin/surveys" className="mt-4 inline-block text-purple-600 hover:underline">
              Return to Surveys
            </Link>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white py-4 shadow-inner mt-auto">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} LabLab Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}