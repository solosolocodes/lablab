'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

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
  loadExperiment: (experimentId: string) => Promise<void>;
  goToNextStage: () => void;
  goToPreviousStage: () => boolean;
  resetTimer: () => void;
  currentStage: Stage | null;
  progress: number;
}

const PreviewContext = createContext<PreviewContextType | undefined>(undefined);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);

  // Simplified experiment loading
  const loadExperiment = async (experimentId: string) => {
    try {
      // Add preview parameter to allow access without authentication
      const response = await fetch(`/api/experiments/${experimentId}?preview=true`);
      
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
      
      // Set the experiment data
      setExperiment({ ...data, stages: sortedStages });
      
      // Reset to first stage
      setCurrentStageIndex(0);
      
      // Set initial timer if there are stages
      if (sortedStages.length > 0) {
        setTimeRemaining(sortedStages[0].durationSeconds);
        setTimerActive(true);
      }
    } catch (err) {
      // Silently handle errors - we'll just show the default view
      console.error('Error loading experiment:', err);
    }
  };

  // Go to next stage
  const goToNextStage = useCallback(() => {
    if (!experiment) return;
    
    if (currentStageIndex < experiment.stages.length - 1) {
      const nextIndex = currentStageIndex + 1;
      setCurrentStageIndex(nextIndex);
      setTimeRemaining(experiment.stages[nextIndex].durationSeconds);
      setTimerActive(true);
    }
  }, [experiment, currentStageIndex]);

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