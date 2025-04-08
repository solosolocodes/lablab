import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// This is a special testing endpoint that returns hardcoded data
// without requiring any database access or authentication
export async function GET(request: NextRequest) {
  console.log('[DEBUG] Using TEST DATA endpoint that bypasses all database and auth checks');
  
  // Generate consistent IDs based on simple strings to make them stable
  const generateId = (seed: string) => {
    // Use a simple hash function to create a deterministic ID
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to string and pad with zeros
    const hashStr = Math.abs(hash).toString().padStart(12, '0');
    return hashStr + '000000000000';
  };
  
  // Current date for timestamps
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  // Create test user groups
  const testGroups = [
    {
      id: generateId('group1'),
      name: 'Test Group 1'
    },
    {
      id: generateId('group2'),
      name: 'Test Group 2'
    }
  ];
  
  // Create test experiments
  const testExperiments = [
    {
      id: generateId('experiment1'),
      name: 'Test Experiment 1',
      description: 'This is a test experiment with sample data for debugging',
      status: 'active',
      progress: {
        status: 'in_progress',
        startedAt: yesterday.toISOString(),
        lastActivityAt: now.toISOString()
      },
      createdAt: lastWeek.toISOString()
    },
    {
      id: generateId('experiment2'),
      name: 'Test Experiment 2',
      description: 'Another test experiment with different status',
      status: 'active',
      progress: {
        status: 'not_started'
      },
      createdAt: yesterday.toISOString()
    },
    {
      id: generateId('experiment3'),
      name: 'Test Experiment 3',
      description: 'A completed test experiment',
      status: 'active',
      progress: {
        status: 'completed',
        startedAt: lastWeek.toISOString(),
        completedAt: yesterday.toISOString(),
        lastActivityAt: yesterday.toISOString()
      },
      createdAt: lastWeek.toISOString()
    }
  ];
  
  // Get query parameters for filtering
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  
  // Filter experiments if status is specified
  let filteredExperiments = testExperiments;
  if (status && status !== 'all') {
    filteredExperiments = testExperiments.filter(exp => exp.progress.status === status);
  }
  
  console.log(`[DEBUG] Returning ${filteredExperiments.length} test experiments`);
  
  return NextResponse.json(filteredExperiments);
}