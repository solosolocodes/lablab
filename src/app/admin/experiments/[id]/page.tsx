'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import { toast } from 'react-hot-toast';

// Type definitions
interface QuestionType {
  id: string;
  text: string;
  type: 'text' | 'multipleChoice' | 'rating' | 'checkboxes';
  options?: string[];
  required: boolean;
}

interface BaseStage {
  id: string;
  type: string;
  title: string;
  description: string;
  durationSeconds: number;
  required: boolean;
  order: number;
}

interface InstructionsStage extends BaseStage {
  type: 'instructions';
  content: string;
  format: 'text' | 'markdown' | 'html';
}

interface ScenarioStage extends BaseStage {
  type: 'scenario';
  scenarioId: string;
}

interface SurveyStage extends BaseStage {
  type: 'survey';
  questions: QuestionType[];
}

interface BreakStage extends BaseStage {
  type: 'break';
  message: string;
}

type Stage = InstructionsStage | ScenarioStage | SurveyStage | BreakStage;

interface BranchCondition {
  type: 'response' | 'completion' | 'time' | 'random' | 'always';
  sourceStageId?: string;
  targetStageId: string;
  questionId?: string;
  expectedResponse?: string;
  operator?: 'equals' | 'contains' | 'greaterThan' | 'lessThan';
  threshold?: number;
  probability?: number;
}

interface Branch {
  id: string;
  fromStageId: string;
  conditions: BranchCondition[];
  defaultTargetStageId: string;
}

interface UserGroupAssignment {
  userGroupId: string;
  condition: string;
  maxParticipants?: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  userGroups: UserGroupAssignment[];
  stages: Stage[];
  branches: Branch[];
  startStageId?: string;
  createdAt: string;
  updatedAt: string;
  lastEditedAt: string;
}

interface UserGroup {
  id: string;
  name: string;
  description: string;
  users: {
    id: string;
    name: string;
    email: string;
  }[];
}

