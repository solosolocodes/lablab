'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';

type Stage = {
  id: string;
  type: 'instructions' | 'scenario' | 'survey' | 'break';
  title: string;
  description: string;
  durationSeconds: number;
  required: boolean;
  order: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // For additional type-specific properties
};

type ExperimentData = {
  id: string;
  name: string;
  description: string;
  stages: Stage[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // For any additional properties
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

interface ParticipantPerformContextType {
  experiment: ExperimentData | null;
  progress: ProgressData | null;
  currentStageIndex: number;
  timeRemaining: number;
  loadExperiment: (experimentId: string) => Promise<boolean>;
  goToNextStage: () => void;
  goToPreviousStage: () => boolean;
  resetTimer: () => void;
  currentStage: Stage | null;
  isStageTransitioning: boolean;
  saveStageResponse: (stageId: string, stageType: string, response: any) => Promise<void>;
  updateProgressData: () => Promise<void>;
  completeExperiment: () => Promise<void>;
  isLoading: boolean;
  loadError: string | null;
}

const ParticipantPerformContext = createContext<ParticipantPerformContextType | undefined>(undefined);

export function ParticipantPerformProvider({ children }: { children: React.ReactNode }) {
  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [isStageTransitioning, setIsStageTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Track ongoing operations to prevent race conditions
  const pendingOperations = useRef<AbortController[]>([]);

  // Single global loading state tracking ref
  const isCurrentlyLoading = useRef(false);
  
  // Load experiment data with minimal state changes to prevent flickering
  const loadExperiment = async (experimentId: string): Promise<boolean> => {
    // Create a unique operation ID to track this specific load request
    const operationId = `load-${experimentId}-${Date.now()}`;
    
    // If we're already loading, don't start another load
    if (isCurrentlyLoading.current) {
      console.log(`[${operationId}] Experiment already loading, ignoring request`);
      return false;
    }
    
    console.log(`[${operationId}] Starting experiment data load for ID: ${experimentId}`);
    
    // Set loading indicator after a significant delay to avoid flickering on fast loads
    // This prevents showing loading state for quick operations
    let loadingTimerId: ReturnType<typeof setTimeout> | null = null;
    
    try {
      // Mark that we're loading
      isCurrentlyLoading.current = true;
      
      if (isMounted.current) {
        setLoadError(null);
        
        // Set a delayed loading state - only show loading UI if fetch takes longer than 500ms
        loadingTimerId = setTimeout(() => {
          if (isMounted.current && isCurrentlyLoading.current) {
            setIsLoading(true);
          }
        }, 500);
      }
      
      // First, abort any pending operations to prevent race conditions
      pendingOperations.current.forEach(controller => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      });
      
      // Clear completed operations
      pendingOperations.current = pendingOperations.current.filter(
        controller => !controller.signal.aborted
      );
      
      // Set up abort controller for this operation
      const controller = new AbortController();
      pendingOperations.current.push(controller);
      
      // Set up timeout for the fetch operations
      const timeout = 30000; // 30 seconds
      const timeoutId = setTimeout(() => {
        console.log(`[${operationId}] Fetch timeout reached (${timeout}ms), aborting requests`);
        controller.abort();
      }, timeout);
      
      try {
        // Add cache-busting query param to prevent browser/CDN caching
        const cacheBuster = `_=${Date.now()}`;
        const headers = { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        };
        
        // Fetch experiment details and progress in parallel
        const [experimentResponse, progressResponse] = await Promise.all([
          fetch(`/api/experiments/${experimentId}?${cacheBuster}&preview=true`, {
            signal: controller.signal,
            headers
          }),
          fetch(`/api/participant/experiments/${experimentId}/progress?${cacheBuster}`, {
            signal: controller.signal,
            headers
          })
        ]);
        
        // Clear timeout since requests completed
        clearTimeout(timeoutId);
        
        // Remove this controller from pending operations
        pendingOperations.current = pendingOperations.current.filter(c => c !== controller);
        
        if (!experimentResponse.ok) {
          console.error(`[${operationId}] Failed to fetch experiment: ${experimentResponse.status}`);
          throw new Error(`Failed to fetch experiment details (status: ${experimentResponse.status})`);
        }
        
        if (!progressResponse.ok) {
          console.error(`[${operationId}] Failed to fetch progress: ${progressResponse.status}`);
          throw new Error(`Failed to fetch experiment progress (status: ${progressResponse.status})`);
        }
        
        // Parse JSON responses
        console.log(`[${operationId}] Parsing JSON responses`);
        const experimentData = await experimentResponse.json();
        const progressData = await progressResponse.json();
        
        console.log(`[${operationId}] Successfully loaded experiment data and progress`);
        
        // Validate experiment data
        if (!experimentData || !experimentData.stages || !Array.isArray(experimentData.stages)) {
          throw new Error('Invalid experiment data format');
        }
        
        // Sort stages by order
        const sortedStages = [...experimentData.stages].sort((a, b) => {
          const orderA = typeof a.order === 'number' ? a.order : 0;
          const orderB = typeof b.order === 'number' ? b.order : 0;
          return orderA - orderB;
        });

        // Clear the loading timer if it exists
        if (loadingTimerId) {
          clearTimeout(loadingTimerId);
          loadingTimerId = null;
        }
        
        // Only update state if component is still mounted
        if (isMounted.current) {
          console.log(`[${operationId}] Setting experiment with ${sortedStages.length} stages`);
          
          // Update multiple states at once to reduce renders
          setExperiment({ ...experimentData, stages: sortedStages });
          setProgress(progressData);
          
          // Figure out which stage to start with based on progress
          let startIndex = 0;
          if (progressData.currentStageId && sortedStages.length > 0) {
            const stageIndex = sortedStages.findIndex(stage => stage.id === progressData.currentStageId);
            if (stageIndex !== -1) {
              startIndex = stageIndex;
            }
          }
          
          // Set all states in a batch
          setCurrentStageIndex(startIndex);
          if (sortedStages.length > 0) {
            setTimeRemaining(sortedStages[startIndex].durationSeconds || 0);
          }
          
          // Update progress if it's the first time viewing
          if (progressData.status === 'not_started') {
            await updateProgress('in_progress', sortedStages[0]?.id);
          }
          
          setTimerActive(true);
          
          // Set loading to false at the very end
          setIsLoading(false);
        } 
        
        // Reset loading flag
        isCurrentlyLoading.current = false;
        
        console.log(`[${operationId}] Experiment load completed successfully`);
        return true;
      } catch (fetchError) {
        // Clear the loading timer if it exists
        if (loadingTimerId) {
          clearTimeout(loadingTimerId);
          loadingTimerId = null;
        }
        
        // Make sure timeout is cleared
        clearTimeout(timeoutId);
        
        // Remove this controller from pending operations
        pendingOperations.current = pendingOperations.current.filter(c => c !== controller);
        
        // Check if this was aborted intentionally
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.log(`[${operationId}] Request was aborted`);
          throw new Error('Request was cancelled');
        }
        
        throw fetchError;
      }
    } catch (error) {
      // Clear the loading timer if it exists
      if (loadingTimerId) {
        clearTimeout(loadingTimerId);
        loadingTimerId = null;
      }
      
      console.error(`[${operationId}] Error loading experiment:`, error);
      
      // Reset loading flag
      isCurrentlyLoading.current = false;
      
      // Only update state if component is still mounted
      if (isMounted.current) {
        // Only show toast error if this wasn't an abort
        if (!(error instanceof Error && error.message === 'Request was cancelled')) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          setLoadError(errorMessage);
          
          // Only show toast for errors that aren't cancellations
          toast.error(`Failed to load experiment data: ${errorMessage}. Please try again.`);
        }
        
        // Always set loading to false
        setIsLoading(false);
      }
      
      return false;
    }
  };

  // Update progress on the server
  const updateProgress = async (
    status: 'in_progress' | 'completed',
    currentStageId?: string,
    completedStageId?: string
  ) => {
    if (!experiment) return;

    try {
      console.log(`Updating progress: status=${status}, currentStage=${currentStageId}, completedStage=${completedStageId}`);
      
      const response = await fetch(`/api/participant/experiments/${experiment.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          currentStageId,
          completedStageId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update progress');
      }
      
      const data = await response.json();
      setProgress(data.progress);
      
      return data.progress;
    } catch (error) {
      console.error('Error updating progress:', error);
      return null;
    }
  };
  
  // Save a response for a stage
  const saveStageResponse = async (stageId: string, stageType: string, response: any) => {
    if (!experiment) return;
    
    try {
      // Mark stage as completed in progress
      console.log(`Recording response for ${stageType} stage:`, response);
      
      // Mark this stage as completed
      await updateProgress(
        'in_progress',
        null, // Don't change current stage yet
        stageId  // Mark this stage as completed
      );
    } catch (error) {
      console.error('Error saving stage response:', error);
    }
  };
  
  // Update progress data from server
  const updateProgressData = async () => {
    if (!experiment) return;
    
    try {
      const response = await fetch(`/api/participant/experiments/${experiment.id}/progress`);
      if (response.ok) {
        const progressData = await response.json();
        setProgress(progressData);
      }
    } catch (error) {
      console.error('Failed to update progress data:', error);
    }
  };
  
  // Complete the experiment
  const completeExperiment = async () => {
    if (!experiment) return;
    
    try {
      await updateProgress('completed');
      toast.success('Experiment completed!');
    } catch (error) {
      console.error('Error completing experiment:', error);
      toast.error('Failed to mark experiment as completed');
    }
  };

  // Go to next stage with smooth transition
  const goToNextStage = useCallback(() => {
    if (!experiment) return;
    
    if (currentStageIndex < experiment.stages.length - 1) {
      // Start transition
      setIsStageTransitioning(true);
      
      const currentStage = experiment.stages[currentStageIndex];
      const nextStage = experiment.stages[currentStageIndex + 1];
      
      // Record generic "done" response for instructions and break stages if completed
      if ((currentStage.type === 'instructions' || currentStage.type === 'break')) {
        saveStageResponse(currentStage.id, currentStage.type, "done");
      }
      
      // Use setTimeout to create a smooth transition
      setTimeout(() => {
        const nextIndex = currentStageIndex + 1;
        setCurrentStageIndex(nextIndex);
        setTimeRemaining(experiment.stages[nextIndex].durationSeconds || 0);
        setTimerActive(true);
        
        // Update progress to mark the next stage as current
        updateProgress('in_progress', experiment.stages[nextIndex].id);
        
        // Complete transition after a small delay to prevent flickering
        setTimeout(() => {
          setIsStageTransitioning(false);
        }, 50);
      }, 50);
    } else {
      // This is the last stage, complete the experiment
      completeExperiment();
    }
  }, [experiment, currentStageIndex]);

  // Go to previous stage (for admin only, usually disabled for participants)
  const goToPreviousStage = useCallback(() => {
    if (!experiment || currentStageIndex <= 0) return false;
    
    setIsStageTransitioning(true);
    
    setTimeout(() => {
      const prevIndex = currentStageIndex - 1;
      setCurrentStageIndex(prevIndex);
      setTimeRemaining(experiment.stages[prevIndex].durationSeconds || 0);
      setTimerActive(true);
      
      // Update progress
      updateProgress('in_progress', experiment.stages[prevIndex].id);
      
      setTimeout(() => {
        setIsStageTransitioning(false);
      }, 50);
    }, 50);
    
    return true;
  }, [experiment, currentStageIndex]);

  // Reset timer for current stage
  const resetTimer = () => {
    if (!experiment || currentStageIndex >= experiment.stages.length) return;
    
    setTimeRemaining(experiment.stages[currentStageIndex].durationSeconds || 0);
    setTimerActive(true);
  };

  // Timer countdown logic
  useEffect(() => {
    if (!timerActive || timeRemaining <= 0) return;
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setTimerActive(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timerActive, timeRemaining]);
  
  // Track component mounted state to prevent state updates after unmount
  const isMounted = useRef(true);
  
  // Cleanup function to abort all pending operations when the provider unmounts
  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    return () => {
      // Mark component as unmounted
      isMounted.current = false;
      
      console.log('ParticipantPerformProvider unmounting, aborting all pending operations');
      pendingOperations.current.forEach(controller => {
        if (!controller.signal.aborted) {
          controller.abort();
        }
      });
      pendingOperations.current = [];
    };
  }, []);

  // Get current stage reference
  const currentStage = experiment && currentStageIndex < experiment.stages.length
    ? experiment.stages[currentStageIndex]
    : null;

  return (
    <ParticipantPerformContext.Provider
      value={{
        experiment,
        progress,
        currentStageIndex,
        timeRemaining,
        loadExperiment,
        goToNextStage,
        goToPreviousStage,
        resetTimer,
        currentStage,
        isStageTransitioning,
        saveStageResponse,
        updateProgressData,
        completeExperiment,
        isLoading,
        loadError
      }}
    >
      {children}
    </ParticipantPerformContext.Provider>
  );
}

export function useParticipantPerform() {
  const context = useContext(ParticipantPerformContext);
  if (context === undefined) {
    throw new Error('useParticipantPerform must be used within a ParticipantPerformProvider');
  }
  return context;
}