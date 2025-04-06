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
        
        {/* Experiment Designer Placeholder */}
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Experiment Designer</h2>
            <p className="text-gray-600 mb-6">
              The drag-and-drop experiment designer is currently under development. This feature will allow you to:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left mb-8">
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-700 mb-2">Create Experiment Stages</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Add instruction stages</li>
                  <li>Configure scenario stages</li>
                  <li>Create survey questions</li>
                  <li>Add breaks between activities</li>
                </ul>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-700 mb-2">Design Complex Flows</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Set up branching logic</li>
                  <li>Create conditional paths</li>
                  <li>Define completion criteria</li>
                  <li>Configure randomization rules</li>
                </ul>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-700 mb-2">Manage User Groups</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Assign participants to conditions</li>
                  <li>Set group-specific parameters</li>
                  <li>Balance participant assignments</li>
                  <li>Track completion statistics</li>
                </ul>
              </div>
              
              <div className="bg-amber-50 p-4 rounded-lg">
                <h3 className="font-semibold text-amber-700 mb-2">Preview & Test</h3>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>Preview the participant experience</li>
                  <li>Test different flow paths</li>
                  <li>Validate experiment configuration</li>
                  <li>Share preview links with team</li>
                </ul>
              </div>
            </div>
            
            <div className="text-gray-600">
              <p>Please check back soon for the full interactive experiment designer!</p>
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