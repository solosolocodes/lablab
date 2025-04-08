'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { ParticipantProvider } from '@/contexts/ParticipantContext';
import ExperimentRunner from '@/components/participant/ExperimentRunner';

export default function ExperimentView() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const experimentId = params.id as string;
  const isLoading = status === 'loading';
  
  // Authentication check
  useEffect(() => {
    // If not authenticated or not a participant, redirect to login
    if (!isLoading && (!session || session.user.role !== 'participant')) {
      router.push('/participant/login');
    }
  }, [session, isLoading, router]);
  
  // Still loading auth
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Authentication check
  if (!session || session.user.role !== 'participant') {
    return null; // Will redirect via useEffect
  }
  
  // Handle experiment completion
  const handleCompletion = () => {
    // Return to dashboard after a delay
    setTimeout(() => {
      router.push('/participant/dashboard');
    }, 3000);
  };
  
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
            <h1 className="text-xl font-bold text-gray-800">Experiment Runner</h1>
          </div>
          <div className="text-sm text-gray-600">
            {session.user.email}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Wrap the experiment runner in the participant provider */}
          <ParticipantProvider>
            <ExperimentRunner 
              experimentId={experimentId} 
              onComplete={handleCompletion}
            />
          </ParticipantProvider>
        </div>
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