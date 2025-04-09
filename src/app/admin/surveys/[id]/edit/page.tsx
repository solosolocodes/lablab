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
      console.log('Fetching survey:', surveyId);
      const response = await fetch(`/api/admin/surveys/${surveyId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Survey fetch error response:', errorText);
        throw new Error(`Failed to fetch survey: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Survey data received:', data);
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
      console.log('Saving survey:', surveyId);
      
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
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Survey save error response:', errorText);
        throw new Error(`Failed to update survey: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Survey saved successfully:', data);
      toast.success('Survey saved successfully');
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