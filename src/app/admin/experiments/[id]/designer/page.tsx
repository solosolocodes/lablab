'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { 
  Node, 
  Edge,
  useNodesState,
  useEdgesState
} from '@reactflow/core';
import '@reactflow/core/dist/style.css';
import { 
  NodeData 
} from '@/components/experiment/StageNodes';
import { StageProperties } from '@/components/experiment/StageProperties';

export default function ExperimentDesignerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const experimentId = params.id as string;
  
  const [isLoading, setIsLoading] = useState(true);
  const [scenarios, setScenarios] = useState<Array<{ id: string; name: string }>>([]);
  const [userGroups, setUserGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [experiment, setExperiment] = useState<{
    id: string;
    name: string;
    description: string;
    status: string;
    stages: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      durationSeconds: number;
      required: boolean;
      order: number;
      [key: string]: string | number | boolean | Array<unknown> | Record<string, unknown>; // For type-specific properties
    }>;
    userGroups: Array<{
      userGroupId: string;
      condition: string;
      maxParticipants?: number;
    }>;
    branches: Array<{
      id: string;
      fromStageId: string;
      defaultTargetStageId: string;
      conditions: Array<{
        type: string;
        targetStageId: string;
        sourceStageId?: string;
        [key: string]: string | number | boolean | undefined;
      }>;
    }>;
    startStageId?: string;
    createdAt: string;
    updatedAt: string;
    lastEditedAt: string;
  } | null>(null);
  
  // ReactFlow state
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [showOverview, setShowOverview] = useState(false);
  
  // ReactFlow reference for fitting view
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
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
  
  // Convert experiment stages to nodes and edges for ReactFlow
  useEffect(() => {
    if (!experiment || !experiment.stages) return;
    
    // Create nodes from stages
    const flowNodes: Node<NodeData>[] = experiment.stages.map((stage, index) => ({
      id: stage.id,
      type: stage.type as 'instructions' | 'scenario' | 'survey' | 'break',
      position: { x: 250, y: index * 150 }, // Initial positions
      data: {
        label: stage.title,
        description: stage.description,
        type: stage.type as 'instructions' | 'scenario' | 'survey' | 'break',
        stageData: {...stage}
      }
    }));
    
    // Create edges from branches
    const flowEdges: Edge[] = [];
    
    // Default connections (stage to next stage)
    for (let i = 0; i < flowNodes.length - 1; i++) {
      flowEdges.push({
        id: `e-${flowNodes[i].id}-${flowNodes[i+1].id}`,
        source: flowNodes[i].id,
        target: flowNodes[i+1].id,
        type: 'default'
      });
    }
    
    // Add custom branch connections
    if (experiment.branches) {
      experiment.branches.forEach(branch => {
        // Remove default connection if it exists
        const defaultEdgeIndex = flowEdges.findIndex(
          e => e.source === branch.fromStageId && e.target === branch.defaultTargetStageId
        );
        
        if (defaultEdgeIndex !== -1) {
          flowEdges.splice(defaultEdgeIndex, 1);
        }
        
        // Add custom branch edge
        flowEdges.push({
          id: `e-branch-${branch.id}`,
          source: branch.fromStageId,
          target: branch.defaultTargetStageId,
          type: 'default',
          animated: true
        });
      });
    }
    
    setNodes(flowNodes);
    setEdges(flowEdges);
  }, [experiment, setNodes, setEdges]);
  
  // Handle node updates from properties panel
  const onUpdateNode = useCallback((nodeId: string, data: NodeData) => {
    setNodes(nds => 
      nds.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data
          };
        }
        return node;
      })
    );
  }, [setNodes]);
  
  // Add new stage node
  const addStageNode = useCallback((type: 'instructions' | 'scenario' | 'survey' | 'break') => {
    const newNodeId = `stage-${Date.now()}`;
    const typeLabels: Record<string, string> = {
      instructions: 'Instructions',
      scenario: 'Scenario',
      survey: 'Survey',
      break: 'Break'
    };
    
    const newNode: Node<NodeData> = {
      id: newNodeId,
      type,
      position: { 
        x: Math.random() * 300 + 100, 
        y: Math.random() * 300 + 100 
      },
      data: {
        label: `New ${typeLabels[type]}`,
        description: `Description for ${typeLabels[type]}`,
        type,
        stageData: {
          durationSeconds: 30,
          required: true
        }
      }
    };
    
    setNodes(nds => [...nds, newNode]);
    
    // If there are no nodes yet, select the new node
    if (nodes.length === 0) {
      setSelectedNode(newNode);
    }
  }, [nodes, setNodes]);

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
                <Link href="#" className="px-3 py-2 rounded hover:bg-purple-600">Reporting</Link>
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
        
        {/* Experiment Designer Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Add Buttons */}
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-3 mb-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg text-gray-800">Add New Components</h3>
              <div className="flex space-x-3">
                <button 
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md"
                  onClick={() => addStageNode('instructions')}
                >
                  Add Instructions
                </button>
                <button 
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
                  onClick={() => addStageNode('scenario')}
                >
                  Add Scenario
                </button>
                <button 
                  className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md"
                  onClick={() => addStageNode('survey')}
                >
                  Add Survey
                </button>
                <button 
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-md"
                  onClick={() => addStageNode('break')}
                >
                  Add Break
                </button>
              </div>
            </div>
          </div>
          
          {/* Center: Design Canvas */}
          <div className="bg-white rounded-lg shadow p-4 lg:col-span-2" ref={reactFlowWrapper}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-gray-800">Experiment Flow</h3>
              <div className="space-x-2">
                <button 
                  onClick={() => setNodes(nodes => {
                    // Simple undo implementation - just for demo purposes
                    const lastNode = nodes[nodes.length - 1];
                    if (lastNode && lastNode.id === selectedNode?.id) {
                      setSelectedNode(null);
                    }
                    return nodes.slice(0, -1);
                  })}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md"
                  disabled={nodes.length === 0}
                >
                  Undo
                </button>
                <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md">
                  Redo
                </button>
              </div>
            </div>
            
            {/* Experiment Flow Canvas */}
            <div className="border border-gray-300 bg-gray-50 rounded-lg min-h-[500px] flex flex-col">
              <div className="p-3 bg-white border-b border-gray-200 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700">
                  Experiment Flow Overview: {nodes.length} stages
                </div>
                <div className="flex space-x-3">
                  <button 
                    className="px-3 py-1 bg-purple-100 hover:bg-purple-200 text-purple-700 text-xs rounded-md"
                    onClick={() => {
                      toast.success("Current flow saved!");
                    }}
                  >
                    Save Flow
                  </button>
                  <button 
                    className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs rounded-md"
                    onClick={() => {
                      toast.success("Flow preview mode activated");
                    }}
                  >
                    Preview
                  </button>
                </div>
              </div>
              
              <div className="p-4 overflow-y-auto flex-grow">
                {nodes.length > 0 ? (
                  <div className="space-y-3">
                    
                    {/* Stages List - Vertically arranged */}
                    {nodes.map((node, index) => (
                      <div 
                        key={node.id} 
                        className={`p-3 rounded-lg border ${
                          node.data.type === 'instructions' ? 'border-purple-200 bg-purple-50' :
                          node.data.type === 'scenario' ? 'border-blue-200 bg-blue-50' :
                          node.data.type === 'survey' ? 'border-green-200 bg-green-50' :
                          'border-amber-200 bg-amber-50'
                        } ${selectedNode?.id === node.id ? 'ring-2 ring-purple-500' : ''}`}
                        onClick={() => setSelectedNode(node as Node<NodeData>)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="font-medium flex items-center">
                            <span className="mr-2">{index + 1}.</span> 
                            <span>{node.data.label}</span>
                            
                            {/* Order adjustment buttons */}
                            <div className="flex space-x-1 ml-2">
                              {index > 0 && (
                                <button 
                                  className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Move node up in order
                                    const newNodes = [...nodes];
                                    const temp = newNodes[index];
                                    newNodes[index] = newNodes[index - 1];
                                    newNodes[index - 1] = temp;
                                    
                                    // Update the order property for persistence
                                    newNodes.forEach((node, idx) => {
                                      if (node.data.stageData) {
                                        node.data.stageData.order = idx;
                                      }
                                    });
                                    
                                    setNodes(newNodes);
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                  </svg>
                                </button>
                              )}
                              
                              {index < nodes.length - 1 && (
                                <button 
                                  className="p-1 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Move node down in order
                                    const newNodes = [...nodes];
                                    const temp = newNodes[index];
                                    newNodes[index] = newNodes[index + 1];
                                    newNodes[index + 1] = temp;
                                    
                                    // Update the order property for persistence
                                    newNodes.forEach((node, idx) => {
                                      if (node.data.stageData) {
                                        node.data.stageData.order = idx;
                                      }
                                    });
                                    
                                    setNodes(newNodes);
                                  }}
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            node.data.type === 'instructions' ? 'bg-purple-100 text-purple-700' :
                            node.data.type === 'scenario' ? 'bg-blue-100 text-blue-700' :
                            node.data.type === 'survey' ? 'bg-green-100 text-green-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {node.data.type}
                            {node.data.type === 'scenario' && node.data.stageData?.rounds && (
                              <span className="ml-1">
                                ({node.data.stageData.rounds} rounds)
                              </span>
                            )}
                          </span>
                        </div>
                        
                        <p className="text-sm text-gray-500 mt-1">{node.data.description || 'No description'}</p>
                        
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-500">
                            Duration: {node.data.stageData?.durationSeconds || 0} seconds
                          </span>
                          <div className="flex space-x-2">
                            <button 
                              className="text-xs text-purple-600 hover:text-purple-800 px-2 py-1 bg-purple-50 rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNode(node as Node<NodeData>);
                              }}
                            >
                              Edit
                            </button>
                            <button 
                              className="text-xs text-red-600 hover:text-red-800 px-2 py-1 bg-red-50 rounded"
                              onClick={(e) => {
                                e.stopPropagation();
                                
                                // Remove from nodes list
                                const updatedNodes = nodes.filter(n => n.id !== node.id);
                                
                                // Re-number the order property
                                updatedNodes.forEach((node, idx) => {
                                  if (node.data.stageData) {
                                    node.data.stageData.order = idx;
                                  }
                                });
                                
                                setNodes(updatedNodes);
                                
                                // If deleting selected node, clear selection
                                if (selectedNode?.id === node.id) {
                                  setSelectedNode(null);
                                }
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
                  <div className="flex flex-col items-center justify-center min-h-[500px]">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    <p className="text-gray-500 font-medium mb-1">Start Building Your Experiment</p>
                    <p className="text-gray-400 text-sm text-center mb-4">Add components to build your experiment flow</p>
                    <div className="flex space-x-3">
                      <button 
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-md"
                        onClick={() => addStageNode('instructions')}
                      >
                        Add Instructions
                      </button>
                      <button 
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"
                        onClick={() => addStageNode('scenario')}
                      >
                        Add Scenario
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Flow Canvas Controls */}
              <div className="flex justify-between mt-3">
                <div>
                  <span className="text-sm text-gray-500">
                    {nodes.length} stages in experiment
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Sidebar: Properties & Settings */}
          <div className="bg-white rounded-lg shadow lg:col-span-1">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-lg text-gray-800">
                {selectedNode ? `${selectedNode.data.type.charAt(0).toUpperCase() + selectedNode.data.type.slice(1)} Properties` : 'Properties'}
              </h3>
              {selectedNode && (
                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                  Stage Selected
                </span>
              )}
            </div>
            
            {/* Stage Properties Component */}
            <StageProperties 
              selectedNode={selectedNode}
              onUpdateNode={onUpdateNode}
              scenarios={scenarios}
              userGroups={userGroups}
            />
          </div>
        </div>
        
        {/* Bottom Controls */}
        <div className="bg-white rounded-lg shadow mt-6 p-4">
          <div className="flex justify-between items-center">
            <div className="flex space-x-4">
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  // Test mode functionality would go here
                  toast.success('Test mode activated. This would allow you to run through the experiment.');
                }}
              >
                Test Mode
              </button>
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  // Preview functionality would go here
                  toast.success('Preview activated. This would show you how the experiment looks to participants.');
                }}
              >
                Preview
              </button>
            </div>
            <div className="flex space-x-4">
              <button 
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                onClick={async () => {
                  if (!experiment) return;
                  
                  try {
                    // First, ensure all nodes have an order property that matches their array index
                    nodes.forEach((node, index) => {
                      if (node.data.stageData) {
                        node.data.stageData.order = index;
                      }
                    });
                    
                    // Convert nodes and edges to experiment stages and branches
                    const stages = nodes.map((node) => ({
                      id: node.id,
                      type: node.data.type,
                      title: node.data.label,
                      description: node.data.description || '',
                      order: node.data.stageData?.order || 0,
                      durationSeconds: node.data.stageData?.durationSeconds || 30,
                      required: node.data.stageData?.required !== false,
                      ...node.data.stageData
                    }));
                    
                    // Create branches from edges
                    const branches = edges.map((edge) => ({
                      id: edge.id,
                      fromStageId: edge.source,
                      defaultTargetStageId: edge.target,
                      conditions: []
                    }));
                    
                    // Start stage is the first node (this would be more sophisticated in a real app)
                    const startStageId = nodes.length > 0 ? nodes[0].id : undefined;
                    
                    const updatedExperiment = {
                      ...experiment,
                      stages,
                      branches,
                      startStageId,
                      status: 'draft',
                      lastEditedAt: new Date().toISOString()
                    };
                    
                    console.log('Saving experiment:', JSON.stringify(updatedExperiment, null, 2));
                    
                    try {
                      const response = await fetch(`/api/experiments/${experimentId}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatedExperiment)
                      });
                      
                      if (response.ok) {
                        toast.success('Experiment saved as draft');
                      } else {
                        let errorMessage = response.statusText;
                        try {
                          // Try to parse the response as JSON
                          const errorData = await response.json();
                          errorMessage = errorData.message || response.statusText;
                        } catch (jsonError) {
                          // If response is not JSON, use the status text
                          console.error('Error parsing response:', jsonError);
                          errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
                        }
                        throw new Error(`Failed to save experiment: ${errorMessage}`);
                      }
                    } catch (apiError) {
                      console.error('API Error:', apiError);
                      throw new Error(`API Error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
                    }
                  } catch (error) {
                    console.error('Error saving experiment:', error);
                    toast.error('Failed to save experiment: ' + (error instanceof Error ? error.message : 'Unknown error'));
                  }
                }}
              >
                Save as Draft
              </button>
              <button 
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
                onClick={async () => {
                  if (!experiment) return;
                  
                  if (nodes.length === 0) {
                    toast.error('Cannot publish an empty experiment. Add at least one stage.');
                    return;
                  }
                  
                  try {
                    // First, ensure all nodes have an order property that matches their array index
                    nodes.forEach((node, index) => {
                      if (node.data.stageData) {
                        node.data.stageData.order = index;
                      }
                    });
                    
                    // Convert nodes and edges to experiment stages and branches
                    const stages = nodes.map((node) => ({
                      id: node.id,
                      type: node.data.type,
                      title: node.data.label,
                      description: node.data.description || '',
                      order: node.data.stageData?.order || 0,
                      durationSeconds: node.data.stageData?.durationSeconds || 30,
                      required: node.data.stageData?.required !== false,
                      ...node.data.stageData
                    }));
                    
                    const branches = edges.map((edge) => ({
                      id: edge.id,
                      fromStageId: edge.source,
                      defaultTargetStageId: edge.target,
                      conditions: []
                    }));
                    
                    const startStageId = nodes.length > 0 ? nodes[0].id : undefined;
                    
                    const updatedExperiment = {
                      ...experiment,
                      stages,
                      branches,
                      startStageId,
                      status: 'published',
                      lastEditedAt: new Date().toISOString()
                    };
                    
                    console.log('Publishing experiment:', JSON.stringify(updatedExperiment, null, 2));
                    
                    try {
                      const response = await fetch(`/api/experiments/${experimentId}`, {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(updatedExperiment)
                      });
                      
                      if (response.ok) {
                        toast.success('Experiment published successfully!');
                        // Optionally redirect to the experiments list
                        setTimeout(() => {
                          router.push('/admin/experiments');
                        }, 1500);
                      } else {
                        let errorMessage = response.statusText;
                        try {
                          // Try to parse the response as JSON
                          const errorData = await response.json();
                          errorMessage = errorData.message || response.statusText;
                        } catch (jsonError) {
                          // If response is not JSON, use the status text
                          console.error('Error parsing response:', jsonError);
                          errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
                        }
                        throw new Error(`Failed to publish experiment: ${errorMessage}`);
                      }
                    } catch (apiError) {
                      console.error('API Error:', apiError);
                      throw new Error(`API Error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
                    }
                  } catch (error) {
                    console.error('Error publishing experiment:', error);
                    toast.error('Failed to publish experiment: ' + (error instanceof Error ? error.message : 'Unknown error'));
                  }
                }}
              >
                Publish Experiment
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Overview Modal */}
      {showOverview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-4/5 max-w-5xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-xl text-gray-800">Experiment Flow Overview</h3>
              <button 
                onClick={() => setShowOverview(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-grow">
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">Experiment Stages ({nodes.length})</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {nodes.map((node, index) => (
                    <div 
                      key={node.id} 
                      className={`p-3 rounded-lg border ${
                        node.data.type === 'instructions' ? 'border-purple-200 bg-purple-50' :
                        node.data.type === 'scenario' ? 'border-blue-200 bg-blue-50' :
                        node.data.type === 'survey' ? 'border-green-200 bg-green-50' :
                        'border-amber-200 bg-amber-50'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium">
                          {index + 1}. {node.data.label}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          node.data.type === 'instructions' ? 'bg-purple-100 text-purple-700' :
                          node.data.type === 'scenario' ? 'bg-blue-100 text-blue-700' :
                          node.data.type === 'survey' ? 'bg-green-100 text-green-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {node.data.type}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 truncate">{node.data.description || 'No description'}</p>
                      <button 
                        className="mt-2 text-xs text-purple-600 hover:text-purple-800"
                        onClick={() => {
                          setSelectedNode(node as Node<NodeData>);
                          setShowOverview(false);
                        }}
                      >
                        Edit Properties
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-2">Flow Connections ({edges.length})</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">To</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {edges.map(edge => {
                        const sourceNode = nodes.find(n => n.id === edge.source);
                        const targetNode = nodes.find(n => n.id === edge.target);
                        return (
                          <tr key={edge.id}>
                            <td className="px-4 py-2 text-sm text-gray-700">{sourceNode?.data.label || edge.source}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{targetNode?.data.label || edge.target}</td>
                            <td className="px-4 py-2 text-sm text-gray-700">{edge.animated ? 'Conditional' : 'Default'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-between">
              <button 
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded"
                onClick={() => setShowOverview(false)}
              >
                Close
              </button>
              <button 
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
                onClick={() => {
                  toast.success("Experiment flow saved successfully!");
                  setShowOverview(false);
                }}
              >
                Save & Continue Editing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white py-4 shadow-inner">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} LabLab Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}