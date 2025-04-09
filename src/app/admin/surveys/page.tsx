'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import { toast } from 'react-hot-toast';
import useWindowOpener from '@/hooks/useWindowOpener';

// Survey type definition
type Survey = {
  _id: string;
  title: string;
  description: string;
  status: 'draft' | 'published' | 'archived';
  questionsCount: number;
  responsesCount: number;
  createdAt: string;
  updatedAt: string;
};

export default function SurveysPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const openInNewWindow = useWindowOpener({ width: 1200, height: 900, name: 'survey_editor' });
  const isLoading = status === 'loading';
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'published' | 'archived'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Load surveys when the component mounts
  useEffect(() => {
    // If authenticated as admin, fetch surveys
    if (session && session.user.role === 'admin') {
      fetchSurveys();
    }
  }, [session, filter]);
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, isLoading, router]);

  // Fetch surveys from the API
  const fetchSurveys = async () => {
    try {
      setIsDataLoading(true);
      
      // Build the API URL with filter if needed
      let url = '/api/admin/surveys';
      if (filter !== 'all') {
        url += `?status=${filter}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch surveys: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Process surveys to add questionsCount
      const processedSurveys = data.surveys.map((survey: any) => ({
        ...survey,
        questionsCount: survey.questions?.length || 0
      }));
      
      setSurveys(processedSurveys);
    } catch (error) {
      console.error('Error fetching surveys:', error);
      toast.error('Failed to load surveys');
    } finally {
      setIsDataLoading(false);
    }
  };
  
  // Function to create a new survey
  const createNewSurvey = async () => {
    try {
      console.log('Creating new survey...');
      
      const response = await fetch('/api/admin/surveys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Survey',
          description: 'Survey description goes here',
          questions: []
        })
      });
      
      console.log('API response status:', response.status);
      
      const responseText = await response.text();
      console.log('API response text:', responseText);
      
      if (!response.ok) {
        throw new Error(`Failed to create survey: ${response.status} ${response.statusText} - ${responseText}`);
      }
      
      // Parse the response text as JSON
      const data = responseText ? JSON.parse(responseText) : {};
      console.log('Parsed response data:', data);
      
      if (!data.survey || !data.survey._id) {
        throw new Error('Survey data is missing or invalid');
      }
      
      toast.success('New survey created successfully');
      openInNewWindow(`/admin/surveys/${data.survey._id}/edit`);
    } catch (error) {
      console.error('Error creating survey:', error);
      toast.error('Failed to create new survey');
    }
  };
  
  // Function to delete a survey
  const deleteSurvey = async (surveyId: string) => {
    try {
      const response = await fetch(`/api/admin/surveys/${surveyId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete survey: ${response.statusText}`);
      }
      
      // Remove the deleted survey from the state
      setSurveys(surveys.filter(survey => survey._id !== surveyId));
      
      toast.success('Survey deleted successfully');
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting survey:', error);
      toast.error('Failed to delete survey');
    }
  };
  
  // Function to change the survey status
  const changeStatus = async (surveyId: string, newStatus: 'draft' | 'published' | 'archived') => {
    try {
      const survey = surveys.find(s => s._id === surveyId);
      if (!survey) return;
      
      // Send only status update - the API will preserve existing questions
      // We explicitly don't send questions from this view since we don't have the full question data here
      const response = await fetch(`/api/admin/surveys/${surveyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          // Include these to keep compatibility with the API
          title: survey.title,
          description: survey.description
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to update survey: ${response.statusText}`);
      }
      
      // Update the local state
      setSurveys(surveys.map(s => 
        s._id === surveyId 
          ? { ...s, status: newStatus } 
          : s
      ));
      
      toast.success(`Survey ${newStatus === 'published' ? 'published' : newStatus === 'archived' ? 'archived' : 'saved as draft'}`);
    } catch (error) {
      console.error('Error updating survey status:', error);
      toast.error('Failed to update survey status');
    }
  };
  
  // Format date string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Loading session...</p>
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
              <div className="hidden md:flex space-x-4">
                <Link href="/admin/dashboard" className="px-3 py-2 rounded hover:bg-purple-600">Dashboard</Link>
                <Link href="/admin/experiments" className="px-3 py-2 rounded hover:bg-purple-600">Experiments</Link>
                <Link href="/admin/scenarios" className="px-3 py-2 rounded hover:bg-purple-600">Scenarios</Link>
                <Link href="/admin/surveys" className="px-3 py-2 rounded bg-purple-600">Surveys</Link>
                <Link href="/admin/wallets" className="px-3 py-2 rounded hover:bg-purple-600">Wallets</Link>
                <Link href="/admin/user-groups" className="px-3 py-2 rounded hover:bg-purple-600">User Groups</Link>
              </div>
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
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">Survey Management</h1>
          <div className="flex space-x-3">
            <Button
              onClick={createNewSurvey}
              className="bg-green-600 hover:bg-green-700"
            >
              Create New Survey
            </Button>
          </div>
        </div>
        
        {/* Filter tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex space-x-8" aria-label="Status filter">
            <button
              onClick={() => setFilter('all')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                filter === 'all'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('draft')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                filter === 'draft'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Drafts
            </button>
            <button
              onClick={() => setFilter('published')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                filter === 'published'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Published
            </button>
            <button
              onClick={() => setFilter('archived')}
              className={`pb-4 px-1 border-b-2 font-medium text-sm ${
                filter === 'archived'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Archived
            </button>
          </nav>
        </div>

        {/* Surveys Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md mb-6">
          {isDataLoading ? (
            <div className="py-20 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
              <p className="mt-4 text-gray-500">Loading surveys...</p>
            </div>
          ) : surveys.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Survey
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Questions
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Responses
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Updated
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {surveys.map((survey) => (
                  <tr key={survey._id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{survey.title}</div>
                      <div className="text-sm text-gray-500">{survey.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${
                        survey.status === 'published' 
                          ? 'bg-green-100 text-green-800' 
                          : survey.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {survey.status.charAt(0).toUpperCase() + survey.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {survey.questionsCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {survey.responsesCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(survey.updatedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {showDeleteConfirm === survey._id ? (
                        <div className="flex justify-end items-center space-x-2">
                          <span className="text-red-500 text-xs mr-1">Confirm delete?</span>
                          <button 
                            onClick={() => deleteSurvey(survey._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Yes
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(null)}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end items-center space-x-3">
                          <button 
                            onClick={() => openInNewWindow(`/admin/surveys/${survey._id}/edit`)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                          {survey.status === 'draft' && (
                            <button 
                              onClick={() => changeStatus(survey._id, 'published')}
                              className="text-green-600 hover:text-green-900"
                            >
                              Publish
                            </button>
                          )}
                          {survey.status === 'published' && (
                            <button 
                              onClick={() => changeStatus(survey._id, 'archived')}
                              className="text-gray-600 hover:text-gray-900"
                            >
                              Archive
                            </button>
                          )}
                          {survey.status === 'archived' && (
                            <button 
                              onClick={() => changeStatus(survey._id, 'draft')}
                              className="text-yellow-600 hover:text-yellow-900"
                            >
                              Restore
                            </button>
                          )}
                          <button 
                            onClick={() => setShowDeleteConfirm(survey._id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <svg 
                  className="mx-auto h-12 w-12 text-gray-400" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" 
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No surveys found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {filter !== 'all' 
                    ? `No ${filter} surveys found. Try a different filter or create a new survey.`
                    : 'Get started by creating a new survey.'}
                </p>
                <div className="mt-6">
                  <Button 
                    onClick={createNewSurvey}
                    className="text-sm py-2 px-4 bg-purple-600 hover:bg-purple-700"
                  >
                    Create New Survey
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Help Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                About Survey Management
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  This page allows you to manage surveys for your experiments. You can:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>Create new surveys</li>
                  <li>Edit existing surveys</li>
                  <li>Publish surveys when they're ready</li>
                  <li>Archive surveys that are no longer needed</li>
                  <li>View survey responses (coming soon)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white py-4 shadow-inner">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} LabLab Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}