'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function TestScenarioFetch() {
  const [scenarioId, setScenarioId] = useState('');
  const [loading, setLoading] = useState(false);
  const [scenarioDetails, setScenarioDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch scenario details - similar to what we have in the experiment designer
  const fetchScenarioDetails = async (id: string) => {
    if (!id) return null;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/scenarios/${id}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Handle non-2xx responses
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = response.statusText;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          // If we can't parse the JSON, just use the raw error text
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(`Error: ${response.status} ${errorMessage}`);
      }
      
      // Get response as text first for better error handling
      const responseText = await response.text();
      
      // No response body
      if (!responseText || !responseText.trim()) {
        throw new Error('Empty response from server');
      }
      
      // Parse JSON
      const data = JSON.parse(responseText);
      
      setScenarioDetails(data);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error fetching scenario details:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scenarioId.trim()) {
      toast.error('Please enter a scenario ID');
      return;
    }
    
    await fetchScenarioDetails(scenarioId);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Test Scenario Fetch</h1>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={scenarioId}
            onChange={(e) => setScenarioId(e.target.value)}
            placeholder="Enter Scenario ID"
            className="border rounded px-3 py-2 flex-grow"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400"
          >
            {loading ? 'Loading...' : 'Fetch Scenario'}
          </button>
        </div>
      </form>
      
      {error && (
        <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg font-medium text-red-800 mb-1">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      {scenarioDetails && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h2 className="text-lg font-medium text-blue-800 mb-3">Scenario Details</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
              <input 
                type="text" 
                readOnly 
                value={scenarioDetails.id} 
                className="w-full px-3 py-2 bg-white border rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input 
                type="text" 
                readOnly 
                value={scenarioDetails.name} 
                className="w-full px-3 py-2 bg-white border rounded-md"
              />
            </div>
            
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea 
                readOnly 
                value={scenarioDetails.description} 
                className="w-full px-3 py-2 bg-white border rounded-md"
                rows={2}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rounds</label>
              <input 
                type="number" 
                readOnly 
                value={scenarioDetails.rounds} 
                className="w-full px-3 py-2 bg-white border rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Round Duration (seconds)</label>
              <input 
                type="number" 
                readOnly 
                value={scenarioDetails.roundDuration} 
                className="w-full px-3 py-2 bg-white border rounded-md"
              />
            </div>
          </div>
          
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Duration:</span>
              <span className="text-sm text-gray-900">
                {scenarioDetails.rounds * scenarioDetails.roundDuration} seconds
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Calculated as {scenarioDetails.rounds} rounds × {scenarioDetails.roundDuration} seconds per round
            </p>
          </div>
          
          <div className="mt-4">
            <h3 className="text-md font-medium text-gray-800 mb-2">Raw Response:</h3>
            <pre className="p-3 bg-gray-50 border border-gray-200 rounded-md overflow-auto text-xs">
              {JSON.stringify(scenarioDetails, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}