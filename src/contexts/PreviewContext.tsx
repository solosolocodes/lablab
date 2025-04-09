'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

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

interface PreviewContextType {
  experiment: ExperimentData | null;
  currentStageIndex: number;
  timeRemaining: number;
  loadExperiment: (experimentId: string, isParticipantView?: boolean) => Promise<void>;
  goToNextStage: () => void;
  goToPreviousStage: () => boolean;
  resetTimer: () => void;
  currentStage: Stage | null;
  progress: number;
  isStageTransitioning: boolean;
  isRecordingProgress: boolean;
  stageStartTimes: Record<string, Date>;
  updateParticipantProgress: (experimentId: string, status?: 'in_progress' | 'completed', currentStageId?: string, completedStageId?: string) => Promise<void>;
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [isStageTransitioning, setIsStageTransitioning] = useState(false);
  const [isRecordingProgress, setIsRecordingProgress] = useState(false);
  const [stageStartTimes, setStageStartTimes] = useState<Record<string, Date>>({});
  
  // Create a ref to track mounted state
  const isMountedRef = useRef(true);
  
  // Set up mounted state and cleanup
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Simple experiment loading without caching
  const loadExperiment = async (experimentId: string, isParticipantView = false) => {
    try {
      console.log(`Loading experiment ${experimentId}${isParticipantView ? ' (participant view)' : ''}`);
      
      // Add a simple cache buster to prevent caching issues
      const cacheBuster = Date.now();
      const response = await fetch(`/api/experiments/${experimentId}?preview=true&t=${cacheBuster}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch experiment: ${response.status}`);
      }
      
      const experimentData = await response.json();
      
      // Use empty array as fallback for stages
      const stages = Array.isArray(experimentData.stages) ? experimentData.stages : [];
      
      // Sort stages by order
      const sortedStages = [...stages].sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 0;
        const orderB = typeof b.order === 'number' ? b.order : 0;
        return orderA - orderB;
      });
      
      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
      // Set the experiment data
      setExperiment({ ...experimentData, stages: sortedStages } as ExperimentData);
      
      // Always reset to first stage (participant or not) - simplified approach
      if (isMountedRef.current) {
        setCurrentStageIndex(0);
      }
      
      // Set initial timer if there are stages (if still mounted)
      if (isMountedRef.current && sortedStages.length > 0) {
        const firstStage = sortedStages[0];
        const durationSeconds = typeof firstStage.durationSeconds === 'number' ? firstStage.durationSeconds : 0;
        setTimeRemaining(durationSeconds);
        setTimerActive(durationSeconds > 0);
      }
    } catch (err) {
      console.error('Error loading experiment:', err);
      throw err;
    }
  };
  
  // Minimal status tracking function - only records experiment start and completion
  const updateParticipantProgress = async (
    experimentId: string,
    status?: 'in_progress' | 'completed',
    currentStageId?: string,
    completedStageId?: string
  ) => {
    // Only track experiment start and completion, not individual stages
    if (!status) return;
    
    try {
      console.log(`Recording experiment status: ${status}`);
      
      // Add timeout and abort controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      
      const response = await fetch(`/api/participant/experiments/${experimentId}/progress`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({ status }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.warn(`Failed to update experiment status: ${response.status}`);
      }
    } catch (err) {
      console.warn('Error recording experiment status (non-critical):', err);
    }
  };

  // Go to next stage with smooth transition - simplified like admin preview
  const goToNextStage = useCallback(() => {
    if (!experiment || !isMountedRef.current) return;
    
    if (currentStageIndex < experiment.stages.length - 1) {
      // Start transition
      setIsStageTransitioning(true);
      
      // Use setTimeout to create a smooth transition effect
      setTimeout(() => {
        // Check if still mounted before state updates
        if (!isMountedRef.current) return;
        
        const nextIndex = currentStageIndex + 1;
        const nextStage = experiment.stages[nextIndex];
        
        setCurrentStageIndex(nextIndex);
        setTimeRemaining(nextStage.durationSeconds);
        setTimerActive(true);
        
        // Complete transition after a small delay to prevent flickering
        setTimeout(() => {
          if (isMountedRef.current) {
            setIsStageTransitioning(false);
          }
        }, 100);
      }, 50);
    }
    // No "else" condition needed - simplified to match admin preview
  }, [experiment, currentStageIndex]);

  // Go to previous stage with smooth transition, returns true if successful - simplified
  const goToPreviousStage = useCallback(() => {
    if (!experiment || currentStageIndex <= 0) return false;
    
    // Start transition
    setIsStageTransitioning(true);
    
    // Use setTimeout to create a smooth transition effect
    setTimeout(() => {
      const prevIndex = currentStageIndex - 1;
      setCurrentStageIndex(prevIndex);
      setTimeRemaining(experiment.stages[prevIndex].durationSeconds);
      setTimerActive(true);
      
      // Complete transition after a small delay to prevent flickering
      setTimeout(() => {
        setIsStageTransitioning(false);
      }, 100);
    }, 50);
    
    return true;
  }, [experiment, currentStageIndex]);

  // Reset timer for current stage
  const resetTimer = () => {
    if (!experiment || currentStageIndex >= experiment.stages.length) return;
    
    setTimeRemaining(experiment.stages[currentStageIndex].durationSeconds);
    setTimerActive(true);
  };

  // Timer countdown
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

  // Auto-advance logic for instructions when time expires
  useEffect(() => {
    if (timeRemaining !== 0 || !experiment) return;
    
    const currentStage = experiment.stages[currentStageIndex];
    
    if (currentStage?.type === 'instructions') {
      // After 5 seconds of showing the Next button, auto-advance
      const timeout = setTimeout(() => {
        goToNextStage();
      }, 5000);
      
      return () => clearTimeout(timeout);
    }
  }, [timeRemaining, experiment, currentStageIndex, goToNextStage]);

  // Calculate current progress percentage
  const progress = experiment && experiment.stages.length > 0
    ? Math.round(((currentStageIndex + 1) / experiment.stages.length) * 100)
    : 0;

  // Get current stage
  const currentStage = experiment && currentStageIndex < experiment.stages.length
    ? experiment.stages[currentStageIndex]
    : null;

  return (
    <PreviewContext.Provider
      value={{
        experiment,
        currentStageIndex,
        timeRemaining,
        loadExperiment,
        goToNextStage,
        goToPreviousStage,
        resetTimer,
        currentStage,
        progress,
        isStageTransitioning,
        isRecordingProgress,
        stageStartTimes,
        updateParticipantProgress
      }}
    >
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  const context = useContext(PreviewContext);
  if (context === undefined) {
    throw new Error('usePreview must be used within a PreviewProvider');
  }
  return context;
}