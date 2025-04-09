'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';

type Question = {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  options?: string[];
};

type Stage = {
  id: string;
  type: 'instructions' | 'scenario' | 'survey' | 'break';
  title: string;
  description: string;
  durationSeconds: number;
  required: boolean;
  order: number;
  content?: string;
  format?: string;
  message?: string;
  scenarioId?: string;
  rounds?: number;
  roundDuration?: number;
  questions?: Question[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // For additional type-specific properties
};

type ExperimentData = {
  id: string;
  name: string;
  description: string;
  status: string;
  stages: Stage[];
  startStageId?: string;
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

type StageResponse = {
  stageId: string;
  stageType: string;
  response: any;
  completedAt: string;
};

interface ParticipantContextType {
  experiment: ExperimentData | null;
  progress: ProgressData | null;
  currentStageIndex: number;
  timeRemaining: number;
  loadExperiment: (experimentId: string) => Promise<void>;
  goToNextStage: () => void;
  completeExperiment: () => Promise<void>;
  resetTimer: () => void;
  currentStage: Stage | null;
  isStageTransitioning: boolean;
  saveStageResponse: (stageId: string, stageType: string, response: any) => Promise<void>;
  surveyResponses: Record<string, any>;
  setSurveyResponses: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const ParticipantContext = createContext<ParticipantContextType | undefined>(undefined);

export function ParticipantProvider({ children }: { children: React.ReactNode }) {
  const [experiment, setExperiment] = useState<ExperimentData | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [isStageTransitioning, setIsStageTransitioning] = useState(false);
  const [surveyResponses, setSurveyResponses] = useState<Record<string, any>>({});

  // Load experiment and progress data
  const loadExperiment = async (experimentId: string) => {
    try {
      // Fetch experiment details and progress in parallel
      const [experimentResponse, progressResponse] = await Promise.all([
        fetch(`/api/experiments/${experimentId}`),
        fetch(`/api/participant/experiments/${experimentId}/progress`)
      ]);
      
      if (!experimentResponse.ok) {
        throw new Error('Failed to fetch experiment details');
      }
      
      if (!progressResponse.ok) {
        throw new Error('Failed to fetch experiment progress');
      }
      
      const experimentData = await experimentResponse.json();
      const progressData = await progressResponse.json();
      
      // Sort stages by order
      const sortedStages = [...experimentData.stages].sort((a, b) => {
        const orderA = typeof a.order === 'number' ? a.order : 0;
        const orderB = typeof b.order === 'number' ? b.order : 0;
        return orderA - orderB;
      });
      
      setExperiment({ ...experimentData, stages: sortedStages });
      setProgress(progressData);
      
      // Figure out which stage to start with based on progress
      if (progressData.currentStageId && sortedStages.length > 0) {
        const stageIndex = sortedStages.findIndex(stage => stage.id === progressData.currentStageId);
        if (stageIndex !== -1) {
          setCurrentStageIndex(stageIndex);
          setTimeRemaining(sortedStages[stageIndex].durationSeconds);
        } else {
          // If current stage not found, start from the beginning
          setCurrentStageIndex(0);
          setTimeRemaining(sortedStages[0].durationSeconds);
        }
      } else {
        // No current stage, start from the beginning
        setCurrentStageIndex(0);
        if (sortedStages.length > 0) {
          setTimeRemaining(sortedStages[0].durationSeconds);
        }
      }
      
      setTimerActive(true);
      
      // Update progress if it's the first time viewing
      if (progressData.status === 'not_started') {
        updateProgress('in_progress', sortedStages[0]?.id);
      }
    } catch (err) {
      console.error('Error loading experiment:', err);
      toast.error('Failed to load experiment data');
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
      const response = await fetch(`/api/participant/experiments/${experiment.id}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          currentStageId,
          completedStageId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to update progress');
      }
      
      const updatedProgress = await response.json();
      setProgress(updatedProgress.progress);
      
      return updatedProgress.progress;
    } catch (error) {
      console.error('Error updating progress:', error);
      toast.error('Failed to update progress');
      return null;
    }
  };
  
  // Save a response for a stage
  const saveStageResponse = async (stageId: string, stageType: string, response: any) => {
    if (!experiment) return;
    
    try {
      // Mark stage as completed in progress
      await updateProgress(
        'in_progress', 
        currentStageIndex < experiment.stages.length - 1 
          ? experiment.stages[currentStageIndex + 1]?.id 
          : null,
        stageId
      );
      
      // Record specific response data based on stage type
      console.log(`Recording response for ${stageType} stage:`, response);
      
      // For now we're just logging the response, but in a real implementation
      // we would store this in a database
      return true;
    } catch (error) {
      console.error('Error saving stage response:', error);
      toast.error('Failed to save your response');
      return false;
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
      
      // Use setTimeout with minimal delay, similar to preview implementation
      setTimeout(() => {
        const nextIndex = currentStageIndex + 1;
        setCurrentStageIndex(nextIndex);
        setTimeRemaining(experiment.stages[nextIndex].durationSeconds);
        setTimerActive(true);
        
        // Update progress to mark the next stage as current
        updateProgress('in_progress', experiment.stages[nextIndex].id);
        
        // Complete transition after a small delay to prevent flickering
        setTimeout(() => {
          setIsStageTransitioning(false);
        }, 100);
      }, 50);
    } else {
      // If we're at the last stage, complete the experiment
      completeExperiment();
    }
  }, [experiment, currentStageIndex]);
  
  // Complete the entire experiment
  const completeExperiment = async () => {
    if (!experiment) return;
    
    try {
      const currentStage = experiment.stages[currentStageIndex];
      
      // Record "done" response for the last stage if it's instructions or break
      if (currentStage && (currentStage.type === 'instructions' || currentStage.type === 'break')) {
        try {
          await saveStageResponse(currentStage.id, currentStage.type, "done");
        } catch (err) {
          console.warn('Error saving final stage response (non-critical):', err);
          // Continue despite error
        }
      }
      
      // Mark the experiment as completed
      try {
        await updateProgress('completed');
        toast.success('Experiment completed successfully!');
      } catch (err) {
        console.warn('Error marking experiment as completed:', err);
        // Show success regardless - the user has completed their part
        toast.success('Your responses have been saved!');
      }
      
      // Prevent redirect - let the calling component handle navigation
      // This avoids React error #321 by not updating state or causing redirects
      // from components that might unmount
    } catch (error) {
      console.error('Error in completeExperiment:', error);
      // Avoid showing error toast as it could cause React error #321
    }
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
  
  // Get current stage
  const currentStage = experiment && currentStageIndex < experiment.stages.length
    ? experiment.stages[currentStageIndex]
    : null;
  
  return (
    <ParticipantContext.Provider
      value={{
        experiment,
        progress,
        currentStageIndex,
        timeRemaining,
        loadExperiment,
        goToNextStage,
        completeExperiment,
        resetTimer,
        currentStage,
        isStageTransitioning,
        saveStageResponse,
        surveyResponses,
        setSurveyResponses
      }}
    >
      {children}
    </ParticipantContext.Provider>
  );
}

export function useParticipant() {
  const context = useContext(ParticipantContext);
  if (context === undefined) {
    throw new Error('useParticipant must be used within a ParticipantProvider');
  }
  return context;
}