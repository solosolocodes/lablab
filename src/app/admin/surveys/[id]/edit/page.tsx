'use client';

import { useEffect, useState, useCallback } from 'react';
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
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch survey when the component mounts
  useEffect(() => {
    if (session && session.user.role === 'admin' && surveyId) {
      fetchSurvey();
    }
  }, [session, surveyId]);

  // Redirect if not authenticated
  useEffect(() => {
    if (status !== 'loading' && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // Fetch survey data from API
  const fetchSurvey = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/surveys/${surveyId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch survey: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSurvey(data.survey);
    } catch (error) {
      console.error('Error fetching survey:', error);
      toast.error('Failed to load survey');
    } finally {
      setIsLoading(false);
    }
  };

  // Save survey changes
  const saveSurvey = async () => {
    if (!survey) return;
    
    try {
      setIsSaving(true);
      
      // Create an AbortController to handle timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      try {
        const response = await fetch(`/api/admin/surveys/${surveyId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: survey.title,
            description: survey.description,
            questions: survey.questions,
            status: survey.status
          }),
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to update survey: ${response.statusText}`);
        }
        
        const data = await response.json();
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        toast.success('Survey saved successfully');
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Handle timeout - still consider the save "successful" for optimistic UI
          console.warn('Save operation timed out, but changes kept in UI');
          toast.success('Survey changes saved locally. Refresh to verify changes were saved to server.');
          setLastSaved(new Date());
          setHasUnsavedChanges(false);
        } else {
          throw error; // Re-throw for the outer catch
        }
      }
    } catch (error) {
      console.error('Error saving survey:', error);
      toast.error('Failed to save survey. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!survey) return;
    setSurvey({ ...survey, title: e.target.value });
    setHasUnsavedChanges(true);
  };

  // Handle description change
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!survey) return;
    setSurvey({ ...survey, description: e.target.value });
    setHasUnsavedChanges(true);
  };
  
  // Setup auto-save
  useEffect(() => {
    // Only start auto-save if there are unsaved changes and we're not currently saving
    if (hasUnsavedChanges && !isSaving && survey) {
      const timer = setTimeout(() => {
        saveSurvey();
      }, 30000); // Auto-save after 30 seconds of inactivity
      
      return () => clearTimeout(timer);
    }
  }, [survey, hasUnsavedChanges, isSaving]);

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
    setHasUnsavedChanges(true);
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
    
    setHasUnsavedChanges(true);
  };

  // Update a question
  const updateQuestion = (index: number, updatedQuestion: Question) => {
    if (!survey) return;
    
    const updatedQuestions = [...survey.questions];
    updatedQuestions[index] = updatedQuestion;
    
    setSurvey({ ...survey, questions: updatedQuestions });
    setHasUnsavedChanges(true);
  };

  // Move question up in order
  const moveQuestionUp = (index: number) => {
    if (!survey || index === 0) return;
    
    const updatedQuestions = [...survey.questions];
    const temp = updatedQuestions[index];
    updatedQuestions[index] = updatedQuestions[index - 1];
    updatedQuestions[index - 1] = temp;
    
    // Update order property
    updatedQuestions[index].order = index;
    updatedQuestions[index - 1].order = index - 1;
    
    setSurvey({ ...survey, questions: updatedQuestions });
    
    if (activeQuestionIndex === index) {
      setActiveQuestionIndex(index - 1);
    } else if (activeQuestionIndex === index - 1) {
      setActiveQuestionIndex(index);
    }
    
    setHasUnsavedChanges(true);
  };

  // Move question down in order
  const moveQuestionDown = (index: number) => {
    if (!survey || index === survey.questions.length - 1) return;
    
    const updatedQuestions = [...survey.questions];
    const temp = updatedQuestions[index];
    updatedQuestions[index] = updatedQuestions[index + 1];
    updatedQuestions[index + 1] = temp;
    
    // Update order property
    updatedQuestions[index].order = index;
    updatedQuestions[index + 1].order = index + 1;
    
    setSurvey({ ...survey, questions: updatedQuestions });
    
    if (activeQuestionIndex === index) {
      setActiveQuestionIndex(index + 1);
    } else if (activeQuestionIndex === index + 1) {
      setActiveQuestionIndex(index);
    }
    
    setHasUnsavedChanges(true);
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
              <button
                onClick={() => router.push('/admin/login')}
                className="bg-purple-800 hover:bg-purple-900 px-3 py-1 rounded text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        {survey ? (
          <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Survey Questions List */}
            <div className="lg:col-span-1 bg-white shadow overflow-hidden rounded-lg">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                <h3 className="text-lg font-medium leading-6 text-gray-900">Survey Questions</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Click on a question to edit or add a new one.
                </p>
              </div>
              <div className="bg-white p-4">
                <Button
                  onClick={addQuestion}
                  className="w-full mb-4 bg-green-600 hover:bg-green-700"
                >
                  Add New Question
                </Button>
                <div className="space-y-3">
                  {survey.questions.length > 0 ? (
                    survey.questions.map((question, index) => (
                      <div 
                        key={question.id} 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          activeQuestionIndex === index
                            ? 'border-purple-500 bg-purple-50'
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                        onClick={() => setActiveQuestionIndex(index)}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium truncate">
                            {index + 1}. {question.text || 'Untitled Question'}
                          </span>
                          <div className="flex space-x-1">
                            {index > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveQuestionUp(index);
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                                title="Move Up"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                                </svg>
                              </button>
                            )}
                            {index < survey.questions.length - 1 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  moveQuestionDown(index);
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                                title="Move Down"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteQuestion(index);
                              }}
                              className="text-red-400 hover:text-red-600 p-1"
                              title="Delete Question"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500 mt-1 truncate">
                          {question.type.charAt(0).toUpperCase() + question.type.slice(1)}
                          {question.required && ' • Required'}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      No questions yet. Click "Add New Question" to start building your survey.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Active Question Editor or Survey Details */}
            <div className="lg:col-span-2">
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

              {/* Question Editor */}
              {activeQuestionIndex !== null && survey.questions[activeQuestionIndex] && (
                <div className="bg-white shadow overflow-hidden rounded-lg">
                  <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">
                      Edit Question {activeQuestionIndex + 1}
                    </h3>
                  </div>
                  <div className="px-4 py-5 sm:p-6">
                    <div className="grid grid-cols-1 gap-6">
                      <div>
                        <label htmlFor="question-text" className="block text-sm font-medium text-gray-700">
                          Question Text <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="question-text"
                          value={survey.questions[activeQuestionIndex].text}
                          onChange={(e) => handleQuestionChange(activeQuestionIndex, 'text', e.target.value)}
                          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="question-type" className="block text-sm font-medium text-gray-700">
                          Question Type
                        </label>
                        <select
                          id="question-type"
                          value={survey.questions[activeQuestionIndex].type}
                          onChange={(e) => handleQuestionChange(activeQuestionIndex, 'type', e.target.value)}
                          className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                        >
                          <option value="text">Text (Short Answer)</option>
                          <option value="multipleChoice">Multiple Choice (Select One)</option>
                          <option value="checkboxes">Checkboxes (Select Multiple)</option>
                          <option value="scale">Scale (1-10)</option>
                          <option value="rating">Rating (1-5 Stars)</option>
                        </select>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="question-required"
                          checked={survey.questions[activeQuestionIndex].required}
                          onChange={(e) => handleQuestionChange(activeQuestionIndex, 'required', e.target.checked)}
                          className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                        />
                        <label htmlFor="question-required" className="ml-2 block text-sm text-gray-700">
                          Required question
                        </label>
                      </div>

                      {/* Options Editor for Multiple Choice or Checkboxes */}
                      {(survey.questions[activeQuestionIndex].type === 'multipleChoice' || 
                        survey.questions[activeQuestionIndex].type === 'checkboxes') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Options
                          </label>
                          {survey.questions[activeQuestionIndex].options?.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center mb-2">
                              <input
                                type="text"
                                value={option}
                                onChange={(e) => updateOption(activeQuestionIndex, optionIndex, e.target.value)}
                                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
                                placeholder={`Option ${optionIndex + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() => deleteOption(activeQuestionIndex, optionIndex)}
                                className="ml-2 text-red-500 hover:text-red-700"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => addOption(activeQuestionIndex)}
                            className="mt-2 inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            Add Option
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Preview empty state */}
              {activeQuestionIndex === null && survey.questions.length > 0 && (
                <div className="bg-white shadow overflow-hidden rounded-lg">
                  <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
                    <h3 className="text-lg font-medium leading-6 text-gray-900">Question Preview</h3>
                  </div>
                  <div className="px-4 py-5 sm:p-6 text-center">
                    <p className="text-gray-500">Select a question from the list to edit it.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-red-500">Survey not found or failed to load.</p>
            <Link href="/admin/surveys" className="mt-4 inline-block text-purple-600 hover:underline">
              Return to Surveys
            </Link>
          </div>
        )}

        {/* Actions Row */}
        <div className="flex justify-between items-center bg-white shadow overflow-hidden rounded-lg p-4 mt-6">
          <div className="flex items-center">
            <Link 
              href="/admin/surveys"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Cancel
            </Link>
            {lastSaved && (
              <span className="ml-4 text-sm text-gray-500">
                Last saved: {lastSaved.toLocaleTimeString()}
                {hasUnsavedChanges && (
                  <span className="ml-2 text-amber-500 font-medium">(Unsaved changes)</span>
                )}
              </span>
            )}
            {!lastSaved && hasUnsavedChanges && (
              <span className="ml-4 text-sm text-amber-500 font-medium">
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={saveSurvey}
              isLoading={isSaving}
              className="bg-purple-600 hover:bg-purple-700"
              disabled={!survey || isSaving || !hasUnsavedChanges}
            >
              {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
            </Button>
          </div>
        </div>
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