export default function ExperimentDetailsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const experimentId = params.id as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [experiment, setExperiment] = useState<Experiment | null>(null);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);

  // Redirect if not admin
  useEffect(() => {
    if (status !== 'loading' && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // Fetch experiment data and user groups
  useEffect(() => {
    const fetchData = async () => {
      if (!experimentId || status !== 'authenticated') return;
      
      try {
        setIsLoading(true);
        
        // Fetch experiment and user groups in parallel
        const [experimentResponse, userGroupsResponse] = await Promise.all([
          fetch(`/api/experiments/${experimentId}`),
          fetch('/api/user-groups')
        ]);
        
        if (!experimentResponse.ok) {
          throw new Error('Failed to fetch experiment');
        }
        
        if (!userGroupsResponse.ok) {
          throw new Error('Failed to fetch user groups');
        }
        
        const experimentData = await experimentResponse.json();
        const userGroupsData = await userGroupsResponse.json();
        
        setExperiment(experimentData);
        setUserGroups(userGroupsData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data: ' + (error instanceof Error ? error.message : 'Unknown error'));
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [experimentId, status]);

  // Get user group name by ID
  const getUserGroupName = (userGroupId: string) => {
    const userGroup = userGroups.find(group => group.id === userGroupId);
    return userGroup ? userGroup.name : 'Unknown Group';
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  // Get stage type icon
  const getStageTypeIcon = (type: string) => {
    switch (type) {
      case 'instructions':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'scenario':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'survey':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        );
      case 'break':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  // Get status badge classes
  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
              <span className={`ml-3 px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClasses(experiment.status)}`}>
                {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
              </span>
            </div>
            <p className="text-gray-600 mb-2">{experiment.description}</p>
            <div className="text-sm text-gray-500">
              Created: {formatDate(experiment.createdAt)} • Last Modified: {formatDate(experiment.lastEditedAt)}
            </div>
          </div>
          <div className="flex space-x-2">
            <Link href={`/admin/experiments/${experimentId}/designer`}>
              <Button className="bg-blue-600 hover:bg-blue-700 px-4 py-2">
                Edit Design
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Experiment Info */}
          <div className="md:col-span-2 space-y-6">
            {/* Stages Section */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">Experiment Stages</h2>
              </div>
              
              {experiment.stages.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {experiment.stages.sort((a, b) => a.order - b.order).map((stage) => (
                    <div key={stage.id} className="px-6 py-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mt-1">
                          {getStageTypeIcon(stage.type)}
                        </div>
                        <div className="ml-3 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-md font-medium text-gray-900">{stage.title}</h3>
                            <span className="text-xs text-gray-500">
                              {stage.durationSeconds} sec • {stage.required ? 'Required' : 'Optional'}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{stage.description}</p>
                          
                          {/* Stage-specific details */}
                          {stage.type === 'instructions' && (
                            <div className="mt-2 p-2 bg-blue-50 rounded-md text-sm">
                              <div className="text-blue-700 font-medium mb-1">Instructions ({(stage as InstructionsStage).format})</div>
                              <div className="text-gray-600 text-xs whitespace-pre-line line-clamp-2">
                                {(stage as InstructionsStage).content.length > 150 
                                  ? (stage as InstructionsStage).content.substring(0, 150) + '...' 
                                  : (stage as InstructionsStage).content}
                              </div>
                            </div>
                          )}
                          
                          {stage.type === 'survey' && (stage as SurveyStage).questions && (
                            <div className="mt-2 p-2 bg-purple-50 rounded-md text-sm">
                              <div className="text-purple-700 font-medium mb-1">
                                Survey ({(stage as SurveyStage).questions.length} question{(stage as SurveyStage).questions.length !== 1 ? 's' : ''})
                              </div>
                              <div className="text-gray-600 text-xs">
                                {(stage as SurveyStage).questions.slice(0, 2).map((q) => (
                                  <div key={q.id} className="mb-1">• {q.text}</div>
                                ))}
                                {(stage as SurveyStage).questions.length > 2 && (
                                  <div>• ...and {(stage as SurveyStage).questions.length - 2} more</div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {stage.type === 'scenario' && (
                            <div className="mt-2 p-2 bg-green-50 rounded-md text-sm">
                              <div className="text-green-700 font-medium">
                                Scenario ID: {(stage as ScenarioStage).scenarioId}
                              </div>
                            </div>
                          )}
                          
                          {stage.type === 'break' && (
                            <div className="mt-2 p-2 bg-amber-50 rounded-md text-sm">
                              <div className="text-amber-700 font-medium">Break Message:</div>
                              <div className="text-gray-600 text-xs">
                                {(stage as BreakStage).message}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p>No stages have been added to this experiment yet.</p>
                  <Link href={`/admin/experiments/${experimentId}/designer`} className="text-purple-600 mt-2 inline-block">
                    Go to Designer to add stages
                  </Link>
                </div>
              )}
            </div>
            
            {/* Flow Branches */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">Flow Logic</h2>
              </div>
              
              {experiment.branches && experiment.branches.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {experiment.branches.map((branch) => {
                    // Find stage names
                    const fromStage = experiment.stages.find((s) => s.id === branch.fromStageId);
                    const defaultTargetStage = experiment.stages.find((s) => s.id === branch.defaultTargetStageId);
                    
                    return (
                      <div key={branch.id} className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-800">
                              From: <span className="text-blue-600">{fromStage ? fromStage.title : 'Unknown Stage'}</span>
                            </div>
                            <div className="text-sm font-medium text-gray-800">
                              Default To: <span className="text-green-600">{defaultTargetStage ? defaultTargetStage.title : 'Unknown Stage'}</span>
                            </div>
                          </div>
                          
                          {branch.conditions && branch.conditions.length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs text-gray-500 mb-1">Conditions:</div>
                              <div className="space-y-1">
                                {branch.conditions.map((condition, index) => {
                                  const targetStage = experiment.stages.find((s) => s.id === condition.targetStageId);
                                  
                                  return (
                                    <div key={index} className="p-2 bg-gray-50 rounded-md text-xs flex justify-between">
                                      <div>
                                        <span className="font-medium">{condition.type}</span>
                                        {condition.type === 'response' && condition.questionId && (
                                          <span> (Question: {condition.questionId})</span>
                                        )}
                                        {condition.type === 'random' && condition.probability !== undefined && (
                                          <span> ({condition.probability}% chance)</span>
                                        )}
                                      </div>
                                      <div>
                                        → <span className="text-green-600">{targetStage ? targetStage.title : 'Unknown Stage'}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p>No flow logic has been defined for this experiment yet.</p>
                  <Link href={`/admin/experiments/${experimentId}/designer`} className="text-purple-600 mt-2 inline-block">
                    Go to Designer to add flow logic
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* User Groups */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">User Groups</h2>
              </div>
              
              {experiment.userGroups && experiment.userGroups.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {experiment.userGroups.map((group) => (
                    <div key={group.userGroupId} className="px-6 py-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="font-medium text-gray-800">{getUserGroupName(group.userGroupId)}</div>
                          <div className="text-sm text-gray-500">Condition: {group.condition}</div>
                        </div>
                        {group.maxParticipants && (
                          <div className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                            Max: {group.maxParticipants}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-gray-500">
                  <p>No user groups have been assigned to this experiment.</p>
                </div>
              )}
            </div>
            
            {/* Start Stage */}
            {experiment.startStageId && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b">
                  <h2 className="text-lg font-semibold text-gray-800">Starting Point</h2>
                </div>
                <div className="px-6 py-4">
                  {(() => {
                    const startStage = experiment.stages.find((s) => s.id === experiment.startStageId);
                    return startStage ? (
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {getStageTypeIcon(startStage.type)}
                        </div>
                        <div className="ml-3">
                          <div className="font-medium text-gray-800">{startStage.title}</div>
                          <div className="text-sm text-gray-500">{startStage.type}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Start stage set but not found in stages list.
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
            
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-semibold text-gray-800">Quick Actions</h2>
              </div>
              <div className="p-6 space-y-3">
                <Link href={`/admin/experiments/${experimentId}/designer`} className="block w-full">
                  <button className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit Experiment Design
                  </button>
                </Link>
                
                <button className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview Experiment
                </button>
                
                <button 
                  className={`w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    experiment.status === 'draft' 
                      ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500' 
                      : 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
                  } focus:outline-none focus:ring-2 focus:ring-offset-2`}
                >
                  {experiment.status === 'draft' ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Activate Experiment
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Pause Experiment
                    </>
                  )}
                </button>
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