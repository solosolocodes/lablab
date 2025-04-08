'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ParticipantPerformProvider, useParticipantPerform } from '@/contexts/ParticipantPerformContext';
import { toast } from 'react-hot-toast';

// Define interfaces for our components
interface Question {
  id: string;
  text: string;
  type: string;
  required?: boolean;
  options?: string[];
}

interface Stage {
  id: string;
  type: string;
  title: string;
  description: string;
  content?: string;
  format?: string;
  message?: string;
  scenarioId?: string;
  rounds?: number;
  roundDuration?: number;
  questions?: Question[];
  durationSeconds: number;
}

interface InstructionsStage extends Stage {
  type: 'instructions';
  content: string;
  format?: string;
}

// Define the stage components

function InstructionsView({ stage, onNext }: { stage: InstructionsStage; onNext: () => void }) {
  const { isStageTransitioning, saveStageResponse } = useParticipantPerform();
  
  const handleNext = async () => {
    // Record that this stage was completed
    await saveStageResponse(stage.id, 'instructions', 'done');
    onNext();
  };
  
  // Enhanced markdown-like rendering function
  const renderContent = (content: string) => {
    if (!content) return '<p>No content available</p>';
    
    // Replace markdown headers
    let formattedContent = content
      .replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold mt-3 mb-2">$1</h3>')
      .replace(/^#### (.*$)/gm, '<h4 class="text-md font-semibold mt-2 mb-1">$1</h4>');
    
    // Replace lists
    formattedContent = formattedContent.replace(/^(\d+)\. (.*)$/gm, '<li class="ml-5 list-decimal mb-1">$2</li>');
    formattedContent = formattedContent.replace(/^\* (.*)$/gm, '<li class="ml-5 list-disc mb-1">$1</li>');
    
    // Replace line breaks with paragraphs
    const paragraphs = formattedContent
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Process each paragraph
    const processedParagraphs = paragraphs.map(p => {
      if (p.startsWith('<h2') || p.startsWith('<h3') || p.startsWith('<h4')) {
        return p; // Don't wrap headers
      } else if (p.startsWith('<li')) {
        return `<ul class="my-2">${p}</ul>`; // Wrap list items
      } else {
        return `<p class="mb-2">${p}</p>`; // Wrap normal paragraphs
      }
    }).join('');
    
    return processedParagraphs;
  };
  
  return (
    <div className="w-full p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div 
        className="p-4 bg-gray-50 rounded border mb-5 prose max-w-none"
        dangerouslySetInnerHTML={{ __html: renderContent(stage.content) }}
      />
      
      <div className="flex justify-center">
        <button 
          onClick={handleNext}
          disabled={isStageTransitioning}
          className={`px-6 py-2 bg-blue-500 text-white rounded ${isStageTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function BreakStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning, saveStageResponse } = useParticipantPerform();
  const [timeRemaining, setTimeRemaining] = useState(stage.durationSeconds || 0);
  const [timerComplete, setTimerComplete] = useState(false);
  
  const handleNext = async () => {
    // Record that this break was completed
    await saveStageResponse(stage.id, 'break', 'done');
    onNext();
  };
  
  // Handle countdown timer
  useEffect(() => {
    // Don't start timer if there's no duration
    if (!stage.durationSeconds || stage.durationSeconds <= 0) {
      setTimerComplete(true);
      return;
    }
    
    // Set initial time
    setTimeRemaining(stage.durationSeconds);
    
    // Create interval to decrement timer
    const interval = setInterval(() => {
      setTimeRemaining(prevTime => {
        if (prevTime <= 1) {
          clearInterval(interval);
          setTimerComplete(true);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [stage.durationSeconds]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  return (
    <div className="w-full p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-5 bg-gray-50 rounded border mb-5 text-center">
        <div className="text-gray-500 mb-3">BREAK</div>
        <p className="font-medium mb-3 text-lg">{stage.message || "Take a short break before continuing"}</p>
        
        {/* Timer section */}
        <div className="my-6">
          <div className="bg-white py-4 px-6 rounded-lg shadow-sm inline-block">
            <div className="text-sm text-gray-600 mb-1">Time remaining:</div>
            <div className="text-3xl font-mono font-bold text-purple-700">
              {formatTime(timeRemaining)}
            </div>
          </div>
        </div>
        
        {timerComplete ? (
          <p className="text-green-600 font-medium">Break time complete! You can now continue.</p>
        ) : (
          <p className="text-gray-600">Please wait until the timer reaches zero to continue.</p>
        )}
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={handleNext}
          disabled={isStageTransitioning || !timerComplete}
          className={`px-6 py-2 ${timerComplete ? 'bg-blue-500' : 'bg-gray-400 cursor-not-allowed'} text-white rounded ${isStageTransitioning ? 'opacity-50' : ''}`}
        >
          {timerComplete ? 'Continue' : 'Please wait...'}
        </button>
      </div>
    </div>
  );
}

// Interface for Scenario data
interface AssetPrice {
  assetId: string;
  symbol: string;
  prices: number[];
}

interface ScenarioData {
  id: string;
  name: string;
  description: string;
  rounds: number;
  roundDuration: number;
  walletId: string;
  assetPrices?: AssetPrice[];
  [key: string]: unknown;
}

interface WalletAsset {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  [key: string]: unknown;
}

function ScenarioStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning, saveStageResponse } = useParticipantPerform();
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState(0);
  const [scenarioComplete, setScenarioComplete] = useState(false);
  const [scenarioData, setScenarioData] = useState<ScenarioData | null>(null);
  const [walletAssets, setWalletAssets] = useState<WalletAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  
  const handleNext = async () => {
    // Record scenario completion
    await saveStageResponse(stage.id, 'scenario', {
      scenarioId: stage.scenarioId,
      completed: true,
      rounds: currentRound
    });
    onNext();
  };
  
  // Function to fetch wallet assets by wallet ID
  const fetchWalletAssets = async (walletId: string) => {
    if (!walletId) {
      setWalletError("No wallet ID available in scenario data");
      setIsLoadingWallet(false);
      return;
    }
    
    try {
      setIsLoadingWallet(true);
      console.log(`Fetching wallet assets for wallet ID: ${walletId}`);
      
      const response = await fetch(`/api/wallets/${walletId}/assets?preview=true`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch wallet assets: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Wallet assets fetched:", data);
      
      if (Array.isArray(data)) {
        setWalletAssets(data);
      } else if (data.assets && Array.isArray(data.assets)) {
        setWalletAssets(data.assets);
      } else {
        console.warn("Unexpected wallet data format:", data);
        setWalletAssets([]);
      }
      
      setIsLoadingWallet(false);
    } catch (err) {
      console.error("Error fetching wallet assets:", err);
      setWalletError(err instanceof Error ? err.message : "Failed to load wallet assets");
      setIsLoadingWallet(false);
    }
  };
  
  // Fetch scenario data
  useEffect(() => {
    async function fetchScenarioData() {
      if (!stage.scenarioId) {
        setError("No scenario ID provided");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        console.log(`Fetching scenario data for ID: ${stage.scenarioId}`);
        
        const response = await fetch(`/api/scenarios/${stage.scenarioId}?preview=true`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch scenario: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Scenario data fetched:", data);
        setScenarioData(data);
        
        // Initialize with the data from MongoDB
        setCurrentRound(1);
        setRoundTimeRemaining(data.roundDuration || stage.roundDuration || 60);
        setScenarioComplete(false);
        
        // Fetch wallet assets if we have a wallet ID
        if (data.walletId) {
          fetchWalletAssets(data.walletId);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching scenario data:", err);
        setError(err instanceof Error ? err.message : "Failed to load scenario data");
        setIsLoading(false);
        
        // If we can't get data from MongoDB, use the stage data as fallback
        setCurrentRound(1);
        setRoundTimeRemaining(stage.roundDuration || 60);
      }
    }
    
    fetchScenarioData();
  }, [stage.scenarioId, stage.roundDuration]);
  
  // Use the data from MongoDB, or fall back to the stage data
  const totalRounds = scenarioData?.rounds || stage.rounds || 1;
  const roundDuration = scenarioData?.roundDuration || stage.roundDuration || 60;
  
  // Handle round timer - only start if we have data
  useEffect(() => {
    // Don't start timer if we're still loading data
    if (isLoading) {
      return;
    }
    
    // Don't start timer if no rounds or duration
    if (!totalRounds || !roundDuration) {
      setScenarioComplete(true);
      return;
    }
    
    // Create interval to decrement timer
    const interval = setInterval(() => {
      setRoundTimeRemaining(prevTime => {
        if (prevTime <= 1) {
          // Time for this round is up
          if (currentRound < totalRounds) {
            // Move to next round
            setCurrentRound(prev => prev + 1);
            return roundDuration; // Reset timer for next round
          } else {
            // All rounds complete
            clearInterval(interval);
            setScenarioComplete(true);
            return 0;
          }
        }
        return prevTime - 1;
      });
    }, 1000);
    
    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [totalRounds, roundDuration, currentRound, isLoading]);
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="w-full p-4 bg-white rounded border">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold">Loading Scenario Data...</h3>
          <p className="text-gray-600 mt-2">Fetching scenario details</p>
        </div>
      </div>
    );
  }
  
  // Error state with fallback
  if (error) {
    return (
      <div className="w-full p-4 bg-white rounded border">
        <div className="mb-4 pb-3 border-b border-gray-200">
          <h3 className="text-xl font-bold mb-2 text-red-600">Error Loading Scenario</h3>
          <p className="text-gray-600">{error}</p>
        </div>
        
        <div className="p-4 bg-red-50 rounded border mb-5">
          <p className="text-red-700 mb-2">Could not fetch scenario data.</p>
          <p className="text-gray-700">Using fallback data from experiment configuration.</p>
        </div>
        
        <div className="flex justify-center">
          <button 
            onClick={handleNext}
            className="px-6 py-2 bg-blue-500 text-white rounded"
          >
            Skip to Next Stage
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="w-full p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">
          {scenarioData?.name || stage.title}
        </h3>
        <p className="text-gray-600">
          {scenarioData?.description || stage.description}
        </p>
        <div className="text-xs text-blue-600 mt-1">
          Data loaded from MongoDB
        </div>
      </div>
      
      {/* Round and Timer display */}
      <div className="mb-4 bg-blue-50 p-4 rounded-lg border border-blue-100">
        <div className="flex flex-col md:flex-row items-center justify-between">
          <div className="mb-4 md:mb-0">
            <div className="text-center mb-2">
              <span className="font-medium text-blue-800">Round:</span>
              <span className="ml-2 text-xl font-bold text-blue-900">{currentRound} of {totalRounds}</span>
            </div>
            
            {/* Status message */}
            <div className="text-center">
              {scenarioComplete ? (
                <p className="text-green-600 font-medium">All rounds completed!</p>
              ) : (
                <p className="text-gray-600 text-sm">
                  {`${totalRounds - currentRound} ${totalRounds - currentRound === 1 ? 'round' : 'rounds'} remaining after this one`}
                </p>
              )}
            </div>
          </div>
          
          {/* Circular Timer */}
          <div className="relative w-36 h-36">
            {/* Background circle */}
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <circle 
                cx="50" 
                cy="50" 
                r="45" 
                fill="white" 
                stroke="#E2E8F0" 
                strokeWidth="8"
              />
              
              {/* Progress circle */}
              {!scenarioComplete && (
                <circle 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  fill="none" 
                  stroke="#3B82F6" 
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - roundTimeRemaining / roundDuration)}`}
                  transform="rotate(-90 50 50)"
                />
              )}
              
              {/* Completed circle */}
              {scenarioComplete && (
                <circle 
                  cx="50" 
                  cy="50" 
                  r="45" 
                  fill="none" 
                  stroke="#10B981" 
                  strokeWidth="8"
                  strokeLinecap="round"
                />
              )}
            </svg>
            
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-mono font-bold text-blue-900">
                {formatTime(roundTimeRemaining)}
              </span>
              <span className="text-xs text-gray-500 mt-1">remaining</span>
            </div>
          </div>
          
          {/* Rounds indicator */}
          <div className="mt-4 md:mt-0 w-full md:w-48">
            <div className="bg-white rounded-lg p-2 border border-gray-200 shadow-sm text-center">
              <p className="font-medium text-blue-700">
                Round {currentRound} of {totalRounds}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {totalRounds - currentRound > 0 ? (
                  <span>{totalRounds - currentRound} {totalRounds - currentRound === 1 ? 'round' : 'rounds'} remaining</span>
                ) : (
                  <span className="text-green-600 font-medium">Final round</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <div className="text-center py-4">
          <p className="font-medium mb-3">Scenario Simulation</p>
          <div className="border border-gray-300 rounded p-4 mb-4 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-700">Scenario Interface</h4>
              <div className="text-sm">
                {scenarioComplete ? (
                  <span className="text-green-600 font-medium">
                    ✓ Complete
                  </span>
                ) : (
                  <span className="text-blue-600">
                    Round {currentRound}/{totalRounds}
                  </span>
                )}
              </div>
            </div>
            
            {/* Wallet and asset cards */}
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              {/* Wallet header */}
              <div className="bg-blue-50 p-3 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <span className="font-semibold text-blue-800">
                      Scenario Wallet
                    </span>
                  </div>
                  <span className="text-xs text-blue-600">
                    ID: {scenarioData?.walletId ? scenarioData.walletId.slice(0, 8) + '...' : 'Unknown'}
                  </span>
                </div>
              </div>
              
              {/* Loading state */}
              {isLoadingWallet && (
                <div className="p-4 text-center">
                  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-blue-500 border-r-transparent"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading assets...</p>
                </div>
              )}
              
              {/* Error state */}
              {walletError && (
                <div className="p-4 text-center">
                  <p className="text-red-500">Error loading assets</p>
                  <p className="text-xs text-gray-500 mt-1">{walletError}</p>
                </div>
              )}
              
              {/* Empty state */}
              {!isLoadingWallet && !walletError && walletAssets.length === 0 && (
                <div className="p-4 text-center">
                  <p className="text-gray-500">No assets found in this wallet</p>
                </div>
              )}
              
              {/* Asset cards */}
              {!isLoadingWallet && !walletError && walletAssets.length > 0 && (
                <div className="p-3 space-y-4">
                  {/* Portfolio Summary Card */}
                  {(() => {
                    // Calculate portfolio totals
                    let totalUsdValue = 0;
                    let previousTotalUsdValue = 0;
                    let hasCompleteData = false;
                    
                    // Process all assets to calculate total value
                    walletAssets.forEach(asset => {
                      const assetPrice = scenarioData?.assetPrices?.find(p => 
                        p.assetId === asset.id || p.symbol === asset.symbol
                      );
                      
                      if (assetPrice?.prices?.length) {
                        const currentRoundIndex = Math.min(currentRound - 1, assetPrice.prices.length - 1);
                        const currentPrice = assetPrice.prices[currentRoundIndex];
                        totalUsdValue += asset.amount * currentPrice;
                        
                        // Calculate previous round total if possible
                        if (currentRoundIndex > 0) {
                          hasCompleteData = true;
                          const prevPrice = assetPrice.prices[currentRoundIndex - 1];
                          previousTotalUsdValue += asset.amount * prevPrice;
                        }
                      }
                    });
                    
                    // Calculate portfolio change
                    let portfolioChange = 0;
                    let portfolioChangePercent = 0;
                    if (hasCompleteData && previousTotalUsdValue > 0) {
                      portfolioChange = totalUsdValue - previousTotalUsdValue;
                      portfolioChangePercent = (portfolioChange / previousTotalUsdValue) * 100;
                    }
                    
                    // Determine colors based on portfolio change
                    const isPositive = portfolioChange > 0;
                    const isNegative = portfolioChange < 0;
                    const colors = {
                      text: isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-blue-600',
                      bg: isPositive ? 'bg-green-50' : isNegative ? 'bg-red-50' : 'bg-blue-50',
                      icon: isPositive ? '↑' : isNegative ? '↓' : '→'
                    };
                    
                    // Create timestamp
                    const now = new Date();
                    const timestamp = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                    
                    return (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 shadow-md">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-base font-bold text-blue-900">
                            Portfolio Summary
                          </h3>
                          <div className="text-base text-gray-600">
                            Round {currentRound} • {timestamp}
                          </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                          <div className="flex-1">
                            <div className="text-base text-gray-600 mb-2">Total Value</div>
                            <div className="text-2xl font-mono font-bold text-blue-900">
                              ${Math.round(totalUsdValue).toLocaleString()}
                            </div>
                          </div>
                          
                          {hasCompleteData && (
                            <div className={`flex-1 px-5 py-3 rounded-lg ${colors.bg} flex items-center justify-center`}>
                              <div>
                                <div className="text-base text-gray-600 mb-2 text-center">Change From Last Round</div>
                                <div className={`text-2xl font-mono font-bold ${colors.text} flex items-center justify-center`}>
                                  {colors.icon} ${Math.round(Math.abs(portfolioChange)).toLocaleString()} ({Math.abs(portfolioChangePercent).toFixed(1)}%)
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  
                  {/* Individual Asset Cards */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {walletAssets.map(asset => {
                      // Find asset price data
                      const assetPrice = scenarioData?.assetPrices?.find(p => 
                        p.assetId === asset.id || p.symbol === asset.symbol
                      );
                      
                      // Calculate current price and change
                      let currentPrice = 0;
                      let priceChange = 0;
                      let changePercent = 0;
                      let usdValue = 0;
                      let priceDataAvailable = false;
                      let colors = {
                        text: 'text-blue-600',
                        bg: 'bg-blue-50',
                        icon: '→'
                      };
                      
                      if (assetPrice?.prices?.length) {
                        priceDataAvailable = true;
                        const currentRoundIndex = Math.min(currentRound - 1, assetPrice.prices.length - 1);
                        currentPrice = assetPrice.prices[currentRoundIndex];
                        usdValue = asset.amount * currentPrice;
                        
                        // Calculate price trend
                        if (currentRoundIndex > 0) {
                          const prevPrice = assetPrice.prices[currentRoundIndex - 1];
                          priceChange = currentPrice - prevPrice;
                          changePercent = (priceChange / prevPrice) * 100;
                          
                          // Determine colors based on price change
                          const isPositive = priceChange > 0;
                          const isNegative = priceChange < 0;
                          colors = {
                            text: isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-blue-600',
                            bg: isPositive ? 'bg-green-50' : isNegative ? 'bg-red-50' : 'bg-blue-50',
                            icon: isPositive ? '↑' : isNegative ? '↓' : '→'
                          };
                        }
                      }
                      
                      return (
                        <div 
                          key={asset.id} 
                          className="bg-white border border-gray-200 rounded-lg p-5 shadow"
                        >
                          {/* Header with symbol and name */}
                          <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
                            <div className="flex flex-col">
                              <span className="text-xl font-bold text-gray-900">
                                {asset.symbol}
                              </span>
                              <span className="text-base text-gray-600" title={asset.name}>
                                {asset.name || asset.symbol}
                              </span>
                            </div>
                            {priceDataAvailable && (
                              <div className={`px-3 py-1.5 rounded-lg ${colors.bg}`}>
                                <span className={`text-base font-medium ${colors.text} flex items-center`}>
                                  {colors.icon} {Math.abs(changePercent).toFixed(1)}%
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Asset amount and value */}
                          <div className="flex flex-col space-y-4 mb-4">
                            <div className="flex justify-between items-center">
                              <span className="text-base text-gray-600">Amount:</span>
                              <span className="text-base font-mono font-bold text-blue-900">
                                {asset.amount.toFixed(2)}
                              </span>
                            </div>
                            
                            {priceDataAvailable && (
                              <div className="flex justify-between items-center">
                                <span className="text-base text-gray-600">Value in USD:</span>
                                <span className="text-base font-mono font-bold text-gray-900">
                                  ${Math.round(usdValue).toLocaleString()}
                                </span>
                              </div>
                            )}
                            
                            {priceDataAvailable && (
                              <div className="text-base text-gray-600 border-t border-gray-100 pt-2 text-center">
                                Current price: ${currentPrice.toFixed(2)}
                              </div>
                            )}
                          </div>
                          
                          {/* Action buttons */}
                          <div className="flex gap-4 mt-4">
                            <button
                              onClick={() => toast.success(`Buy action for ${asset.symbol} (simulation only)`)}
                              className="flex-1 text-base bg-green-100 text-green-700 font-medium py-3 px-4 rounded-md"
                            >
                              Buy
                            </button>
                            <button
                              onClick={() => toast.success(`Sell action for ${asset.symbol} (simulation only)`)}
                              className="flex-1 text-base bg-red-100 text-red-700 font-medium py-3 px-4 rounded-md"
                            >
                              Sell
                            </button>
                          </div>
                          
                          {/* Fall back if no price data available */}
                          {!priceDataAvailable && (
                            <div className="mt-4 bg-gray-50 rounded px-4 py-3 text-base text-gray-500 text-center">
                              No price data available
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Round status footer */}
              <div className="bg-gray-50 p-2 border-t border-gray-200 text-center text-xs text-gray-500">
                {scenarioComplete 
                  ? "Trading completed for all rounds"
                  : `Trading in progress for round ${currentRound} of ${totalRounds}`
                }
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={handleNext}
          disabled={isStageTransitioning || !scenarioComplete}
          className={`px-6 py-2 ${scenarioComplete ? 'bg-blue-500' : 'bg-gray-400 cursor-not-allowed'} text-white rounded ${isStageTransitioning ? 'opacity-50' : ''}`}
        >
          {scenarioComplete ? 'Continue' : 'Please complete all rounds...'}
        </button>
      </div>
    </div>
  );
}

function SurveyStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning, saveStageResponse } = useParticipantPerform();
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Initialize responses if needed
  useEffect(() => {
    if (!stage.questions || stage.questions.length === 0) return;
    
    const initialResponses: Record<string, any> = {};
    stage.questions.forEach(question => {
      if (question.type === 'multipleChoice') {
        initialResponses[question.id] = '';
      } else if (question.type === 'checkboxes') {
        initialResponses[question.id] = [];
      } else if (question.type === 'scale') {
        initialResponses[question.id] = null;
      } else {
        initialResponses[question.id] = '';
      }
    });
    
    setResponses(initialResponses);
  }, [stage.questions]);
  
  const handleInputChange = (questionId: string, value: string | string[] | number) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };
  
  const handleCheckboxChange = (questionId: string, option: string, checked: boolean) => {
    setResponses(prev => {
      const currentSelections = Array.isArray(prev[questionId])
        ? [...prev[questionId]]
        : [];
      
      if (checked) {
        return {
          ...prev,
          [questionId]: [...currentSelections, option]
        };
      } else {
        return {
          ...prev,
          [questionId]: currentSelections.filter(item => item !== option)
        };
      }
    });
  };
  
  const handleSubmit = async () => {
    // Validate required questions
    let hasErrors = false;
    
    stage.questions?.forEach(question => {
      if (question.required) {
        const response = responses[question.id];
        
        if (response === '' || response === null || 
            (Array.isArray(response) && response.length === 0)) {
          toast.error(`Please answer question: ${question.text}`);
          hasErrors = true;
        }
      }
    });
    
    if (hasErrors) return;
    
    setIsSubmitting(true);
    
    try {
      // Save survey responses
      await saveStageResponse(stage.id, 'survey', responses);
      
      // Proceed to next stage
      onNext();
    } catch (error) {
      console.error('Error submitting survey:', error);
      toast.error('Failed to submit survey responses');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="w-full p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <p className="font-medium mb-4">Please answer the following questions:</p>
        
        {stage.questions && stage.questions.length > 0 ? (
          <div className="space-y-6">
            {stage.questions.map((question, index) => (
              <div key={question.id} className="p-4 bg-white rounded border">
                <label className="block mb-2 font-medium">
                  {index + 1}. {question.text} {question.required && <span className="text-red-500">*</span>}
                </label>
                
                {/* Text input for short answer questions */}
                {question.type === 'text' && (
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded"
                    value={responses[question.id] || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    required={question.required}
                  />
                )}
                
                {/* Textarea for long answer questions */}
                {question.type === 'textarea' && (
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded"
                    rows={4}
                    value={responses[question.id] || ''}
                    onChange={(e) => handleInputChange(question.id, e.target.value)}
                    required={question.required}
                  />
                )}
                
                {/* Radio buttons for multiple choice */}
                {question.type === 'multipleChoice' && question.options && (
                  <div className="space-y-2 mt-2">
                    {question.options.map((option, idx) => (
                      <div key={idx} className="flex items-center">
                        <input
                          type="radio"
                          id={`${question.id}-option-${idx}`}
                          name={question.id}
                          className="mr-2"
                          checked={responses[question.id] === option}
                          onChange={() => handleInputChange(question.id, option)}
                          required={question.required}
                        />
                        <label htmlFor={`${question.id}-option-${idx}`}>
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Checkboxes for multiple selection */}
                {question.type === 'checkboxes' && question.options && (
                  <div className="space-y-2 mt-2">
                    {question.options.map((option, idx) => (
                      <div key={idx} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`${question.id}-option-${idx}`}
                          className="mr-2"
                          checked={(responses[question.id] || []).includes(option)}
                          onChange={(e) => handleCheckboxChange(question.id, option, e.target.checked)}
                        />
                        <label htmlFor={`${question.id}-option-${idx}`}>
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Scale (1-5, 1-10, etc.) */}
                {question.type === 'scale' && (
                  <div className="flex flex-wrap justify-between items-center mt-2">
                    {[1, 2, 3, 4, 5].map((number) => (
                      <div key={number} className="text-center mx-2 mb-2">
                        <button
                          type="button"
                          className={`w-10 h-10 rounded-full ${
                            responses[question.id] === number
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-800'
                          }`}
                          onClick={() => handleInputChange(question.id, number)}
                        >
                          {number}
                        </button>
                        {number === 1 && <div className="text-xs mt-1">Strongly Disagree</div>}
                        {number === 5 && <div className="text-xs mt-1">Strongly Agree</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 text-center p-4">No questions defined for this survey.</p>
        )}
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={handleSubmit}
          disabled={isStageTransitioning || isSubmitting}
          className={`px-6 py-2 bg-blue-500 text-white rounded ${
            (isStageTransitioning || isSubmitting) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}

function ExperimentPerformer() {
  const { 
    experiment, 
    progress, 
    currentStageIndex, 
    currentStage,
    loadExperiment, 
    goToNextStage, 
    completeExperiment 
  } = useParticipantPerform();
  
  const [viewMode, setViewMode] = useState<'welcome' | 'experiment' | 'thankyou'>('welcome');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadInitiated, setLoadInitiated] = useState(false);
  
  const router = useRouter();
  const params = useParams();
  const experimentId = params.id as string;
  
  // Load experiment data with better error handling and status tracking
  // Added functionality to manually bypass loading screen after timeout
  const [manualOverride, setManualOverride] = useState(false);
  
  useEffect(() => {
    // Prevent duplicate loading
    if (loadInitiated) return;
    
    let isMounted = true; // Track component mount state
    let loadAttempts = 0;
    const maxAttempts = 3;
    setLoadInitiated(true);
    
    // Set up a long timer to enable manual override in case of persistent issues
    const manualOverrideTimer = setTimeout(() => {
      if (isMounted && isLoading) {
        console.log('Setting up manual override option for persistent loading...');
        setManualOverride(true);
      }
    }, 15000); // 15 seconds
    
    async function loadData() {
      console.log('Starting experiment data load...');
      
      if (!experimentId) {
        if (isMounted) {
          setLoadError('No experiment ID provided');
          setIsLoading(false);
        }
        return;
      }
      
      try {
        if (isMounted) setIsLoading(true);
        
        loadAttempts++;
        console.log(`Loading experiment ${experimentId}... (attempt ${loadAttempts}/${maxAttempts})`);
        
        // Set a timeout for the entire load operation
        const loadTimeout = 12000; // 12 seconds
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Loading experiment timed out after ${loadTimeout/1000} seconds`));
          }, loadTimeout);
        });
        
        // Race between the experiment loading and timeout
        await Promise.race([
          loadExperiment(experimentId),
          timeoutPromise
        ]);
        
        console.log('Experiment loaded successfully');
        if (isMounted) {
          setIsLoading(false);
          setLoadError(null);
          setManualOverride(false); // Reset manual override if we succeed
        }
      } catch (err) {
        console.error('Error loading experiment:', err);
        if (isMounted) {
          // If we haven't exceeded max attempts, try again with exponential backoff
          if (loadAttempts < maxAttempts) {
            const backoffTime = Math.min(1000 * (2 ** loadAttempts), 8000); // Exponential backoff with max 8 seconds
            console.log(`Retrying in ${backoffTime/1000} seconds...`);
            setTimeout(loadData, backoffTime);
            return;
          }
          
          setLoadError((err as Error)?.message || 'Failed to load experiment');
          setIsLoading(false);
          toast.error('Failed to load experiment after multiple attempts. Please try refreshing the page.');
        }
      }
    }
    
    // Use a minimal delay before loading to prevent conflicts
    const initTimer = setTimeout(() => {
      loadData();
    }, 100);
    
    // Cleanup function to prevent state updates after unmounting
    return () => {
      console.log('Component unmounting, cancelling any pending operations');
      clearTimeout(initTimer);
      clearTimeout(manualOverrideTimer);
      isMounted = false;
    };
  }, [experimentId, loadExperiment, loadInitiated, isLoading]);
  
  // Handle the Next button click on the welcome screen
  const handleWelcomeNext = () => {
    setViewMode('experiment');
  };
  
  // Handle stage navigation
  const handleStageNext = () => {
    if (!experiment) return;
    
    // Check if this is the last stage
    if (currentStageIndex >= experiment.stages.length - 1) {
      // Complete the experiment if this is the last stage
      completeExperiment().then(() => {
        setViewMode('thankyou');
        toast.success('Experiment completed!');
      });
    } else {
      // Otherwise, go to the next stage
      goToNextStage();
    }
  };
  
  // Handle exit button
  const handleExit = () => {
    router.push('/participant/dashboard');
  };
  
  // Simple loading indicator instead of full-screen overlay
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200 text-center">
          <p className="text-gray-600">Loading experiment, please wait...</p>
          
          <div className="mt-2 h-1 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{width: '60%'}}></div>
          </div>
          
          {/* Manual override option appears after timeout */}
          {manualOverride && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-amber-600 text-sm mb-2">Taking longer than expected?</p>
              <div className="flex space-x-2 justify-center">
                <button 
                  onClick={() => {
                    setIsLoading(false); 
                    console.log('User manually bypassed loading screen');
                  }}
                  className="px-3 py-1 text-xs bg-amber-100 text-amber-800 rounded hover:bg-amber-200"
                >
                  Continue Anyway
                </button>
                <button 
                  onClick={handleExit}
                  className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}
          
          <p className="text-xs text-gray-400 mt-3">Experiment ID: {experimentId}</p>
        </div>
      </div>
    );
  }
  
  // Error state
  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-bold mb-2">Error Loading Experiment</h3>
          <p className="text-gray-600 mb-4">{loadError}</p>
          <div className="flex justify-center space-x-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded"
            >
              Retry
            </button>
            <button 
              onClick={handleExit}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // No experiment data loaded
  if (!experiment || !progress) {
    return (
      <div className="w-full h-full flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-bold mb-2">Experiment Not Found</h3>
          <p className="text-gray-600 mb-4">The experiment you're looking for does not exist or you do not have access to it.</p>
          <button 
            onClick={handleExit}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  // Thank You screen view
  if (viewMode === 'thankyou' || progress.status === 'completed') {
    return (
      <div className="p-4">
        <div className="w-full p-8 bg-white rounded shadow text-center">
          <div className="text-green-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-bold mb-2">Thank You!</h3>
          <p className="text-lg text-gray-600 mb-6">You have successfully completed the experiment.</p>
          <p className="text-gray-500 mb-8">Your responses have been recorded.</p>
          <button 
            onClick={handleExit}
            className="px-6 py-2 bg-green-500 text-white rounded"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  // Welcome screen view with stages overview
  if (viewMode === 'welcome') {
    return (
      <div className="p-4">
        <div className="w-full p-6 bg-white rounded shadow">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold mb-3">{experiment.name}</h3>
            <p className="text-gray-600 mb-2">{experiment.description || ''}</p>
            <div className="text-gray-600 bg-blue-50 p-2 rounded-md inline-block">
              <p>This experiment consists of {experiment.stages.length} stages.</p>
            </div>
          </div>

          {experiment.stages.length > 0 && (
            <div className="bg-gray-50 rounded border p-6 mb-6">
              <h4 className="font-medium mb-4 text-lg">What to expect:</h4>
              <div className="space-y-2">
                {[...experiment.stages]
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((stage, index) => (
                    <div key={stage.id} className="flex items-center py-2 border-b border-gray-100 last:border-0">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 text-sm font-medium text-blue-700">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{stage.title}</p>
                        <p className="text-sm text-gray-500">{stage.type}</p>
                      </div>
                      <div className="text-sm px-2 py-1 rounded bg-gray-100 text-gray-700">
                        {stage.durationSeconds && stage.durationSeconds > 0 
                          ? `${Math.ceil(stage.durationSeconds / 60)} min` 
                          : 'No time limit'}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
          
          <div className="text-center p-4 bg-blue-50 rounded mb-6">
            <p className="text-gray-700 mb-3">
              Your progress will be automatically saved as you complete each stage.
              You can return to this experiment later if you need to take a break.
            </p>
            {progress.status === 'in_progress' && (
              <p className="text-blue-700 font-medium">
                You've already started this experiment. You'll continue from where you left off.
              </p>
            )}
          </div>
          
          <div className="text-center">
            <button 
              onClick={handleWelcomeNext}
              className="px-8 py-3 bg-blue-500 text-white rounded text-lg font-medium"
            >
              Begin Experiment
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Experiment stage view
  if (viewMode === 'experiment' && experiment.stages.length > 0) {
    if (!currentStage) return (
      <div className="p-4 text-center">
        <p>No current stage found. Please try refreshing the page.</p>
      </div>
    );
    
    return (
      <div className="p-4">
        {/* Simple header with stage info */}
        <div className="flex justify-between items-center w-full mb-4 bg-white px-4 py-2 rounded shadow-sm">
          <div>
            <p className="text-sm text-gray-500">Stage {currentStageIndex + 1} of {experiment.stages.length}</p>
          </div>
          <div>
            <p className="text-sm font-medium">{experiment.name}</p>
          </div>
          <div>
            <span className="text-xs text-gray-600">
              {Math.round(((currentStageIndex + 1) / experiment.stages.length) * 100)}% complete
            </span>
          </div>
        </div>
        
        {/* Render the appropriate stage component */}
        <div className="w-full">
          {currentStage.type === 'instructions' && (
            <InstructionsView 
              stage={currentStage as InstructionsStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {currentStage.type === 'break' && (
            <BreakStage 
              stage={currentStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {currentStage.type === 'scenario' && (
            <ScenarioStage 
              stage={currentStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {currentStage.type === 'survey' && (
            <SurveyStage 
              stage={currentStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {!['instructions', 'break', 'scenario', 'survey'].includes(currentStage.type) && (
            <div className="w-full p-4 bg-white rounded border">
              <div className="mb-4 pb-3 border-b border-gray-200">
                <h3 className="text-xl font-bold mb-2">{currentStage.title}</h3>
                <p className="text-gray-600">{currentStage.description}</p>
              </div>
              
              <div className="p-4 bg-gray-50 rounded border mb-5">
                <p className="font-medium">Unknown stage type: {currentStage.type}</p>
                <p className="mt-2 text-gray-600">This stage type is not recognized and is displayed as a placeholder.</p>
              </div>
              
              <div className="flex justify-center">
                <button 
                  onClick={handleStageNext}
                  className="px-6 py-2 bg-blue-500 text-white rounded"
                >
                  Continue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  return null;
}

export default function PerformExperimentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isAuthLoading = status === 'loading';
  
  // Authentication check
  useEffect(() => {
    // If not authenticated or not a participant, redirect to login
    if (!isAuthLoading && (!session || session.user.role !== 'participant')) {
      router.push('/participant/login');
    }
  }, [session, isAuthLoading, router]);
  
  // Still loading auth
  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }
  
  // Authentication check
  if (!session || session.user.role !== 'participant') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm py-3">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Link href="/participant/dashboard" className="text-gray-600 hover:text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-gray-800">LabLab Experiment</h1>
          </div>
          <div className="text-sm text-gray-600">
            {session.user.email}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <ParticipantPerformProvider>
            <ExperimentPerformer />
          </ParticipantPerformProvider>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white py-3 shadow-inner mt-auto">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600 text-xs">
            © {new Date().getFullYear()} LabLab Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}