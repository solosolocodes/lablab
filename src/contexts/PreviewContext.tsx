'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type Stage = {
  id: string;
  type: 'instructions' | 'scenario' | 'survey' | 'break';
  title: string;
  description: string;
  durationSeconds: number;
  required: boolean;
  order: number;
  [key: string]: any; // For additional type-specific properties
};

type ExperimentData = {
  id: string;
  name: string;
  description: string;
  stages: Stage[];
  [key: string]: any; // For any additional properties
};

interface PreviewContextType {
  experiment: ExperimentData | null;
  currentStageIndex: number;
  timeRemaining: number;
  loadExperiment: (experimentId: string) => Promise<void>;
  goToNextStage: () => void;
  goToPreviousStage: () => boolean;
  resetTimer: () => void;
  isLoading: boolean;
  error: string | null;
  currentStage: Stage | null;
  progress: number;
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timerActive, setTimerActive] = useState(false);

  // Fetch experiment data
  const loadExperiment = async (experimentId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/experiments/${experimentId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load experiment: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Sort stages by order
      const sortedStages = [...data.stages].sort((a, b) => a.order - b.order);
      setExperiment({ ...data, stages: sortedStages });
      
      // Reset to first stage
      setCurrentStageIndex(0);
      
      // Set initial timer
      if (sortedStages.length > 0) {
        setTimeRemaining(sortedStages[0].durationSeconds);
        setTimerActive(true);
      }
      
    } catch (err) {
      console.error('Error loading experiment:', err);
      setError(err instanceof Error ? err.message : 'Failed to load experiment');
    } finally {
      setIsLoading(false);
    }
  };

  // Go to next stage
  const goToNextStage = () => {
    if (!experiment) return;
    
    if (currentStageIndex < experiment.stages.length - 1) {
      const nextIndex = currentStageIndex + 1;
      setCurrentStageIndex(nextIndex);
      setTimeRemaining(experiment.stages[nextIndex].durationSeconds);
      setTimerActive(true);
    }
  };

  // Go to previous stage, returns true if successful
  const goToPreviousStage = () => {
    if (!experiment || currentStageIndex <= 0) return false;
    
    const prevIndex = currentStageIndex - 1;
    setCurrentStageIndex(prevIndex);
    setTimeRemaining(experiment.stages[prevIndex].durationSeconds);
    setTimerActive(true);
    return true;
  };

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
  }, [timeRemaining, experiment, currentStageIndex]);

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
        isLoading,
        error,
        currentStage,
        progress
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