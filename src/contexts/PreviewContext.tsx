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

  // Load experiment and progress data
  const loadExperiment = async (experimentId: string, isParticipantView = false) => {
    try {
      // Fetch the experiment data
      const response = await fetch(`/api/experiments/${experimentId}?preview=true&t=${Date.now()}`);
      
      // Parse the data
      const data = await response.json();
      
      // Use empty array as fallback for stages
      const stages = Array.isArray(data.stages) ? data.stages : [];
      
      // Sort stages by order
      const sortedStages = [...stages].sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 0;
        const orderB = typeof b.order === 'number' ? b.order : 0;
        return orderA - orderB;
      });
      
      // Check if component is still mounted
      if (!isMountedRef.current) return;
      
      // Set the experiment data
      setExperiment({ ...data, stages: sortedStages });
      
      // For participant view, also fetch progress
      if (isParticipantView) {
        setIsRecordingProgress(true);
        try {
          const progressResponse = await fetch(
            `/api/participant/experiments/${experimentId}/progress?t=${Date.now()}`,
            { headers: { 'Cache-Control': 'no-cache' } }
          );
          
          // Check if component is still mounted
          if (!isMountedRef.current) return;
          
          if (progressResponse.ok) {
            const progressData = await progressResponse.json();
            
            // If we're starting a new experiment
            if (progressData.status === 'not_started') {
              // Update progress to in_progress (non-blocking)
              Promise.resolve().then(() => {
                if (isMountedRef.current) {
                  updateParticipantProgress(experimentId, 'in_progress', sortedStages[0]?.id);
                }
              });
              
              // Only update state if still mounted
              if (isMountedRef.current) {
                // Start with first stage
                setCurrentStageIndex(0);
                
                // Record start time for the first stage
                if (sortedStages.length > 0) {
                  const startTimes = { [sortedStages[0].id]: new Date() };
                  setStageStartTimes(startTimes);
                }
              }
            } 
            // If we're resuming an in-progress experiment
            else if (progressData.status === 'in_progress' && progressData.currentStageId) {
              // Find the current stage index
              const stageIndex = sortedStages.findIndex(
                stage => stage.id === progressData.currentStageId
              );
              
              // Only update state if still mounted
              if (isMountedRef.current && stageIndex !== -1) {
                setCurrentStageIndex(stageIndex);
                
                // Record start time for the current stage
                const currentStage = sortedStages[stageIndex];
                const startTimes = { [currentStage.id]: new Date() };
                setStageStartTimes(startTimes);
              }
            }
          }
        } catch (progressErr) {
          console.error('Error fetching progress:', progressErr);
        }
      } else {
        // Reset to first stage for preview (if still mounted)
        if (isMountedRef.current) {
          setCurrentStageIndex(0);
        }
      }
      
      // Set initial timer if there are stages (if still mounted)
      if (isMountedRef.current && sortedStages.length > 0) {
        setTimeRemaining(sortedStages[0].durationSeconds);
        setTimerActive(true);
      }
    } catch (err) {
      // Silently handle errors - we'll just show the default view
      console.error('Error loading experiment:', err);
    }
  };
  
  // Function to update progress in MongoDB with timeout and error handling
  const updateParticipantProgress = async (
    experimentId: string,
    status?: 'in_progress' | 'completed',
    currentStageId?: string,
    completedStageId?: string
  ) => {
    if (!isRecordingProgress) return;
    
    try {
      const payload: any = {};
      if (status) payload.status = status;
      if (currentStageId) payload.currentStageId = currentStageId;
      if (completedStageId) payload.completedStageId = completedStageId;
      
      // Use AbortController to add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(`/api/participant/experiments/${experimentId}/progress`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error('Failed to update progress:', await response.text());
        }
      } catch (fetchErr) {
        if (fetchErr.name === 'AbortError') {
          console.warn('Progress update timed out - will continue without waiting for server');
        } else {
          throw fetchErr;
        }
      }
    } catch (err) {
      // Log error but don't block the user experience
      console.error('Error updating progress:', err);
    }
  };

  // Go to next stage with smooth transition and record progress (non-blocking)
  const goToNextStage = useCallback(() => {
    if (!experiment || !isMountedRef.current) return;
    
    const currentStage = experiment.stages[currentStageIndex];
    
    // Record stage completion time and duration (non-blocking)
    if (isRecordingProgress && currentStage) {
      const stageStartTime = stageStartTimes[currentStage.id] || new Date();
      const stageDuration = new Date().getTime() - stageStartTime.getTime();
      
      console.log(`Stage ${currentStage.id} completed. Duration: ${Math.round(stageDuration / 1000)}s`);
      
      // Mark the current stage as completed in MongoDB (don't await - non-blocking)
      Promise.resolve().then(() => {
        if (isMountedRef.current) {
          updateParticipantProgress(experiment.id, undefined, undefined, currentStage.id);
        }
      });
    }
    
    if (currentStageIndex < experiment.stages.length - 1) {
      // Start transition
      setIsStageTransitioning(true);
      
      // Use setTimeout to create a smooth transition effect
      setTimeout(() => {
        // Check if still mounted before state updates
        if (!isMountedRef.current) return;
        
        const nextIndex = currentStageIndex + 1;
        const nextStage = experiment.stages[nextIndex];
        
        // Record start time for the next stage
        if (isRecordingProgress && nextStage) {
          setStageStartTimes(prev => ({
            ...prev,
            [nextStage.id]: new Date()
          }));
          
          // Update current stage in MongoDB (don't await - non-blocking)
          Promise.resolve().then(() => {
            if (isMountedRef.current) {
              updateParticipantProgress(experiment.id, 'in_progress', nextStage.id);
            }
          });
        }
        
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
    } else if (isRecordingProgress) {
      // This was the last stage, complete the experiment (non-blocking)
      Promise.resolve().then(() => {
        if (isMountedRef.current) {
          updateParticipantProgress(experiment.id, 'completed');
        }
      });
    }
  }, [experiment, currentStageIndex, isRecordingProgress, stageStartTimes]);

  // Go to previous stage with smooth transition, returns true if successful
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