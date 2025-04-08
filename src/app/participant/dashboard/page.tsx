'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/Button';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Define types for experiment and progress data
type ExperimentProgressStatus = 'not_started' | 'in_progress' | 'completed';

type ExperimentWithProgress = {
  id: string;
  name: string;
  description: string;
  status: string;
  progress: {
    status: ExperimentProgressStatus;
    startedAt?: string;
    completedAt?: string;
    lastActivityAt?: string;
  };
  createdAt: string;
};

export default function ParticipantDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoading = status === 'loading';
  const [experiments, setExperiments] = useState<ExperimentWithProgress[]>([]);
  const [isLoadingExperiments, setIsLoadingExperiments] = useState(false);
  const [filter, setFilter] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    // If not authenticated or not a participant, redirect to login
    if (!isLoading && (!session || session.user.role !== 'participant')) {
      router.push('/participant/login');
    }
  }, [session, isLoading, router]);

  // Fetch assigned experiments
  useEffect(() => {
    if (session && session.user) {
      fetchExperiments();
    }
  }, [session, filter]);

  const fetchExperiments = async () => {
    try {
      setIsLoadingExperiments(true);
      const response = await fetch(`/api/participant/experiments?status=${filter}`);
      
      if (!response.ok) {
        // Try to get detailed error information from the response
        let errorMessage = 'Failed to fetch experiments';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('API error details:', errorData);
        } catch (parseError) {
          console.error('Could not parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      setExperiments(data);
    } catch (error) {
      console.error('Error fetching experiments:', error);
      
      // Check if it's a database connection error and provide a more friendly message
      if (error instanceof Error && (
        error.message.includes('Database connection failed') ||
        error.message.includes('MongoDB connection failed')
      )) {
        toast.error('Database connection issue. Please try again later or contact support.');
      } else {
        toast.error(`Failed to load your experiments: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setIsLoadingExperiments(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  // Filter experiments based on progress status
  const filteredExperiments = filter === 'all' 
    ? experiments 
    : experiments.filter(exp => exp.progress.status === filter);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'participant') {
    return null; // Will redirect via useEffect
  }

  // Get counts for badge indicators
  const availableCount = experiments.filter(exp => exp.progress.status === 'not_started').length;
  const inProgressCount = experiments.filter(exp => exp.progress.status === 'in_progress').length;
  const completedCount = experiments.filter(exp => exp.progress.status === 'completed').length;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header - More compact */}
      <header className="bg-white shadow-sm py-3">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">LabLab Dashboard</h1>
          <div className="flex items-center space-x-3">
            <div className="text-sm text-gray-600 hidden md:block">
              {session.user.name}
            </div>
            <Button
              variant="outline"
              className="text-red-600 border-red-600 hover:bg-red-50 text-sm py-1.5 px-3"
              onClick={handleSignOut}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - More compact layout */}
      <main className="flex-grow container mx-auto px-4 py-4">
        {/* User info and filter navigation */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between p-4 border-b border-gray-100">
            <div className="flex items-center space-x-4 mb-3 md:mb-0">
              <div className="h-10 w-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                {session.user.name?.charAt(0).toUpperCase() || 'P'}
              </div>
              <div>
                <h2 className="text-lg font-medium">Welcome, {session.user.name}</h2>
                <p className="text-sm text-gray-600">{session.user.email}</p>
              </div>
            </div>
            <div className="flex space-x-1 overflow-x-auto">
              <button 
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                  filter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Experiments
                <span className="ml-1 bg-white bg-opacity-20 text-xs px-1.5 py-0.5 rounded-full">
                  {experiments.length}
                </span>
              </button>
              <button 
                onClick={() => setFilter('not_started')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                  filter === 'not_started' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Available
                {availableCount > 0 && (
                  <span className="ml-1 bg-white bg-opacity-20 text-xs px-1.5 py-0.5 rounded-full">
                    {availableCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setFilter('in_progress')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                  filter === 'in_progress' 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                In Progress
                {inProgressCount > 0 && (
                  <span className="ml-1 bg-white bg-opacity-20 text-xs px-1.5 py-0.5 rounded-full">
                    {inProgressCount}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setFilter('completed')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap ${
                  filter === 'completed' 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed
                {completedCount > 0 && (
                  <span className="ml-1 bg-white bg-opacity-20 text-xs px-1.5 py-0.5 rounded-full">
                    {completedCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoadingExperiments && (
          <div className="flex justify-center my-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Experiments grid - Compact cards */}
        {!isLoadingExperiments && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredExperiments.map(experiment => (
              <div key={experiment.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
                {/* Status indicator bar */}
                <div className={`h-1.5 ${
                  experiment.progress.status === 'completed' 
                    ? 'bg-green-500'
                    : experiment.progress.status === 'in_progress'
                      ? 'bg-amber-500'
                      : 'bg-indigo-500'
                }`}></div>
                
                <div className="p-4 flex-grow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900">{experiment.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      experiment.progress.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : experiment.progress.status === 'in_progress'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-100 text-indigo-800'
                    }`}>
                      {experiment.progress.status === 'completed'
                        ? 'Completed'
                        : experiment.progress.status === 'in_progress'
                          ? 'In Progress'
                          : 'Not Started'}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {experiment.description}
                  </p>
                  
                  {/* Time information */}
                  <div className="text-xs text-gray-500 mb-3">
                    {experiment.progress.status === 'completed' && experiment.progress.completedAt && (
                      <p>Completed: {new Date(experiment.progress.completedAt).toLocaleDateString()}</p>
                    )}
                    {experiment.progress.status === 'in_progress' && experiment.progress.startedAt && (
                      <p>Started: {new Date(experiment.progress.startedAt).toLocaleDateString()}</p>
                    )}
                    {experiment.progress.status === 'not_started' && (
                      <p>Available since: {new Date(experiment.createdAt).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
                
                <div className="px-4 pb-4">
                  {experiment.progress.status === 'completed' ? (
                    <Button className="w-full bg-green-600 hover:bg-green-700 py-1.5 text-sm">
                      View Results
                    </Button>
                  ) : experiment.progress.status === 'in_progress' ? (
                    <Link href={`/participant/experiments/${experiment.id}`} passHref>
                      <Button className="w-full bg-amber-600 hover:bg-amber-700 py-1.5 text-sm">
                        Continue
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/participant/experiments/${experiment.id}`} passHref>
                      <Button className="w-full bg-indigo-600 hover:bg-indigo-700 py-1.5 text-sm">
                        Start Experiment
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
            
            {filteredExperiments.length === 0 && (
              <div className="col-span-full text-center p-8 bg-white rounded-lg shadow">
                <div className="flex flex-col items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <h4 className="text-lg font-medium text-gray-800 mb-1">
                    {filter === 'all' ? 'No experiments available' : 
                     filter === 'not_started' ? 'No available experiments' :
                     filter === 'in_progress' ? 'No experiments in progress' :
                     'No completed experiments'}
                  </h4>
                  <p className="text-gray-600 mb-4">
                    {filter === 'all' ? 'You don\'t have any experiments assigned to you yet. You may need to be added to a user group by an administrator.' : 
                     filter === 'not_started' ? 'All available experiments have been started or completed.' :
                     filter === 'in_progress' ? 'You haven\'t started any experiments yet.' :
                     'You haven\'t completed any experiments yet.'}
                  </p>
                  {filter !== 'all' && (
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 text-sm"
                      onClick={() => setFilter('all')}
                    >
                      View All Experiments
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer - More compact */}
      <footer className="bg-white py-3 shadow-inner mt-auto">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600 text-xs">
            © {new Date().getFullYear()} LabLab Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}