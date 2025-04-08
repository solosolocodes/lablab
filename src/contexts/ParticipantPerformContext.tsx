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

  // Load experiment data with proper error handling and timeout
  const loadExperiment = async (experimentId: string): Promise<boolean> => {
    // Create a unique operation ID to track this specific load request
    const operationId = `load-${experimentId}-${Date.now()}`;
    console.log(`[${operationId}] Starting experiment data load for ID: ${experimentId}`);
    
    try {
      setIsLoading(true);
      setLoadError(null);
      
      // First, abort any pending operations to prevent race conditions
      pendingOperations.current.forEach(controller => {
        if (!controller.signal.aborted) {
          console.log('Aborting previous pending operation');
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
      const timeout = 15000; // 15 seconds
      const timeoutId = setTimeout(() => {
        console.log(`[${operationId}] Fetch timeout reached (${timeout}ms), aborting requests`);
        controller.abort();
      }, timeout);
      
      try {
        // Fetch experiment details and progress in parallel with unique request IDs
        console.log(`[${operationId}] Starting parallel fetch for experiment data and progress`);
        
        // Add cache-busting query param to prevent browser/CDN caching
        const cacheBuster = `_=${Date.now()}`;
        
        const [experimentResponse, progressResponse] = await Promise.all([
          fetch(`/api/experiments/${experimentId}?${cacheBuster}&preview=true`, {
            signal: controller.signal,
            headers: { 
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }),
          fetch(`/api/participant/experiments/${experimentId}/progress?${cacheBuster}`, {
            signal: controller.signal,
            headers: { 
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
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

        console.log(`[${operationId}] Setting experiment with ${sortedStages.length} stages`);
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
        
        console.log(`[${operationId}] Setting current stage index to ${startIndex}`);
        setCurrentStageIndex(startIndex);
        if (sortedStages.length > 0) {
          setTimeRemaining(sortedStages[startIndex].durationSeconds || 0);
        }
        
        // Update progress if it's the first time viewing
        if (progressData.status === 'not_started') {
          await updateProgress('in_progress', sortedStages[0]?.id);
        }
        
        setTimerActive(true);
        setIsLoading(false);
        
        console.log(`[${operationId}] Experiment load completed successfully`);
        // Return to indicate success
        return true;
      } catch (fetchError) {
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
      console.error(`[${operationId}] Error loading experiment:`, error);
      
      // Only show toast error if this wasn't an abort
      if (!(error instanceof Error && error.message === 'Request was cancelled')) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        toast.error(`Failed to load experiment data: ${errorMessage}. Please try again or contact support.`);
        setLoadError(errorMessage);
      }
      
      setIsLoading(false);
      // Return false to indicate failure
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
  
  // Cleanup function to abort all pending operations when the provider unmounts
  useEffect(() => {
    return () => {
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