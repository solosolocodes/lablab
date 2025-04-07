'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Type definitions for experiment stages
type StageType = 'instructions' | 'scenario' | 'survey' | 'break';

interface BaseStage {
  id: string;
  type: StageType;
  title: string;
  description: string;
  durationSeconds: number;
  required: boolean;
  order: number;
}

interface InstructionsStage extends BaseStage {
  type: 'instructions';
  content: string;
}

interface ScenarioStage extends BaseStage {
  type: 'scenario';
  scenarioId: string;
  rounds: number;
  roundDuration: number;
}

interface SurveyStage extends BaseStage {
  type: 'survey';
  questions: Array<{
    id: string;
    text: string;
    type: 'text' | 'multipleChoice' | 'rating' | 'checkboxes';
    required: boolean;
    options?: string[];
  }>;
}

interface BreakStage extends BaseStage {
  type: 'break';
  message: string;
}

type Stage = InstructionsStage | ScenarioStage | SurveyStage | BreakStage;

export default function ExperimentDesignerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const experimentId = params.id as string;
  
  // State for the experiment data
  const [isLoading, setIsLoading] = useState(true);
  const [scenarios, setScenarios] = useState<Array<{ id: string; name: string }>>([]);
  const [userGroups, setUserGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [experiment, setExperiment] = useState<{
    id: string;
    name: string;
    description: string;
    status: string;
    stages: Stage[];
    userGroups: Array<{
      userGroupId: string;
      name?: string;
      condition: string;
      maxParticipants?: number;
    }>;
    createdAt: string;
    updatedAt: string;
    lastEditedAt: string;
  } | null>(null);

  // State for the editor
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);
  const [selectedUserGroup, setSelectedUserGroup] = useState<string | null>(null);

  // State for temporary form data when editing
  const [stageFormData, setStageFormData] = useState<Partial<Stage> | null>(null);
  
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
        
        // Also fetch scenarios and user groups
        await Promise.all([
          fetchScenarios(),
          fetchUserGroups()
        ]);
        
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching experiment:', error);
        toast.error('Failed to load experiment: ' + (error instanceof Error ? error.message : 'Unknown error'));
        setIsLoading(false);
      }
    };
    
    const fetchScenarios = async () => {
      try {
        const response = await fetch('/api/scenarios');
        if (response.ok) {
          const data = await response.json();
          setScenarios(data);
        }
      } catch (error) {
        console.error('Error fetching scenarios:', error);
      }
    };
    
    const fetchUserGroups = async () => {
      try {
        const response = await fetch('/api/user-groups');
        if (response.ok) {
          const data = await response.json();
          setUserGroups(data);
        }
      } catch (error) {
        console.error('Error fetching user groups:', error);
      }
    };
    
    fetchExperiment();
  }, [experimentId, status]);

  // Add a new stage
  const addStage = (type: StageType) => {
    if (!experiment) return;
    
    const stageCount = experiment.stages.length;
    const id = `stage-${Date.now()}`;
    
    let newStage: Stage;
    
    switch (type) {
      case 'instructions':
        newStage = {
          id,
          type: 'instructions',
          title: `New Instructions`,
          description: 'Description for instructions',
          content: 'Enter your instructions here...',
          durationSeconds: 60,
          required: true,
          order: stageCount
        };
        break;
      case 'scenario':
        newStage = {
          id,
          type: 'scenario',
          title: `New Scenario`,
          description: 'Description for scenario',
          scenarioId: '',
          rounds: 1,
          roundDuration: 60,
          durationSeconds: 60,
          required: true,
          order: stageCount
        };
        break;
      case 'survey':
        newStage = {
          id,
          type: 'survey',
          title: `New Survey`,
          description: 'Description for survey',
          questions: [],
          durationSeconds: 300,
          required: true,
          order: stageCount
        };
        break;
      case 'break':
        newStage = {
          id,
          type: 'break',
          title: `New Break`,
          description: 'Description for break',
          message: 'Take a short break...',
          durationSeconds: 60,
          required: true,
          order: stageCount
        };
        break;
    }
    
    const updatedExperiment = {
      ...experiment,
      stages: [...experiment.stages, newStage]
    };
    
    setExperiment(updatedExperiment);
    setSelectedStage(newStage);
    setStageFormData(newStage);
  };

  // Delete a stage
  const deleteStage = (stageId: string) => {
    if (!experiment) return;
    
    const updatedStages = experiment.stages.filter(stage => stage.id !== stageId);
    
    // Reorder the stages
    updatedStages.forEach((stage, index) => {
      stage.order = index;
    });
    
    const updatedExperiment = {
      ...experiment,
      stages: updatedStages
    };
    
    setExperiment(updatedExperiment);
    
    if (selectedStage?.id === stageId) {
      setSelectedStage(null);
      setStageFormData(null);
    }
  };

  // Move a stage up or down
  const moveStage = (stageId: string, direction: 'up' | 'down') => {
    if (!experiment) return;
    
    const stageIndex = experiment.stages.findIndex(stage => stage.id === stageId);
    if (stageIndex === -1) return;
    
    // If trying to move up the first stage or down the last stage, do nothing
    if (
      (direction === 'up' && stageIndex === 0) || 
      (direction === 'down' && stageIndex === experiment.stages.length - 1)
    ) {
      return;
    }
    
    const updatedStages = [...experiment.stages];
    const newIndex = direction === 'up' ? stageIndex - 1 : stageIndex + 1;
    
    // Swap the stages
    const temp = updatedStages[stageIndex];
    updatedStages[stageIndex] = updatedStages[newIndex];
    updatedStages[newIndex] = temp;
    
    // Update the order property
    updatedStages.forEach((stage, index) => {
      stage.order = index;
    });
    
    const updatedExperiment = {
      ...experiment,
      stages: updatedStages
    };
    
    setExperiment(updatedExperiment);
  };

  // Handle form input changes for stage editing
  const handleStageFormChange = (field: string, value: unknown) => {
    if (!stageFormData) return;
    
    setStageFormData({
      ...stageFormData,
      [field]: value
    });
  };

  // Save the stage form changes
  const saveStageForm = () => {
    if (!experiment || !stageFormData || !selectedStage) return;
    
    const updatedStages = experiment.stages.map(stage => {
      if (stage.id === selectedStage.id) {
        // For type safety, handle each stage type specifically
        if (stage.type === 'instructions' && stageFormData.type === 'instructions') {
          return {
            ...stage,
            title: stageFormData.title || stage.title,
            description: stageFormData.description || stage.description,
            required: stageFormData.required !== undefined ? stageFormData.required : stage.required,
            durationSeconds: stageFormData.durationSeconds || stage.durationSeconds,
            content: (stageFormData as Partial<InstructionsStage>).content || stage.content
          } as InstructionsStage;
        } 
        else if (stage.type === 'scenario' && stageFormData.type === 'scenario') {
          const scenarioData = stageFormData as Partial<ScenarioStage>;
          const rounds = scenarioData.rounds || stage.rounds;
          const roundDuration = scenarioData.roundDuration || stage.roundDuration;
          return {
            ...stage,
            title: stageFormData.title || stage.title,
            description: stageFormData.description || stage.description,
            required: stageFormData.required !== undefined ? stageFormData.required : stage.required,
            scenarioId: scenarioData.scenarioId || stage.scenarioId,
            rounds: rounds,
            roundDuration: roundDuration,
            durationSeconds: rounds * roundDuration
          } as ScenarioStage;
        }
        else if (stage.type === 'survey' && stageFormData.type === 'survey') {
          const surveyData = stageFormData as Partial<SurveyStage>;
          return {
            ...stage,
            title: stageFormData.title || stage.title,
            description: stageFormData.description || stage.description,
            required: stageFormData.required !== undefined ? stageFormData.required : stage.required,
            durationSeconds: stageFormData.durationSeconds || stage.durationSeconds,
            questions: surveyData.questions || stage.questions
          } as SurveyStage;
        }
        else if (stage.type === 'break' && stageFormData.type === 'break') {
          const breakData = stageFormData as Partial<BreakStage>;
          return {
            ...stage,
            title: stageFormData.title || stage.title,
            description: stageFormData.description || stage.description,
            required: stageFormData.required !== undefined ? stageFormData.required : stage.required,
            durationSeconds: stageFormData.durationSeconds || stage.durationSeconds,
            message: breakData.message || stage.message
          } as BreakStage;
        }
        
        // Fallback case - shouldn't reach here in practice
        return stage;
      }
      return stage;
    });
    
    const updatedExperiment = {
      ...experiment,
      stages: updatedStages as Stage[]
    };
    
    setExperiment(updatedExperiment);
    
    // Update the selected stage
    const updatedSelectedStage = updatedStages.find(stage => stage.id === selectedStage.id) as Stage;
    setSelectedStage(updatedSelectedStage);
    
    toast.success('Stage updated successfully');
  };

  // Add a user group to the experiment
  const addUserGroup = (userGroupId: string) => {
    if (!experiment) return;
    
    // Check if user group is already added
    if (experiment.userGroups.some(group => group.userGroupId === userGroupId)) {
      toast.error('This user group is already added to the experiment');
      return;
    }
    
    const userGroup = userGroups.find(group => group.id === userGroupId);
    
    const updatedExperiment = {
      ...experiment,
      userGroups: [
        ...experiment.userGroups,
        {
          userGroupId,
          name: userGroup?.name,
          condition: 'control'
        }
      ]
    };
    
    setExperiment(updatedExperiment);
  };

  // Remove a user group from the experiment
  const removeUserGroup = (userGroupId: string) => {
    if (!experiment) return;
    
    const updatedExperiment = {
      ...experiment,
      userGroups: experiment.userGroups.filter(group => group.userGroupId !== userGroupId)
    };
    
    setExperiment(updatedExperiment);
    
    if (selectedUserGroup === userGroupId) {
      setSelectedUserGroup(null);
    }
  };

  // Update a user group's settings
  const updateUserGroup = (userGroupId: string, field: string, value: string | number | boolean) => {
    if (!experiment) return;
    
    const updatedUserGroups = experiment.userGroups.map(group => {
      if (group.userGroupId === userGroupId) {
        return {
          ...group,
          [field]: value
        };
      }
      return group;
    });
    
    const updatedExperiment = {
      ...experiment,
      userGroups: updatedUserGroups
    };
    
    setExperiment(updatedExperiment);
  };

  // Save the experiment (as draft)
  const saveExperiment = async (status: 'draft' | 'published' = 'draft') => {
    if (!experiment) return;
    
    try {
      // Validate data before sending
      const validationErrors: string[] = [];
      
      // Check for scenario stages without scenario ID
      if (experiment.stages) {
        experiment.stages.forEach((stage, index) => {
          if (stage.type === 'scenario' && !stage.scenarioId) {
            validationErrors.push(`Stage ${index + 1} (${stage.title}) is missing a scenario selection`);
          }
        });
      }
      
      // Check user groups for invalid maxParticipants
      if (experiment.userGroups) {
        experiment.userGroups.forEach(group => {
          // If maxParticipants is defined but less than 1, flag it
          if (group.maxParticipants !== undefined && Number(group.maxParticipants) < 1) {
            // Fix it automatically
            group.maxParticipants = 1;
          }
        });
      }
      
      // Show validation errors if any
      if (validationErrors.length > 0) {
        const errorMessage = validationErrors.join('\n• ');
        toast.error(`Please fix these errors:\n• ${errorMessage}`);
        console.error('Client-side validation errors:', validationErrors);
        return;
      }
      
      const updatedExperiment = {
        ...experiment,
        status,
        lastEditedAt: new Date().toISOString()
      };
      
      const response = await fetch(`/api/experiments/${experimentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedExperiment)
      });
      
      if (response.ok) {
        toast.success(status === 'draft' ? 'Experiment saved as draft' : 'Experiment published successfully!');
        
        if (status === 'published') {
          // Redirect to experiments list after publishing
          setTimeout(() => {
            router.push('/admin/experiments');
          }, 1500);
        }
      } else {
        let errorMessage = response.statusText;
        try {
          // Try to parse the response as JSON
          const errorData = await response.json();
          // Log detailed error information
          console.log('Detailed error response:', errorData);
          
          if (errorData.errors && Object.keys(errorData.errors).length > 0) {
            // If there are validation errors, format them nicely
            const errorDetails = Object.entries(errorData.errors)
              .map(([field, message]) => `${field}: ${message}`)
              .join(', ');
            errorMessage = `${errorData.message} (${errorDetails})`;
          } else {
            errorMessage = errorData.message || response.statusText;
          }
        } catch {
          // If response is not JSON, use the status text
          errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
        }
        throw new Error(`Failed to save experiment: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error saving experiment:', error);
      toast.error('Failed to save experiment: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Publish the experiment
  const publishExperiment = async () => {
    if (!experiment) return;
    
    if (experiment.stages.length === 0) {
      toast.error('Cannot publish an empty experiment. Add at least one stage.');
      return;
    }
    
    await saveExperiment('published');
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
        
        {/* Main Designer Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Components Section */}
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-3 mb-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg text-gray-800">Add New Components</h3>
              <div className="flex space-x-3">
                <button 
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md"
                  onClick={() => addStage('instructions')}
                >
                  Add Instructions
                </button>
                <button 
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
                  onClick={() => addStage('scenario')}
                >
                  Add Scenario
                </button>
                <button 
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md"
                  onClick={() => addStage('survey')}
                >
                  Add Survey
                </button>
                <button 
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-md"
                  onClick={() => addStage('break')}
                >
                  Add Break
                </button>
              </div>
            </div>
          </div>
          
          {/* Left Column: Stages List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-lg text-gray-800">Experiment Stages</h3>
                <p className="text-sm text-gray-500">
                  Drag stages to reorder or click to edit their properties
                </p>
              </div>
              <div className="p-4">
                {experiment.stages.length > 0 ? (
                  <div className="space-y-3">
                    {experiment.stages.map((stage, index) => (
                      <div 
                        key={stage.id} 
                        className={`p-3 rounded-lg border ${
                          stage.type === 'instructions' ? 'border-purple-200 bg-purple-50' :
                          stage.type === 'scenario' ? 'border-blue-200 bg-blue-50' :
                          stage.type === 'survey' ? 'border-green-200 bg-green-50' :
                          'border-amber-200 bg-amber-50'
                        } ${selectedStage?.id === stage.id ? 'ring-2 ring-purple-500' : ''}`}
                        onClick={() => {
                          setSelectedStage(stage);
                          setStageFormData(stage);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-medium flex items-center">
                            <span className="mr-2">{index + 1}.</span> 
                            <span>{stage.title}</span>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            stage.type === 'instructions' ? 'bg-purple-100 text-purple-700' :
                            stage.type === 'scenario' ? 'bg-blue-100 text-blue-700' :
                            stage.type === 'survey' ? 'bg-green-100 text-green-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {stage.type}
                            {stage.type === 'scenario' && (
                              <span className="ml-1">
                                ({(stage as ScenarioStage).rounds} rounds)
                              </span>
                            )}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-500 mt-1">{stage.description || 'No description'}</p>
                        
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-500">
                            Duration: {stage.durationSeconds} seconds
                          </span>
                          <div className="flex space-x-2">
                            {/* Reordering buttons */}
                            <div className="flex space-x-1">
                              {index > 0 && (
                                <button 
                                  className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveStage(stage.id, 'up');
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                              )}
                              
                              {index < experiment.stages.length - 1 && (
                                <button 
                                  className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveStage(stage.id, 'down');
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            
                            <button 
                              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteStage(stage.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <p className="text-gray-500 font-medium mb-1">Start Building Your Experiment</p>
                    <p className="text-gray-400 text-sm text-center mb-4">Add stages to build your experiment flow</p>
                    <div className="flex space-x-3">
                      <button 
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md"
                        onClick={() => addStage('instructions')}
                      >
                        Add Instructions
                      </button>
                      <button 
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
                        onClick={() => addStage('scenario')}
                      >
                        Add Scenario
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* User Groups Section */}
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-lg text-gray-800">User Groups</h3>
                <p className="text-sm text-gray-500">
                  Assign user groups to this experiment
                </p>
              </div>
              <div className="p-4">
                {experiment.userGroups.length > 0 ? (
                  <div className="space-y-3">
                    {experiment.userGroups.map((group) => {
                      const userGroup = userGroups.find(ug => ug.id === group.userGroupId);
                      return (
                        <div 
                          key={group.userGroupId} 
                          className={`p-3 rounded-lg border border-gray-200 ${selectedUserGroup === group.userGroupId ? 'ring-2 ring-purple-500' : ''}`}
                          onClick={() => setSelectedUserGroup(group.userGroupId)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-medium">{userGroup?.name || group.userGroupId}</span>
                              <div className="flex space-x-2 mt-1">
                                <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                                  Condition: {group.condition}
                                </span>
                              </div>
                            </div>
                            <button 
                              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeUserGroup(group.userGroupId);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 mb-3">No user groups assigned to this experiment</p>
                  </div>
                )}
                
                {/* Add User Group Dropdown */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Add User Group
                  </label>
                  <div className="flex space-x-2">
                    <select 
                      className="flex-1 px-3 py-2 border rounded-md text-sm"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          addUserGroup(e.target.value);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">Select a user group...</option>
                      {userGroups.filter(ug => 
                        !experiment.userGroups.some(g => g.userGroupId === ug.id)
                      ).map(group => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column: Properties */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-lg text-gray-800">
                {selectedStage 
                  ? `Edit ${selectedStage.type.charAt(0).toUpperCase() + selectedStage.type.slice(1)}` 
                  : selectedUserGroup
                    ? 'User Group Settings'
                    : 'Properties'
                }
              </h3>
            </div>
            
            <div className="p-4">
              {/* Stage Properties Form */}
              {selectedStage && stageFormData && (
                <div className="space-y-4">
                  {/* Common fields for all stage types */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      value={stageFormData.title || ''}
                      onChange={(e) => handleStageFormChange('title', e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      rows={2}
                      value={stageFormData.description || ''}
                      onChange={(e) => handleStageFormChange('description', e.target.value)}
                    />
                  </div>
                  
                  {/* Type-specific fields */}
                  {selectedStage.type === 'instructions' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Instructions Content
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        rows={5}
                        value={(stageFormData as Partial<InstructionsStage>).content || ''}
                        onChange={(e) => handleStageFormChange('content', e.target.value)}
                      />
                    </div>
                  )}
                  
                  {selectedStage.type === 'scenario' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Scenario
                        </label>
                        <select
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          value={(stageFormData as Partial<ScenarioStage>).scenarioId || ''}
                          onChange={(e) => handleStageFormChange('scenarioId', e.target.value)}
                        >
                          <option value="">-- Select a scenario --</option>
                          {scenarios.map(scenario => (
                            <option key={scenario.id} value={scenario.id}>
                              {scenario.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Number of Rounds
                          </label>
                          <input
                            type="number"
                            min="1"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            value={(stageFormData as Partial<ScenarioStage>).rounds || 1}
                            onChange={(e) => handleStageFormChange('rounds', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Round Duration (seconds)
                          </label>
                          <input
                            type="number"
                            min="10"
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            value={(stageFormData as Partial<ScenarioStage>).roundDuration || 60}
                            onChange={(e) => handleStageFormChange('roundDuration', parseInt(e.target.value) || 60)}
                          />
                        </div>
                      </div>
                      
                      <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Total Duration:</span>
                          <span className="text-sm text-gray-900">
                            {((stageFormData as Partial<ScenarioStage>).rounds || 1) * 
                              ((stageFormData as Partial<ScenarioStage>).roundDuration || 60)} seconds
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Calculated as {(stageFormData as Partial<ScenarioStage>).rounds || 1} rounds × 
                          {(stageFormData as Partial<ScenarioStage>).roundDuration || 60} seconds per round
                        </p>
                      </div>
                    </>
                  )}
                  
                  {selectedStage.type === 'survey' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Questions
                      </label>
                      <button
                        className="w-full py-2 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                        onClick={() => {
                          const currentQuestions = (stageFormData as Partial<SurveyStage>).questions || [];
                          handleStageFormChange('questions', [
                            ...currentQuestions, 
                            {
                              id: `q-${Date.now()}`,
                              text: 'New Question',
                              type: 'text',
                              required: true
                            }
                          ]);
                        }}
                      >
                        + Add Question
                      </button>
                      
                      <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                        {((stageFormData as Partial<SurveyStage>).questions || []).map((question, index) => (
                          <div key={question.id} className="border border-gray-200 rounded-md p-2">
                            <div className="flex justify-between items-start">
                              <input
                                type="text"
                                className="flex-1 px-2 py-1 text-xs border rounded"
                                value={question.text}
                                onChange={(e) => {
                                  const questions = [...((stageFormData as Partial<SurveyStage>).questions || [])];
                                  questions[index].text = e.target.value;
                                  handleStageFormChange('questions', questions);
                                }}
                              />
                              <button
                                className="ml-2 text-red-500 hover:text-red-700"
                                onClick={() => {
                                  const questions = [...((stageFormData as Partial<SurveyStage>).questions || [])];
                                  questions.splice(index, 1);
                                  handleStageFormChange('questions', questions);
                                }}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                            
                            <div className="mt-1 flex items-center space-x-2">
                              <select
                                className="px-2 py-1 text-xs border rounded"
                                value={question.type}
                                onChange={(e) => {
                                  const questions = [...((stageFormData as Partial<SurveyStage>).questions || [])];
                                  questions[index].type = e.target.value as 'text' | 'multipleChoice' | 'rating' | 'checkboxes';
                                  handleStageFormChange('questions', questions);
                                }}
                              >
                                <option value="text">Text</option>
                                <option value="multipleChoice">Multiple Choice</option>
                                <option value="rating">Rating</option>
                                <option value="checkboxes">Checkboxes</option>
                              </select>
                              
                              <label className="text-xs flex items-center">
                                <input
                                  type="checkbox"
                                  className="mr-1"
                                  checked={question.required}
                                  onChange={(e) => {
                                    const questions = [...((stageFormData as Partial<SurveyStage>).questions || [])];
                                    questions[index].required = e.target.checked;
                                    handleStageFormChange('questions', questions);
                                  }}
                                />
                                Required
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {selectedStage.type === 'break' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Break Message
                      </label>
                      <textarea
                        className="w-full px-3 py-2 border rounded-md text-sm"
                        rows={3}
                        value={(stageFormData as Partial<BreakStage>).message || ''}
                        onChange={(e) => handleStageFormChange('message', e.target.value)}
                      />
                      
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration (seconds)
                        </label>
                        <input
                          type="number"
                          min="5"
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          value={stageFormData.durationSeconds || 30}
                          onChange={(e) => handleStageFormChange('durationSeconds', parseInt(e.target.value) || 30)}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Common fields for all stage types */}
                  <div className="flex items-center mt-2">
                    <input
                      type="checkbox"
                      id="required"
                      className="mr-2"
                      checked={stageFormData.required !== false}
                      onChange={(e) => handleStageFormChange('required', e.target.checked)}
                    />
                    <label htmlFor="required" className="text-sm font-medium text-gray-700">
                      Required stage
                    </label>
                  </div>
                  
                  <div className="mt-4">
                    <button
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded"
                      onClick={saveStageForm}
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              )}
              
              {/* User Group Settings */}
              {selectedUserGroup && (
                <div className="space-y-4">
                  {(() => {
                    const group = experiment.userGroups.find(g => g.userGroupId === selectedUserGroup);
                    const userGroup = userGroups.find(ug => ug.id === selectedUserGroup);
                    
                    if (!group) return null;
                    
                    return (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Group Name
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border rounded-md text-sm bg-gray-50"
                            value={userGroup?.name || ''}
                            disabled
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Condition
                          </label>
                          <select
                            className="w-full px-3 py-2 border rounded-md text-sm"
                            value={group.condition}
                            onChange={(e) => updateUserGroup(selectedUserGroup, 'condition', e.target.value)}
                          >
                            <option value="control">Control</option>
                            <option value="treatment">Treatment</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        
                        
                        <div className="mt-4">
                          <button
                            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded"
                            onClick={() => removeUserGroup(selectedUserGroup)}
                          >
                            Remove User Group
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              
              {/* No selection state */}
              {!selectedStage && !selectedUserGroup && (
                <div className="text-center py-8">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                  </svg>
                  <p className="text-gray-500">Select a stage or user group to edit its properties</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Bottom Controls */}
        <div className="bg-white rounded-lg shadow mt-6 p-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-gray-500">
                {experiment.stages.length} stages, {experiment.userGroups.length} user groups
              </span>
            </div>
            <div className="flex space-x-4">
              <Link
                href={`/admin/experiments/${experimentId}/preview`}
                className="px-4 py-2 border border-green-500 text-green-700 rounded-md hover:bg-green-50"
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview Experiment
              </Link>
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => saveExperiment('draft')}
              >
                Save as Draft
              </button>
              <button 
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
                onClick={publishExperiment}
                disabled={experiment.stages.length === 0}
              >
                Publish Experiment
              </button>
            </div>
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