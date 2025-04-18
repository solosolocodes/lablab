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
  surveyId?: string;
  questions?: Array<{
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
  const [loadError, setLoadError] = useState<string | null>(null);
  // Add more fields to scenario state
  const [scenarios, setScenarios] = useState<Array<{ 
    id: string; 
    name: string; 
    description?: string;
    rounds?: number;
    roundDuration?: number;
  }>>([]);
  
  const [surveys, setSurveys] = useState<Array<{
    _id: string;
    title: string;
    description?: string;
    status: string;
    responsesCount?: number;
  }>>([]);
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

  // Common types and functions outside of useEffect
  // Types for API response with required fields
  interface ExperimentResponse {
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
    [key: string]: unknown;
  }
  
  // Type for scenario data
  interface ScenarioResponse {
    id: string;
    name: string;
    [key: string]: unknown;
  }
  
  // Type for user group data
  interface UserGroupResponse {
    id: string;
    name: string;
    [key: string]: unknown;
  }
  
  // Generic API response type for other endpoints
  interface ApiResponse {
    [key: string]: unknown;
  }
  
  // Types for error tracking
  interface ApiError extends Error {
    status?: number;
    statusText?: string;
    data?: unknown;
  }
  
  // Common fetchWithRetry function for all API requests
  const fetchWithRetry = async <T = ApiResponse>(url: string, options: RequestInit = {}, maxRetries = 3, timeout = 10000): Promise<T> => {
    // Set default headers if not provided
    const fetchOptions = {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };
    
    // Implement exponential backoff retry
    let retries = 0;
    let lastError: ApiError | null = null;
    
    while (retries <= maxRetries) {
      try {
        const controller = new AbortController();
        // Add signal to options, merging with existing signal if present
        const signal = controller.signal;
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        console.log(`API Request (attempt ${retries + 1}/${maxRetries + 1}): ${url}`);
        
        const response = await fetch(url, {
          ...fetchOptions,
          signal,
          cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        // Get response as text first for better error handling
        const responseText = await response.text();
        console.log(`Response from ${url} (${responseText.length} bytes)`);
        
        // No response body
        if (!responseText || !responseText.trim()) {
          throw new Error('Empty response from server');
        }
        
        // Parse JSON
        let data: unknown;
        try {
          data = JSON.parse(responseText);
        } catch (jsonError) {
          console.error('JSON parse error:', jsonError);
          throw new Error(`Invalid JSON response from server: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}`);
        }
        
        // Handle non-OK responses
        if (!response.ok) {
          // Check if data has a message property
          const message = typeof data === 'object' && data !== null && 'message' in data
            ? String(data.message)
            : `Server error (${response.status})`;
            
          const error = new Error(message) as ApiError;
          // Add extra properties to the error
          error.status = response.status;
          error.statusText = response.statusText;
          error.data = data;
          throw error;
        }
        
        return data as T;
      } catch (error) {
        // Create a properly typed error object
        const typedError: ApiError = error instanceof Error 
          ? error as ApiError 
          : new Error(String(error));
        
        lastError = typedError;
        
        // Don't retry aborted requests (timeouts) or certain HTTP status codes
        if (
          typedError.name === 'AbortError' || 
          (typedError.status !== undefined && typedError.status >= 400 && typedError.status < 500)
        ) {
          console.error(`Request to ${url} failed with non-retryable error:`, typedError);
          throw typedError;
        }
        
        // If we've reached max retries, throw the last error
        if (retries >= maxRetries) {
          console.error(`Request to ${url} failed after ${maxRetries + 1} attempts:`, typedError);
          throw typedError;
        }
        
        // Exponential backoff with jitter
        const delay = Math.min(1000 * (2 ** retries) + Math.random() * 1000, 10000);
        console.log(`Retrying request to ${url} in ${delay}ms... (${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
      }
    }
    
    // Should never get here, but TypeScript needs it
    if (lastError) {
      throw lastError;
    }
    throw new Error(`Unknown error fetching ${url}`);
  };

  // Function to fetch a specific scenario's details
  const fetchScenarioDetails = async (scenarioId: string) => {
    if (!scenarioId) return null;
    
    try {
      const data = await fetchWithRetry<{
        id: string;
        name: string;
        description: string;
        rounds: number;
        roundDuration: number;
      }>(`/api/scenarios/${scenarioId}`, {
        method: 'GET'
      }, 2, 8000); // 2 retries, 8 second timeout
      
      return data;
    } catch (error) {
      console.error(`Error fetching scenario details for ID ${scenarioId}:`, error);
      toast.error('Failed to load scenario details');
      return null;
    }
  };

  // Fetch experiment data
  useEffect(() => {
    const fetchExperiment = async () => {
      if (!experimentId || status !== 'authenticated') return;
      
      try {
        setIsLoading(true);
        setLoadError(null);
        
        console.log(`Fetching experiment ID: ${experimentId}`);
        
        try {
          // Fetch experiment data with retry and proper typing
          const data = await fetchWithRetry<ExperimentResponse>(`/api/experiments/${experimentId}`, {
            method: 'GET'
          }, 3, 15000); // 3 retries, 15 second timeout
          
          // Validate minimum data requirements
          if (!data.id) {
            throw new Error('Invalid experiment data: missing ID');
          }
          
          console.log('Successfully loaded experiment:', { id: data.id, name: data.name });
          setExperiment(data);
          
          // Fetch supporting data in parallel, but don't fail if these requests fail
          await Promise.allSettled([
            fetchScenarios(),
            fetchSurveys(),
            fetchUserGroups()
          ]).then(results => {
            // Log any failures from the parallel requests
            results.forEach((result, index) => {
              if (result.status === 'rejected') {
                console.error(`Failed to fetch supporting data (${index === 0 ? 'scenarios' : 'user groups'}):`, result.reason);
              }
            });
          });
          
          setIsLoading(false);
        } catch (error) {
          // Handle specific error types
          let errorMessage = 'Unknown error occurred';
          
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              errorMessage = 'Request timed out. Please try again.';
            } else {
              errorMessage = error.message;
            }
          }
          
          console.error('Error fetching experiment:', error);
          console.error('Experiment ID:', experimentId);
          setLoadError(errorMessage);
          toast.error('Failed to load experiment: ' + errorMessage);
          setIsLoading(false);
        }
      } catch (outerError) {
        // Handle any unexpected errors in the outer try block
        console.error('Unexpected error in fetchExperiment:', outerError);
        setLoadError('An unexpected error occurred. Please try refreshing the page.');
        toast.error('An unexpected error occurred');
        setIsLoading(false);
      }
    };
    
    const fetchScenarios = async () => {
      try {
        const data = await fetchWithRetry<ScenarioResponse[]>('/api/scenarios', {
          method: 'GET'
        }, 2, 8000); // 2 retries, 8 second timeout
        
        setScenarios(data);
        return data;
      } catch (error) {
        console.error('Error fetching scenarios:', error);
        // Don't show toast for this secondary data
        // We can still render the page without scenarios
        return null;
      }
    };
    
    const fetchSurveys = async () => {
      try {
        const data = await fetchWithRetry<{success: boolean, surveys: Array<{
          _id: string;
          title: string;
          description?: string;
          status: string;
          responsesCount?: number;
        }>}>('/api/admin/surveys?status=published', {
          method: 'GET'
        }, 2, 8000); // 2 retries, 8 second timeout
        
        if (data.success && data.surveys) {
          setSurveys(data.surveys);
        }
        return data.surveys;
      } catch (error) {
        console.error('Error fetching surveys:', error);
        // Don't show toast for this secondary data
        // We can still render the page without surveys
        return null;
      }
    };
    
    const fetchUserGroups = async () => {
      try {
        const data = await fetchWithRetry<UserGroupResponse[]>('/api/user-groups', {
          method: 'GET'
        }, 2, 8000); // 2 retries, 8 second timeout
        
        setUserGroups(data);
        return data;
      } catch (error) {
        console.error('Error fetching user groups:', error);
        // Don't show toast for this secondary data
        // We can still render the page without user groups
        return null;
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
          surveyId: '',
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
  const handleStageFormChange = async (field: string, value: unknown) => {
    if (!stageFormData) return;
    
    // Special case for scenarioId changes - fetch scenario details
    if (field === 'scenarioId' && typeof value === 'string' && value) {
      // Show loading toast
      const loadingToast = toast.loading('Loading scenario details...');
      
      // Fetch scenario details
      const scenarioDetails = await fetchScenarioDetails(value);
      
      toast.dismiss(loadingToast);
      
      if (scenarioDetails) {
        // Update form data with scenario details
        setStageFormData({
          ...stageFormData,
          scenarioId: value,
          // Set title and description from scenario (not editable)
          title: scenarioDetails.name,
          description: scenarioDetails.description,
          // Set rounds and roundDuration from scenario (not editable)
          rounds: scenarioDetails.rounds,
          roundDuration: scenarioDetails.roundDuration,
          // Update durationSeconds based on rounds and roundDuration
          durationSeconds: scenarioDetails.rounds * scenarioDetails.roundDuration
        });
        
        toast.success('Scenario details loaded');
        return;
      }
    }
    
    // Special case for surveyId changes - update title and description
    if (field === 'surveyId' && typeof value === 'string' && value) {
      const selectedSurvey = surveys.find(s => s._id === value);
      
      if (selectedSurvey) {
        // Update form data with survey details
        setStageFormData({
          ...stageFormData,
          surveyId: value,
          // Set title and description from survey
          title: selectedSurvey.title,
          description: selectedSurvey.description || `Survey stage using "${selectedSurvey.title}"`,
          // Set default duration if not already set
          durationSeconds: stageFormData.durationSeconds || 300,
        });
        
        toast.success('Survey selected');
        return;
      }
    }
    
    // Default behavior for other fields
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
            surveyId: surveyData.surveyId || stage.surveyId,
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
  const saveExperiment = async (status: 'draft' | 'published' | 'active' = 'draft') => {
    if (!experiment) return;
    
    try {
      // Validate data before sending
      const validationErrors: string[] = [];
      
      // Check for stages without required data
      if (experiment.stages) {
        experiment.stages.forEach((stage, index) => {
          if (stage.type === 'scenario' && !stage.scenarioId) {
            validationErrors.push(`Stage ${index + 1} (${stage.title}) is missing a scenario selection`);
          }
          
          if (stage.type === 'survey') {
            const surveyStage = stage as SurveyStage;
            if (!surveyStage.surveyId && (!surveyStage.questions || surveyStage.questions.length === 0)) {
              validationErrors.push(`Stage ${index + 1} (${stage.title}) is missing a survey selection`);
            }
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
      
      // Additional validation for active experiments
      if (status === 'active') {
        if (experiment.stages.length === 0) {
          validationErrors.push('Experiment must have at least one stage to be published');
        }
        
        if (experiment.userGroups.length === 0) {
          validationErrors.push('Experiment must have at least one user group to be published');
        }
      }
      
      // Show validation errors if any
      if (validationErrors.length > 0) {
        const errorMessage = validationErrors.join('\n• ');
        toast.error(`Please fix these errors:\n• ${errorMessage}`);
        console.error('Client-side validation errors:', validationErrors);
        return;
      }
      
      // Show saving indicator to user
      const actionText = status === 'draft' 
        ? 'Saving experiment...' 
        : status === 'active'
          ? 'Publishing experiment...'
          : 'Saving and publishing experiment...';
          
      const savingToast = toast.loading(actionText);
      
      const updatedExperiment = {
        ...experiment,
        status,
        lastEditedAt: new Date().toISOString()
      };
      
      // Implement retry logic for save operation
      const maxRetries = 2;
      let currentRetry = 0;
      let saveSuccessful = false;
      
      while (currentRetry <= maxRetries && !saveSuccessful) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout for save
          
          console.log(`Saving experiment (attempt ${currentRetry + 1}/${maxRetries + 1})...`);
          
          const response = await fetch(`/api/experiments/${experimentId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(updatedExperiment),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          // Try to get response text first
          const responseText = await response.text();
          console.log(`Save response (${responseText.length} bytes)`);
          
          // Parse JSON if we have a response
          let errorData = null;
          if (responseText && responseText.trim()) {
            try {
              errorData = JSON.parse(responseText);
            } catch (jsonError) {
              console.error('JSON parse error on save response:', jsonError);
            }
          }
          
          if (response.ok) {
            saveSuccessful = true;
            toast.dismiss(savingToast);
            
            // Different success message based on status
            if (status === 'draft') {
              toast.success('Experiment saved as draft');
            } else if (status === 'active') {
              toast.success('Experiment published successfully! It is now active and visible to participants.');
              // Redirect to experiments list after activating
              setTimeout(() => {
                router.push('/admin/experiments');
              }, 1500);
            } else {
              toast.success('Experiment saved and published!');
              // Redirect to experiments list after publishing
              setTimeout(() => {
                router.push('/admin/experiments');
              }, 1500);
            }
            
            break;
          } else {
            let errorMessage = response.statusText;
            
            if (errorData) {
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
            } else {
              // If response is not JSON, use the status text
              errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
            }
            
            // For 4xx errors, don't retry
            if (response.status >= 400 && response.status < 500) {
              throw new Error(`Failed to save experiment: ${errorMessage}`);
            }
            
            // For other errors, retry if we haven't exceeded max retries
            if (currentRetry >= maxRetries) {
              throw new Error(`Failed to save experiment after multiple attempts: ${errorMessage}`);
            }
            
            // Exponential backoff with jitter
            const delay = Math.min(1000 * (2 ** currentRetry) + Math.random() * 1000, 5000);
            console.log(`Retrying save in ${delay}ms... (attempt ${currentRetry + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (fetchError) {
          // Handle abort (timeout) errors
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            if (currentRetry >= maxRetries) {
              toast.dismiss(savingToast);
              throw new Error('Save operation timed out. Please try again.');
            }
            
            // If we haven't reached max retries, try again
            console.log('Save operation timed out, retrying...');
          } else {
            // For other errors, only retry server errors
            if (currentRetry >= maxRetries) {
              toast.dismiss(savingToast);
              throw fetchError;
            }
          }
        }
        
        currentRetry++;
      }
      
      // If we get here and haven't succeeded, dismiss the loading toast
      if (!saveSuccessful) {
        toast.dismiss(savingToast);
        toast.error('Failed to save experiment after multiple attempts.');
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
    
    // Update the status to 'active' instead of 'published'
    if (experiment.userGroups.length === 0) {
      toast.error('Cannot publish an experiment without any user groups. Please add at least one user group.');
      return;
    }
    
    await saveExperiment('active');
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

  // Custom error component for better organization and reusability
  const ErrorDisplay = ({ 
    title, 
    message, 
    details, 
    actions = null, 
    errorType = 'error' 
  }: { 
    title: string; 
    message: string; 
    details?: React.ReactNode; 
    actions?: React.ReactNode;
    errorType?: 'error' | 'warning' | 'connection' | 'validation';
  }) => {
    // Determine background and colors based on error type
    const colors = {
      error: {
        bg: 'bg-red-50',
        border: 'border-red-200',
        title: 'text-red-700',
        message: 'text-red-600'
      },
      warning: {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        title: 'text-amber-700',
        message: 'text-amber-600'
      },
      connection: {
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        title: 'text-blue-700',
        message: 'text-blue-600'
      },
      validation: {
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        title: 'text-orange-700',
        message: 'text-orange-600'
      }
    };
    
    const errorColors = colors[errorType];
    
    return (
      <div className={`${errorColors.bg} border ${errorColors.border} rounded-lg p-4 mb-4`}>
        <h3 className={`${errorColors.title} font-medium mb-2`}>{title}</h3>
        <p className={`${errorColors.message} mb-2`}>{message}</p>
        {details && <div className="mt-2 mb-2">{details}</div>}
        {actions && <div className="mt-3">{actions}</div>}
      </div>
    );
  };

  // If there was an error loading the experiment
  if (loadError) {
    // Determine error type from the message for better categorization
    let errorType: 'error' | 'warning' | 'connection' | 'validation' = 'error';
    let suggestedFix = null;
    
    if (loadError.includes('timeout') || loadError.includes('network') || loadError.includes('connection') || loadError.includes('Database')) {
      errorType = 'connection';
      suggestedFix = "Please check your internet connection and try again.";
    } else if (loadError.includes('not found') || loadError.includes('404')) {
      errorType = 'warning';
      suggestedFix = "This experiment may have been deleted. You can return to the experiments list to see available experiments.";
    } else if (loadError.includes('validation') || loadError.includes('invalid')) {
      errorType = 'validation';
      suggestedFix = "There may be an issue with the experiment data. Try refreshing the page.";
    }
    
    // Generate common error causes based on type
    const errorCauses = {
      'connection': [
        "Database connection issue",
        "Network connectivity problem",
        "Server may be temporarily unavailable"
      ],
      'warning': [
        "Experiment ID may be invalid",
        "Experiment may have been deleted",
        "You may not have permission to view this experiment"
      ],
      'validation': [
        "Data format issue",
        "Invalid experiment data structure",
        "Server validation error"
      ],
      'error': [
        "Invalid experiment ID",
        "Database connection issue",
        "Experiment was deleted",
        "Server error"
      ]
    };
    
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <ErrorDisplay
            title="Error Loading Experiment"
            message={loadError}
            errorType={errorType}
            details={
              <>
                {suggestedFix && <p className="text-gray-700 font-medium mb-2">{suggestedFix}</p>}
                <p className="text-gray-600 text-sm mb-2">The experiment could not be loaded. This could be due to:</p>
                <ul className="text-gray-600 text-sm list-disc list-inside mb-2">
                  {errorCauses[errorType].map((cause, index) => (
                    <li key={index}>{cause}</li>
                  ))}
                </ul>
                <p className="text-gray-600 text-sm">Experiment ID: {experimentId}</p>
              </>
            }
            actions={
              <div className="flex justify-between mt-3">
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700 text-sm"
                >
                  Refresh Page
                </button>
                <Link href="/admin/experiments" className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm">
                  Return to Experiments
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );
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
                <Link href="/admin/surveys" className="px-3 py-2 rounded hover:bg-purple-600">Surveys</Link>
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
                  {/* Common fields for all stage types - hide for scenarios */}
                  {stageFormData.type !== 'scenario' && (
                    <>
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
                    </>
                  )}
                  
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
                          Select Scenario
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
                        {(stageFormData as Partial<ScenarioStage>).scenarioId && (
                          <p className="text-xs text-blue-600 mt-1">
                            ℹ️ The title, description, rounds, and duration are automatically set from the selected scenario.
                          </p>
                        )}
                      </div>
                      
                      {/* Hidden fields will still store scenario data but not show UI elements */}
                      {!(stageFormData as Partial<ScenarioStage>).scenarioId && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mt-3">
                          <p className="text-sm text-yellow-700">
                            Please select a scenario from the dropdown above.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  
                  {selectedStage.type === 'survey' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Select Survey
                      </label>
                      <select
                        className="w-full px-3 py-2 border rounded-md text-sm mb-4"
                        value={(stageFormData as Partial<SurveyStage>).surveyId || ''}
                        onChange={(e) => handleStageFormChange('surveyId', e.target.value)}
                      >
                        <option value="">-- Select a survey --</option>
                        {surveys.map(survey => (
                          <option key={survey._id} value={survey._id}>
                            {survey.title} {survey.status === 'published' ? '(Published)' : survey.status === 'draft' ? '(Draft)' : '(Archived)'}
                          </option>
                        ))}
                      </select>

                      {(stageFormData as Partial<SurveyStage>).surveyId ? (
                        <div className="bg-blue-50 p-4 rounded-md border border-blue-200 mb-4">
                          {(() => {
                            const selectedSurvey = surveys.find(s => s._id === (stageFormData as Partial<SurveyStage>).surveyId);
                            if (selectedSurvey) {
                              return (
                                <div>
                                  <div className="flex justify-between items-center">
                                    <h4 className="font-medium text-blue-800">{selectedSurvey.title}</h4>
                                    <Link 
                                      href={`/admin/surveys/${selectedSurvey._id}/edit`} 
                                      className="text-xs text-blue-600 hover:text-blue-800 bg-white px-2 py-1 rounded border border-blue-200"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      Edit Survey
                                    </Link>
                                  </div>
                                  {selectedSurvey.description && (
                                    <p className="text-sm text-blue-700 mt-2">{selectedSurvey.description}</p>
                                  )}
                                  <div className="flex space-x-4 mt-3 text-xs text-blue-600">
                                    <span>Status: {selectedSurvey.status}</span>
                                    {selectedSurvey.responsesCount !== undefined && (
                                      <span>Responses: {selectedSurvey.responsesCount}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <p className="text-sm text-blue-700">Loading survey details...</p>
                              );
                            }
                          })()}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-amber-700 bg-amber-50 rounded-md border border-amber-200 mb-4">
                          Please select a survey from the dropdown above.
                          {surveys.length === 0 && (
                            <div className="mt-2">
                              <p className="text-sm">No published surveys found. Please create a survey first.</p>
                              <Link 
                                href="/admin/surveys" 
                                className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Go to Survey Management
                              </Link>
                            </div>
                          )}
                        </div>
                      )}
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
                {experiment.status === 'active' ? 'Update Published Experiment' : 'Publish Experiment'}
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