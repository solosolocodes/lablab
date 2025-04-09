'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/Button';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Type definitions
type Asset = {
  id: string;
  name: string;
  symbol: string;
  type: string;
};

type PriceData = {
  assetId: string;
  symbol: string;
  name: string;
  prices: number[];
};

type ScenarioDetail = {
  id: string;
  name: string;
  description: string;
  rounds: number;
  roundDuration: number;
  assets: Asset[];
  priceData: PriceData[];
};

export default function ScenarioDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const scenarioId = params.id as string;
  
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [localPriceData, setLocalPriceData] = useState<PriceData[]>([]);
  const [currentRound, setCurrentRound] = useState(0); // For focusing on a specific round
  const [editMode, setEditMode] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (status !== 'loading' && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // Fetch scenario data
  useEffect(() => {
    const fetchScenarioData = async () => {
      if (!scenarioId || status !== 'authenticated') return;
      
      try {
        setIsLoading(true);
        const response = await fetch(`/api/scenarios/prices?scenarioId=${scenarioId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch scenario data');
        }
        
        const data = await response.json();
        setScenario(data);
        setLocalPriceData(data.priceData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching scenario data:', error);
        toast.error('Failed to load scenario: ' + (error instanceof Error ? error.message : 'Unknown error'));
        setIsLoading(false);
      }
    };
    
    fetchScenarioData();
  }, [scenarioId, status]);

  // Handle price update for a specific asset and round
  const handlePriceChange = (assetId: string, roundIndex: number, newPrice: number) => {
    if (!editMode) return;
    
    // Update the local price data
    setLocalPriceData(prevData => 
      prevData.map(asset => 
        asset.assetId === assetId 
          ? {
              ...asset,
              prices: asset.prices.map((price, i) => 
                i === roundIndex ? newPrice : price
              )
            }
          : asset
      )
    );
  };

  // Update prices in backend
  const saveChanges = async () => {
    if (!scenario) return;
    
    try {
      setIsSaving(true);
      
      // Format the data for the API
      const assetPrices = localPriceData.map(asset => ({
        assetId: asset.assetId,
        symbol: asset.symbol,
        prices: asset.prices
      }));
      
      // Save changes to the server
      const response = await fetch('/api/scenarios/prices', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scenarioId: scenario.id,
          assetPrices
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update prices');
      }
      
      toast.success('Prices updated successfully');
      setEditMode(false);
    } catch (error) {
      console.error('Error updating prices:', error);
      toast.error('Failed to update prices: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  // Generate random prices for all assets
  const generateRandomPrices = () => {
    if (!scenario || !editMode) return;
    
    const newPriceData = localPriceData.map(asset => {
      // Get the initial price (round 0)
      const initialPrice = asset.prices[0];
      
      // Generate new prices for rounds 1+
      const newPrices = [initialPrice]; // Keep the initial price unchanged
      
      for (let round = 1; round < scenario.rounds; round++) {
        // Generate a random fluctuation between -15% and +20%
        const fluctuation = 0.85 + (Math.random() * 0.35);
        const previousPrice = newPrices[round - 1];
        newPrices.push(previousPrice * fluctuation);
      }
      
      return {
        ...asset,
        prices: newPrices
      };
    });
    
    setLocalPriceData(newPriceData);
    toast.success('Random prices generated');
  };

  // Format price display
  const formatPrice = (price: number) => {
    if (price < 0.01) return price.toFixed(4);
    if (price < 1) return price.toFixed(2);
    if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  };
  
  // Export price data to CSV
  const exportPriceDataToCSV = () => {
    if (!scenario) return;
    
    // Create header row with round numbers
    const headerRow = ['Asset ID', 'Symbol', 'Name', ...Array.from({ length: scenario.rounds + 1 }, (_, i) => 
      i === 0 ? 'Initial' : `Round ${i}`
    )];
    
    // Create data rows
    const dataRows = localPriceData.map(asset => [
      asset.assetId,
      asset.symbol,
      asset.name,
      ...asset.prices.map(price => price.toString())
    ]);
    
    // Combine header and data rows
    const csvContent = [
      headerRow.join(','),
      ...dataRows.map(row => row.join(','))
    ].join('\n');
    
    // Create a Blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `scenario_${scenario.id}_prices.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Handle file selection for CSV import
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsImporting(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const lines = csvText.split('\n');
        
        // Skip header row and parse data rows
        const newPriceData = lines.slice(1).filter(line => line.trim()).map(line => {
          const values = line.split(',');
          
          // Extract asset info and prices
          const assetId = values[0];
          const symbol = values[1];
          const name = values[2];
          const prices = values.slice(3).map(Number);
          
          return {
            assetId,
            symbol,
            name,
            prices
          };
        });
        
        // Validate and update price data
        if (newPriceData.length === 0) {
          throw new Error('No valid data found in CSV file');
        }
        
        // Ensure each asset has the correct number of prices
        const requiredPriceCount = scenario ? scenario.rounds + 1 : 0;
        const invalidData = newPriceData.find(asset => asset.prices.length !== requiredPriceCount);
        if (invalidData) {
          throw new Error(`Invalid data format: Each asset must have ${requiredPriceCount} price values`);
        }
        
        // Update local price data
        setLocalPriceData(newPriceData);
        toast.success('Price data imported successfully');
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('Failed to import CSV: ' + (error instanceof Error ? error.message : 'Invalid format'));
      } finally {
        setIsImporting(false);
        // Reset the file input
        event.target.value = '';
      }
    };
    
    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsImporting(false);
      // Reset the file input
      event.target.value = '';
    };
    
    reader.readAsText(file);
  };

  // Get color class based on price change
  const getPriceChangeColor = (currentPrice: number, previousPrice: number) => {
    if (currentPrice > previousPrice) return 'text-green-600';
    if (currentPrice < previousPrice) return 'text-red-600';
    return 'text-gray-600';
  };

  // Format duration in a readable way
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m${remainingSeconds > 0 ? ` ${remainingSeconds}s` : ''}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Loading scenario data...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated and is admin
  if (!session || session.user.role !== 'admin') {
    return null; // Will redirect via useEffect
  }

  // If no scenario data
  if (!scenario) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Scenario not found</p>
          <Link href="/admin/scenarios" className="text-purple-600 mt-4 inline-block">
            Return to scenarios
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
                <Link href="/admin/experiments" className="px-3 py-2 rounded hover:bg-purple-600">Experiments</Link>
                <Link href="/admin/scenarios" className="px-3 py-2 rounded bg-purple-600">Scenarios</Link>
                <Link href="/admin/surveys" className="px-3 py-2 rounded hover:bg-purple-600">Surveys</Link>
                <Link href="/admin/wallets" className="px-3 py-2 rounded hover:bg-purple-600">Wallets</Link>
                <Link href="/admin/user-groups" className="px-3 py-2 rounded hover:bg-purple-600">User Groups</Link>
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
        {/* Header with Scenario Info */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center mb-2">
              <Link href="/admin/scenarios" className="text-gray-500 hover:text-gray-700 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-gray-800">{scenario.name}</h1>
            </div>
            <p className="text-gray-600 mb-2">{scenario.description}</p>
            <div className="flex space-x-4 text-sm text-gray-500">
              <span>{scenario.rounds} rounds</span>
              <span>{formatDuration(scenario.roundDuration)} per round</span>
              <span>Total duration: {formatDuration(scenario.rounds * scenario.roundDuration)}</span>
            </div>
          </div>
          <div className="flex space-x-2">
            {!editMode ? (
              <>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2"
                  onClick={() => setEditMode(true)}
                >
                  Edit Prices
                </Button>
                <Button 
                  className="bg-teal-600 hover:bg-teal-700 px-4 py-2"
                  onClick={exportPriceDataToCSV}
                >
                  Export CSV
                </Button>
                <div className="relative">
                  <Button 
                    className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2"
                    onClick={() => document.getElementById('csv-file-input')?.click()}
                    disabled={isImporting}
                  >
                    {isImporting ? 'Importing...' : 'Import CSV'}
                  </Button>
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isImporting}
                  />
                </div>
              </>
            ) : (
              <>
                <Button 
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2"
                  onClick={() => {
                    setLocalPriceData(scenario.priceData);
                    setEditMode(false);
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700 px-4 py-2"
                  onClick={generateRandomPrices}
                >
                  Generate Random
                </Button>
                <Button 
                  className="bg-teal-600 hover:bg-teal-700 px-4 py-2"
                  onClick={exportPriceDataToCSV}
                >
                  Export CSV
                </Button>
                <div className="relative">
                  <Button 
                    className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2"
                    onClick={() => document.getElementById('csv-file-input')?.click()}
                    disabled={isImporting}
                  >
                    {isImporting ? 'Importing...' : 'Import CSV'}
                  </Button>
                  <input
                    id="csv-file-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isImporting}
                  />
                </div>
                <Button 
                  className="bg-purple-600 hover:bg-purple-700 px-4 py-2"
                  onClick={saveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Round Navigation */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="mb-2 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Round Selection</h2>
            <div className="text-sm text-gray-500">
              {currentRound === 0 ? 'Initial Values' : `Round ${currentRound}`}
            </div>
          </div>
          <div className="flex overflow-x-auto pb-2">
            <div 
              className={`flex-shrink-0 px-4 py-2 rounded-md mx-1 cursor-pointer ${
                currentRound === 0 ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
              onClick={() => setCurrentRound(0)}
            >
              Initial
            </div>
            {Array.from({ length: scenario.rounds }, (_, i) => i + 1).map(round => (
              <div
                key={round}
                className={`flex-shrink-0 px-4 py-2 rounded-md mx-1 cursor-pointer ${
                  currentRound === round ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
                onClick={() => setCurrentRound(round)}
              >
                Round {round}
              </div>
            ))}
          </div>
        </div>
        
        {/* Asset Prices Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/4">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Price
                  </th>
                  {currentRound > 0 && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Change from Previous
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {editMode ? 'Edit Price' : 'Price Details'}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {localPriceData.map(asset => {
                  const currentPrice = asset.prices[currentRound] || 0;
                  const previousPrice = currentRound > 0 ? asset.prices[currentRound - 1] || 0 : 0;
                  const priceChange = currentRound > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;
                  
                  return (
                    <tr key={asset.assetId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{asset.name}</div>
                            <div className="text-xs text-gray-500">{asset.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatPrice(currentPrice)}
                        </div>
                      </td>
                      {currentRound > 0 && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm font-medium ${getPriceChangeColor(currentPrice, previousPrice)}`}>
                            {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {editMode ? (
                          <input
                            type="number"
                            className="w-32 px-2 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={currentPrice}
                            onChange={(e) => {
                              const newPrice = parseFloat(e.target.value);
                              if (!isNaN(newPrice) && newPrice >= 0) {
                                handlePriceChange(asset.assetId, currentRound, newPrice);
                              }
                            }}
                            step="0.01"
                            min="0"
                          />
                        ) : (
                          <div className="text-sm text-gray-500">
                            Initial: {formatPrice(asset.prices[0])}
                            {currentRound > 0 && ` | Change: ${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}%`}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                
                {localPriceData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                      No asset price data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

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