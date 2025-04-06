'use client';

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@reactflow/core';

export type NodeData = {
  label: string;
  description?: string;
  type: 'instructions' | 'scenario' | 'survey' | 'break';
  stageData?: Record<string, unknown>;
};

// Base Node layout and styling for all stage types
const BaseStageNode = ({ 
  data, 
  selected, 
  children 
}: { 
  data: NodeData; 
  selected: boolean; 
  children: React.ReactNode; 
}) => {
  const getBgColor = () => {
    switch(data.type) {
      case 'instructions': return 'bg-purple-50';
      case 'scenario': return 'bg-blue-50';
      case 'survey': return 'bg-green-50';
      case 'break': return 'bg-amber-50';
      default: return 'bg-gray-50';
    }
  };

  const getBorderColor = () => {
    if (selected) return 'border-2 border-purple-500';
    
    switch(data.type) {
      case 'instructions': return 'border border-purple-200';
      case 'scenario': return 'border border-blue-200';
      case 'survey': return 'border border-green-200';
      case 'break': return 'border border-amber-200';
      default: return 'border border-gray-200';
    }
  };

  return (
    <div className={`p-3 rounded-lg shadow-sm min-w-[180px] max-w-[250px] ${getBgColor()} ${getBorderColor()}`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="mb-2">
        <div className="font-medium text-gray-800">{data.label || 'Stage'}</div>
        {data.description && (
          <div className="text-xs text-gray-500">{data.description}</div>
        )}
      </div>
      {children}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

// Instructions Stage Node
const InstructionsNodeComponent = ({ data, selected }: NodeProps<NodeData>) => {
  return (
    <BaseStageNode data={data} selected={selected}>
      <div className="flex items-center text-xs text-purple-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Instructions</span>
      </div>
    </BaseStageNode>
  );
};
InstructionsNodeComponent.displayName = 'InstructionsNode';
export const InstructionsNode = memo(InstructionsNodeComponent);

// Scenario Stage Node
const ScenarioNodeComponent = ({ data, selected }: NodeProps<NodeData>) => {
  return (
    <BaseStageNode data={data} selected={selected}>
      <div className="flex items-center text-xs text-blue-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
        <span>Scenario</span>
        {data.stageData?.scenarioId && <span className="ml-1 text-gray-500">#{typeof data.stageData.scenarioId === 'string' ? data.stageData.scenarioId.substring(0, 4) : String(data.stageData.scenarioId).substring(0, 4)}</span>}
      </div>
    </BaseStageNode>
  );
};
ScenarioNodeComponent.displayName = 'ScenarioNode';
export const ScenarioNode = memo(ScenarioNodeComponent);

// Survey Stage Node
const SurveyNodeComponent = ({ data, selected }: NodeProps<NodeData>) => {
  const questionCount = Array.isArray(data.stageData?.questions) ? data.stageData.questions.length : 0;
  
  return (
    <BaseStageNode data={data} selected={selected}>
      <div className="flex items-center text-xs text-green-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <span>Survey</span>
        {questionCount > 0 && <span className="ml-1 text-gray-500">({questionCount} questions)</span>}
      </div>
    </BaseStageNode>
  );
};
SurveyNodeComponent.displayName = 'SurveyNode';
export const SurveyNode = memo(SurveyNodeComponent);

// Break Stage Node
const BreakNodeComponent = ({ data, selected }: NodeProps<NodeData>) => {
  const duration = typeof data.stageData?.durationSeconds === 'number' ? data.stageData.durationSeconds : 0;
  
  return (
    <BaseStageNode data={data} selected={selected}>
      <div className="flex items-center text-xs text-amber-600">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Break</span>
        {duration > 0 && (
          <span className="ml-1 text-gray-500">
            {duration < 60 ? `${duration}s` : `${Math.floor(duration / 60)}m`}
          </span>
        )}
      </div>
    </BaseStageNode>
  );
};
BreakNodeComponent.displayName = 'BreakNode';
export const BreakNode = memo(BreakNodeComponent);