'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

export default function ExperimentDesignerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const experimentId = params.id as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [experiment, setExperiment] = useState<{
    id: string;
    name: string;
    description: string;
    status: string;
    stages: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      durationSeconds: number;
      required: boolean;
      order: number;
      [key: string]: string | number | boolean | Array<unknown> | Record<string, unknown>; // For type-specific properties
    }>;
    userGroups: Array<{
      userGroupId: string;
      condition: string;
      maxParticipants?: number;
    }>;
    branches: Array<{
      id: string;
      fromStageId: string;
      defaultTargetStageId: string;
      conditions: Array<{
        type: string;
        targetStageId: string;
        sourceStageId?: string;
        [key: string]: string | number | boolean | undefined;
      }>;
    }>;
    startStageId?: string;
    createdAt: string;
    updatedAt: string;
    lastEditedAt: string;
  } | null>(null);

  // Redirect if not admin
  useEffect(() => {
    if (status !== 'loading' && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // Fetch experiment data
  useEffect(() => {
    const fetchExperiment = async () => {
      if (!experimentId || status !== 'authenticated') return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/experiments/${experimentId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch experiment');
        }
        
        const data = await response.json();
        setExperiment(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching experiment:', error);
        toast.error('Failed to load experiment: ' + (error instanceof Error ? error.message : 'Unknown error'));
        setIsLoading(false);
      }
    };
    
    fetchExperiment();
  }, [experimentId, status]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Loading experiment data...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated and is admin
  if (!session || session.user.role !== 'admin') {
    return null; // Will redirect via useEffect
  }

  // If no experiment data
  if (!experiment) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Experiment not found</p>
          <Link href="/admin/experiments" className="text-purple-600 mt-4 inline-block">
            Return to experiments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-purple-700 text-white shadow-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link href="/admin/dashboard" className="text-xl font-bold">LabLab Admin</Link>
              <div className="hidden md:flex space-x-4">
                <Link href="/admin/dashboard" className="px-3 py-2 rounded hover:bg-purple-600">Dashboard</Link>
                <Link href="/admin/experiments" className="px-3 py-2 rounded bg-purple-600">Experiments</Link>
                <Link href="/admin/scenarios" className="px-3 py-2 rounded hover:bg-purple-600">Scenarios</Link>
                <Link href="/admin/wallets" className="px-3 py-2 rounded hover:bg-purple-600">Wallets</Link>
                <Link href="/admin/user-groups" className="px-3 py-2 rounded hover:bg-purple-600">User Groups</Link>
                <Link href="#" className="px-3 py-2 rounded hover:bg-purple-600">Reporting</Link>
              </div>
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
        {/* Header with Experiment Info */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Link href="/admin/experiments" className="text-gray-500 hover:text-gray-700 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-gray-800">{experiment.name}</h1>
            </div>
            <p className="text-gray-600 mb-2">{experiment.description}</p>
            <div className="flex space-x-4 text-sm text-gray-500">
              <span>Status: {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}</span>
              <span>Stages: {experiment.stages.length}</span>
              <span>User Groups: {experiment.userGroups.length}</span>
            </div>
          </div>
        </div>
        
        {/* Experiment Designer Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: Components Panel */}
          <div className="bg-white rounded-lg shadow lg:col-span-1">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-lg text-gray-800">Experiment Components</h3>
            </div>
            
            {/* Component Types Accordion */}
            <div className="p-4">
              {/* Instructions Component */}
              <div className="mb-4 border border-gray-200 rounded-md shadow-sm">
                <div className="flex items-center justify-between p-3 bg-purple-50 cursor-pointer rounded-t-md">
                  <div className="flex items-center">
                    <div className="p-2 rounded-full bg-purple-100 mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="font-medium text-purple-700">Instructions</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div className="p-3 bg-white">
                  <p className="text-sm text-gray-600 mb-2">Add instruction stages for participants to read before starting tasks.</p>
                  <button className="text-purple-600 hover:text-purple-800 text-sm font-medium flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Instructions
                  </button>
                </div>
              </div>
              
              {/* Scenario Component */}
              <div className="mb-4 border border-gray-200 rounded-md shadow-sm">
                <div className="flex items-center justify-between p-3 bg-blue-50 cursor-pointer rounded-t-md">
                  <div className="flex items-center">
                    <div className="p-2 rounded-full bg-blue-100 mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                    </div>
                    <span className="font-medium text-blue-700">Scenarios</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div className="p-3 bg-white">
                  <p className="text-sm text-gray-600 mb-2">Select from existing trading scenarios where participants make investment decisions.</p>
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Scenario
                  </button>
                </div>
              </div>
              
              {/* Survey Component */}
              <div className="mb-4 border border-gray-200 rounded-md shadow-sm">
                <div className="flex items-center justify-between p-3 bg-green-50 cursor-pointer rounded-t-md">
                  <div className="flex items-center">
                    <div className="p-2 rounded-full bg-green-100 mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <span className="font-medium text-green-700">Surveys</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div className="p-3 bg-white">
                  <p className="text-sm text-gray-600 mb-2">Create survey questions including demographic data to analyze trading behavior patterns.</p>
                  <div className="space-y-2">
                    <button className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Demographics
                    </button>
                    <button className="text-green-600 hover:text-green-800 text-sm font-medium flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Custom Survey
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Break Component */}
              <div className="mb-4 border border-gray-200 rounded-md shadow-sm">
                <div className="flex items-center justify-between p-3 bg-amber-50 cursor-pointer rounded-t-md">
                  <div className="flex items-center">
                    <div className="p-2 rounded-full bg-amber-100 mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <span className="font-medium text-amber-700">Breaks</span>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <div className="p-3 bg-white">
                  <p className="text-sm text-gray-600 mb-2">Add timed breaks or pauses between activities to prevent participant fatigue.</p>
                  <button className="text-amber-600 hover:text-amber-800 text-sm font-medium flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add Break
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Center: Design Canvas */}
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-gray-800">Experiment Flow</h3>
              <div className="space-x-2">
                <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md">
                  Undo
                </button>
                <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md">
                  Redo
                </button>
              </div>
            </div>
            
            {/* Flow Design Canvas - Empty State */}
            <div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg p-6 min-h-[400px] flex flex-col items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-gray-500 font-medium mb-1">Start Building Your Experiment</p>
              <p className="text-gray-400 text-sm text-center mb-4">Drag components from the left panel to add them to your experiment flow</p>
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md">
                Add First Stage
              </button>
            </div>
            
            {/* Flow Canvas Controls */}
            <div className="flex justify-end mt-3 space-x-3">
              <button className="flex items-center text-gray-600 hover:text-gray-800 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Layout Auto-Arrange
              </button>
              <button className="flex items-center text-gray-600 hover:text-gray-800 text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Zoom
              </button>
            </div>
          </div>
          
          {/* Right Sidebar: Properties & Settings */}
          <div className="bg-white rounded-lg shadow lg:col-span-1">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-lg text-gray-800">Properties</h3>
            </div>
            
            {/* No Component Selected State */}
            <div className="p-4">
              <div className="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
                <p className="text-gray-500 text-sm">Select a component to view and edit its properties</p>
              </div>
            </div>
            
            {/* Tabs for Properties Panel */}
            <div className="border-t border-gray-200">
              <div className="flex border-b border-gray-200">
                <button className="flex-1 px-4 py-2 text-center text-sm font-medium text-purple-600 border-b-2 border-purple-600">
                  Properties
                </button>
                <button className="flex-1 px-4 py-2 text-center text-sm font-medium text-gray-500 hover:text-gray-700">
                  Logic
                </button>
                <button className="flex-1 px-4 py-2 text-center text-sm font-medium text-gray-500 hover:text-gray-700">
                  Conditions
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom Controls */}
        <div className="bg-white rounded-lg shadow mt-6 p-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Test Mode
              </button>
              <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Preview
              </button>
            </div>
            <div className="flex space-x-4">
              <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50">
                Save as Draft
              </button>
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md">
                Publish Experiment
              </button>
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