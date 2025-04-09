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

  // Fetch survey when the component mounts
  useEffect(() => {
    if (session && session.user.role === 'admin' && surveyId) {
      fetchSurvey();
      
      // Fallback for new surveys if the fetch fails
      const fallbackTimeout = setTimeout(() => {
        if (isLoading && !survey) {
          console.log('Creating fallback survey data');
          // Create empty survey with the ID if not loaded yet
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
      }, 15000); // Wait 15 seconds before applying fallback
      
      return () => clearTimeout(fallbackTimeout);
    }
  }, [session, surveyId]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status !== 'loading' && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // Fetch survey data from API with retry
  const fetchSurvey = async () => {
    const MAX_RETRIES = 3;
    let attempts = 0;
    
    const attemptFetch = async () => {
      try {
        setIsLoading(true);
        console.log(`Fetching survey (attempt ${attempts + 1}/${MAX_RETRIES}):`, surveyId);
        
        // Use XMLHttpRequest for better timeout control
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('GET', `/api/admin/surveys/${surveyId}`, true);
          xhr.timeout = 10000; // 10 second timeout
          
          xhr.onload = function() {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data);
              } catch (parseError) {
                reject(new Error(`Failed to parse response: ${parseError.message}`));
              }
            } else {
              reject(new Error(`HTTP error ${xhr.status}: ${xhr.statusText || xhr.responseText}`));
            }
          };
          
          xhr.onerror = function() {
            reject(new Error('Network error occurred'));
          };
          
          xhr.ontimeout = function() {
            reject(new Error('Request timed out'));
          };
          
          xhr.send();
        });
      } catch (error) {
        console.error(`Attempt ${attempts + 1} failed:`, error);
        throw error;
      }
    };
    
    while (attempts < MAX_RETRIES) {
      try {
        const data = await attemptFetch();
        console.log('Survey data received:', data);
        
        if (data && data.survey) {
          setSurvey(data.survey);
          setIsLoading(false);
          return; // Success
        } else {
          throw new Error('Received empty survey data');
        }
      } catch (error) {
        attempts++;
        console.error(`Error fetching survey (attempt ${attempts}/${MAX_RETRIES}):`, error);
        
        if (attempts >= MAX_RETRIES) {
          toast.error(`Failed to load survey after ${MAX_RETRIES} attempts`);
          break;
        } else {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }
    }
    
    setIsLoading(false);
  };

  // Save survey changes - simplified without auto-save
  const saveSurvey = async () => {
    if (!survey) return;
    
    try {
      setIsSaving(true);
      console.log('Saving survey:', surveyId);
      
      // Prepare extremely minimal data
      const minimalSurveyData = {
        title: survey.title,
        description: survey.description, 
        status: survey.status,
        // Simplified question structure
        questions: survey.questions.map(q => ({
          id: q.id,
          text: q.text,
          type: q.type,
          required: q.required,
          // Only include options for multiple choice/checkbox questions
          options: (q.type === 'multipleChoice' || q.type === 'checkboxes') ? q.options : [],
          order: q.order
        }))
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

  // Add a new question
  const addQuestion = () => {
    if (!survey) return;
    
    const newQuestion: Question = {
      id: crypto.randomUUID(),
      text: 'New Question',
      type: 'text',
      required: false,
      options: [],
      order: survey.questions.length
    };
    
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
                <Button
                  onClick={addQuestion}
                  className="mt-2 bg-green-600 hover:bg-green-700"
                >
                  Add New Question
                </Button>
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
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Question Type
                        </label>
                        <select
                          value={question.type}
                          onChange={(e) => handleQuestionChange(index, 'type', e.target.value)}
                          className="w-full border border-gray-300 rounded-md p-2"
                        >
                          <option value="text">Text (Short Answer)</option>
                          <option value="multipleChoice">Multiple Choice (Select One)</option>
                          <option value="checkboxes">Checkboxes (Select Multiple)</option>
                          <option value="scale">Scale (1-10)</option>
                          <option value="rating">Rating (1-5 Stars)</option>
                        </select>
                      </div>
                      
                      <div className="mb-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(e) => handleQuestionChange(index, 'required', e.target.checked)}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Required</span>
                        </label>
                      </div>
                      
                      {(question.type === 'multipleChoice' || question.type === 'checkboxes') && (
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Options
                          </label>
                          {(question.options || []).map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center mb-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(index, optionIndex, e.target.value)}
                                className="flex-1 border border-gray-300 rounded-md p-2 mr-2"
                                placeholder={`Option ${optionIndex + 1}`}
                              />
                              <button
                                onClick={() => deleteOption(index, optionIndex)}
                                className="text-red-500 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addOption(index)}
                            className="text-blue-500 hover:text-blue-700"
                          >
                            + Add Option
                          </button>
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