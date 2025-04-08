'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/Button';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

type ExperimentData = {
  id: string;
  name: string;
  description: string;
  status: string;
  stages: any[];
  startStageId?: string;
};

type ProgressData = {
  experimentId: string;
  status: 'not_started' | 'in_progress' | 'completed';
  currentStageId: string | null;
  completedStages: string[];
  startedAt?: string;
  completedAt?: string;
  lastActivityAt?: string;
};

export default function ExperimentView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const experimentId = params.id as string;
  const isLoading = status === 'loading';
  
  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch experiment data
  useEffect(() => {
    // If not authenticated or not a participant, redirect to login
    if (!isLoading && (!session || session.user.role !== 'participant')) {
      router.push('/participant/login');
      return;
    }
    
    if (session && session.user && experimentId) {
      fetchExperimentData();
    }
  }, [session, isLoading, experimentId, router]);
  
  const fetchExperimentData = async () => {
    try {
      setIsLoadingData(true);
      setError(null);
      
      // Fetch experiment details and progress in parallel
      const [experimentResponse, progressResponse] = await Promise.all([
        fetch(`/api/experiments/${experimentId}`),
        fetch(`/api/participant/experiments/${experimentId}/progress`)
      ]);
      
      if (!experimentResponse.ok) {
        throw new Error('Failed to fetch experiment details');
      }
      
      if (!progressResponse.ok) {
        throw new Error('Failed to fetch experiment progress');
      }
      
      const experimentData = await experimentResponse.json();
      const progressData = await progressResponse.json();
      
      setExperiment(experimentData);
      setProgress(progressData);
      
      // Update progress if it's the first time viewing
      if (progressData.status === 'not_started') {
        updateProgress('in_progress');
      }
    } catch (error) {
      console.error('Error fetching experiment data:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
      toast.error('Failed to load experiment');
    } finally {
      setIsLoadingData(false);
    }
  };
  
  // Update progress status
  const updateProgress = async (status: 'in_progress' | 'completed', stageId?: string) => {
    try {
      const response = await fetch(`/api/participant/experiments/${experimentId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: status,
          currentStageId: stageId || experiment?.startStageId,
          completedStageId: stageId // Only included when a stage is completed
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update progress');
      }
      
      const updatedProgress = await response.json();
      setProgress(updatedProgress.progress);
      
      if (status === 'completed') {
        toast.success('Experiment completed!');
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      toast.error('Failed to update progress');
    }
  };
  
  // Loading state
  if (isLoading || isLoadingData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading experiment...</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md text-center bg-white p-8 rounded-lg shadow">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Experiment</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/participant/dashboard" passHref>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  
  // Authentication check
  if (!session || session.user.role !== 'participant') {
    return null; // Will redirect via useEffect
  }
  
  // Missing data check
  if (!experiment || !progress) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md text-center bg-white p-8 rounded-lg shadow">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Experiment Not Found</h2>
          <p className="text-gray-600 mb-6">The experiment you're looking for could not be found or you don't have access to it.</p>
          <Link href="/participant/dashboard" passHref>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm py-3">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link href="/participant/dashboard" className="text-gray-600 hover:text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-gray-800">{experiment.name}</h1>
          </div>
          <div className={`text-xs px-2 py-1 rounded-full ${
            progress.status === 'completed'
              ? 'bg-green-100 text-green-800'
              : progress.status === 'in_progress'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-indigo-100 text-indigo-800'
          }`}>
            {progress.status === 'completed'
              ? 'Completed'
              : progress.status === 'in_progress'
                ? 'In Progress'
                : 'Not Started'}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        {/* Experiment Introduction */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-3">About This Study</h2>
          <p className="text-gray-600 mb-4">{experiment.description}</p>
          
          {/* Progress Information */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <h3 className="text-md font-medium text-blue-800 mb-2">Your Progress</h3>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-blue-700">
                  <span className="font-medium">Status:</span> {progress.status.replace('_', ' ').charAt(0).toUpperCase() + progress.status.replace('_', ' ').slice(1)}
                </p>
                {progress.startedAt && (
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Started:</span> {new Date(progress.startedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              {progress.status !== 'completed' && (
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => updateProgress('completed')}
                >
                  {progress.status === 'not_started' ? 'Start Experiment' : 'Complete Experiment'}
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Experiment Content Placeholder */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Experiment Stages</h2>
          
          {/* This would be replaced with actual experiment UI/stages */}
          <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-2">Experiment Interface</h3>
            <p className="text-gray-500 mb-4">This is a placeholder for the experiment interface. In a real implementation, this would contain the interactive stages for the experiment.</p>
            <p className="text-sm text-gray-400">Total Stages: {experiment.stages?.length || 0}</p>
          </div>
        </div>
        
        {/* Completed View or Actions */}
        {progress.status === 'completed' ? (
          <div className="bg-green-50 rounded-lg p-6 border border-green-100 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-xl font-medium text-green-800 mb-2">Experiment Completed!</h3>
            <p className="text-green-700 mb-6">Thank you for participating in this study.</p>
            <Link href="/participant/dashboard" passHref>
              <Button className="bg-green-600 hover:bg-green-700">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button 
              className="bg-purple-600 hover:bg-purple-700"
              onClick={() => updateProgress('completed')}
            >
              Complete Experiment
            </Button>
          </div>
        )}
      </main>

      {/* Footer */}
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