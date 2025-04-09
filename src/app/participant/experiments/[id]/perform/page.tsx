'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PreviewProvider, usePreview } from '@/contexts/PreviewContext';

// Define basic interfaces for stage types
// Question interface to replace any type
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
}

interface InstructionsStage extends Stage {
  type: 'instructions';
  content: string;
  format?: string;
}

// Type guard function to check if a stage is an instructions stage
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isInstructionsStage(stage: Stage): stage is InstructionsStage {
  return stage.type === 'instructions' && typeof stage.content === 'string';
}

function InstructionsView({ stage, onNext }: { stage: InstructionsStage; onNext: () => void }) {
  const { isStageTransitioning } = usePreview();
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
          onClick={onNext}
          disabled={isStageTransitioning}
          className={`px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${isStageTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function BreakStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning } = usePreview();
  const [timeRemaining, setTimeRemaining] = useState(stage.durationSeconds || 0);
  const [timerComplete, setTimerComplete] = useState(false);
  
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
          onClick={onNext}
          disabled={isStageTransitioning || !timerComplete}
          className={`px-6 py-2 ${timerComplete ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'} text-white rounded transition-colors ${isStageTransitioning ? 'opacity-50' : ''}`}
        >
          {timerComplete ? 'Continue' : 'Please wait...'}
        </button>
      </div>
    </div>
  );
}

// Interface for Scenario data from MongoDB
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
  const { isStageTransitioning } = usePreview();
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState(0);
  const [scenarioComplete, setScenarioComplete] = useState(false);
  const [scenarioData, setScenarioData] = useState<ScenarioData | null>(null);
  const [walletAssets, setWalletAssets] = useState<WalletAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  
  // Import cache at the top of the file
  const cache = require('@/lib/cache');
  
  // Function to fetch wallet assets by wallet ID with caching
  const fetchWalletAssets = async (walletId: string) => {
    if (!walletId) {
      setWalletError("No wallet ID available in scenario data");
      setIsLoadingWallet(false);
      return;
    }
    
    try {
      setIsLoadingWallet(true);
      console.log(`Fetching wallet assets for wallet ID: ${walletId}`);
      
      // Try to get from cache first
      const { assets, success, message } = await cache.getCachedWalletAssets(walletId);
      
      if (message) {
        console.log(`Wallet assets cache: ${message}`);
      }
      
      // If we got assets, use them
      if (assets && assets.length > 0) {
        setWalletAssets(assets);
        
        // If it's fallback data, show a warning but don't block the UI
        if (!success) {
          setWalletError("Using cached or fallback wallet data due to connection issues");
        }
      } else {
        // No assets from cache, show warning
        setWalletError("No wallet assets found");
        
        // Create some fallback assets
        const fallbackAssets = [
          {
            id: `${walletId}-asset1`,
            symbol: 'BTC',
            name: 'Bitcoin',
            amount: 0.5
          },
          {
            id: `${walletId}-asset2`,
            symbol: 'AAPL',
            name: 'Apple Inc.',
            amount: 10
          },
          {
            id: `${walletId}-asset3`,
            symbol: 'ETH',
            name: 'Ethereum',
            amount: 5
          }
        ];
        
        setWalletAssets(fallbackAssets);
      }
      
      setIsLoadingWallet(false);
    } catch (err) {
      console.error("Error fetching wallet assets:", err);
      setWalletError(err instanceof Error ? err.message : "Failed to load wallet assets");
      
      // Create fallback assets even on error
      const fallbackAssets = [
        {
          id: `${walletId}-fallback1`,
          symbol: 'BTC',
          name: 'Bitcoin',
          amount: 0.5
        },
        {
          id: `${walletId}-fallback2`,
          symbol: 'AAPL',
          name: 'Apple Inc.',
          amount: 10
        },
        {
          id: `${walletId}-fallback3`,
          symbol: 'ETH',
          name: 'Ethereum',
          amount: 5
        }
      ];
      
      setWalletAssets(fallbackAssets);
      setIsLoadingWallet(false);
    }
  };
  
  // Fetch scenario data with caching
  useEffect(() => {
    async function fetchScenarioData() {
      if (!stage.scenarioId) {
        setError("No scenario ID provided");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        console.log(`Loading scenario data for ID: ${stage.scenarioId}`);
        
        // Try to get data from cache first
        const { scenario, success, message } = await cache.getCachedScenarioData(stage.scenarioId);
        
        if (message) {
          console.log(`Scenario cache: ${message}`);
        }
        
        if (!success) {
          // Show warning but continue with the data we have
          console.warn(`Using potentially stale data for scenario ${stage.scenarioId}`);
        }
        
        // Use the data we got (either from cache or fresh)
        if (scenario && Object.keys(scenario).length > 0) {
          console.log("Scenario data loaded successfully");
          setScenarioData(scenario as ScenarioData);
          
          // Initialize with the data
          setCurrentRound(1);
          setRoundTimeRemaining(scenario.roundDuration || stage.roundDuration || 60);
          setScenarioComplete(false);
          
          // Fetch wallet assets if we have a wallet ID
          if (scenario.walletId) {
            fetchWalletAssets(scenario.walletId);
          }
        } else {
          // No data from cache or fetch, use fallback
          console.warn("No scenario data available, using fallback");
          
          // Create minimal fallback data
          const fallbackData: ScenarioData = {
            id: stage.scenarioId,
            name: stage.title || 'Investment Scenario',
            description: stage.description || 'Simulated trading scenario',
            rounds: stage.rounds || 3,
            roundDuration: stage.roundDuration || 60,
            walletId: 'fallback-wallet-id'
          };
          
          setScenarioData(fallbackData);
          setCurrentRound(1);
          setRoundTimeRemaining(fallbackData.roundDuration);
          
          // Use fallback wallet
          fetchWalletAssets('fallback-wallet-id');
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error loading scenario data:", err);
        setError(err instanceof Error ? err.message : "Failed to load scenario data");
        
        // Create fallback data even on error
        const fallbackData: ScenarioData = {
          id: stage.scenarioId || 'error-fallback',
          name: stage.title || 'Investment Scenario',
          description: stage.description || 'Simulated trading scenario',
          rounds: stage.rounds || 3,
          roundDuration: stage.roundDuration || 60,
          walletId: 'fallback-wallet-id'
        };
        
        setScenarioData(fallbackData);
        setCurrentRound(1);
        setRoundTimeRemaining(fallbackData.roundDuration);
        setIsLoading(false);
      }
    }
    
    fetchScenarioData();
  }, [stage.scenarioId, stage.roundDuration, stage.title, stage.description, stage.rounds]);
  
  // Use the data from MongoDB, or fall back to the stage data
  const totalRounds = scenarioData?.rounds || stage.rounds || 1;
  const roundDuration = scenarioData?.roundDuration || stage.roundDuration || 60;
  
  // Handle round timer - only start if we have data (from MongoDB or stage)
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
  
  // Progress calculations removed
  
  // Loading state
  if (isLoading) {
    return (
      <div className="w-full p-4 bg-white rounded border">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold">Loading Scenario Data...</h3>
          <p className="text-gray-600 mt-2">Fetching scenario details from MongoDB</p>
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
          <p className="text-red-700 mb-2">Could not fetch scenario data from MongoDB.</p>
          <p className="text-gray-700">Using fallback data from experiment configuration.</p>
        </div>
        
        <div className="flex justify-center">
          <button 
            onClick={onNext}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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
      </div>
      
      {/* Round and Timer display with circular progress */}
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
                  className="transition-all duration-1000 ease-linear"
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
          
          {/* Rounds indicator - No progress percentage */}
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
                          className="bg-white border border-gray-200 rounded-lg p-5 shadow hover:shadow-md transition-shadow"
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
                            <button className="flex-1 text-base bg-green-100 hover:bg-green-200 text-green-700 font-medium py-3 px-4 rounded-md transition-colors">
                              Buy
                            </button>
                            <button className="flex-1 text-base bg-red-100 hover:bg-red-200 text-red-700 font-medium py-3 px-4 rounded-md transition-colors">
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
          onClick={onNext}
          disabled={isStageTransitioning || !scenarioComplete}
          className={`px-6 py-2 ${scenarioComplete ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400 cursor-not-allowed'} text-white rounded transition-colors ${isStageTransitioning ? 'opacity-50' : ''}`}
        >
          {scenarioComplete ? 'Continue' : 'Please complete all rounds...'}
        </button>
      </div>
    </div>
  );
}

function SurveyStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning } = usePreview();
  return (
    <div className="w-full p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <p className="font-medium mb-3">Survey Questions</p>
        
        {stage.questions && stage.questions.length > 0 ? (
          <div>
            {stage.questions.map((q: Question, i: number) => (
              <div key={q.id || i} className="mb-4 p-3 bg-white rounded border">
                <p className="font-medium">
                  {i+1}. {q.text} {q.required && <span className="text-red-500">*</span>}
                </p>
                <p className="text-sm text-gray-500 mt-1">Type: {q.type}</p>
                
                {q.type === 'multipleChoice' && q.options && (
                  <div className="mt-2 pl-4">
                    {q.options.map((option: string, idx: number) => (
                      <div key={idx} className="flex items-center mt-1">
                        <span className="w-4 h-4 border border-gray-300 rounded-full mr-2"></span>
                        <span className="text-gray-700">{option}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600">No questions defined for this survey.</p>
        )}
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={onNext}
          disabled={isStageTransitioning}
          className={`px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${isStageTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function PlaceholderStage({ stage, onNext }: { stage: Stage; onNext: () => void }) {
  const { isStageTransitioning } = usePreview();
  // Render different stage types with appropriate placeholders
  if (stage.type === 'break') {
    return <BreakStage stage={stage} onNext={onNext} />;
  }
  
  if (stage.type === 'scenario') {
    return <ScenarioStage stage={stage} onNext={onNext} />;
  }
  
  if (stage.type === 'survey') {
    return <SurveyStage stage={stage} onNext={onNext} />;
  }
  
  // Default placeholder for unknown stage types
  return (
    <div className="w-full p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <p className="font-medium">Unknown stage type: {stage.type}</p>
        <p className="mt-2 text-gray-600">This stage type is not recognized and is displayed as a placeholder.</p>
      </div>
      
      <div className="flex justify-center">
        <button 
          onClick={onNext}
          disabled={isStageTransitioning}
          className={`px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${isStageTransitioning ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function ExperimentContent() {
  const { experiment, loadExperiment, updateParticipantProgress, prefetchExperimentData } = usePreview();
  const [viewMode, setViewMode] = useState<'welcome' | 'experiment' | 'thankyou'>('welcome');
  const [currentStageNumber, setCurrentStageNumber] = useState(0);
  const params = useParams();
  const experimentId = params.id as string;
  const { data: session, status } = useSession();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  
  // First, prefetch all experiment data when the component mounts
  useEffect(() => {
    if (!experimentId) return;
    
    // Only do this on initial mount
    if (isInitialLoad) {
      setIsInitialLoad(false);
      
      // Prefetch in the background
      prefetchExperimentData(experimentId)
        .then(() => {
          console.log('Experiment data prefetched successfully');
        })
        .catch(err => {
          console.warn('Error prefetching experiment data:', err);
          // Continue anyway - this is just a prefetch
        });
    }
  }, [experimentId, prefetchExperimentData, isInitialLoad]);
  
  // Then load the experiment data with proper UI state
  useEffect(() => {
    // Only attempt to load if we have an experiment ID
    if (!experimentId) {
      setLoadError("No experiment ID provided");
      return;
    }
    
    // Show loading indicator
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
      loadingMessage.textContent = 'Loading experiment data...';
    }
    
    // Pass true to indicate this is the participant view
    loadExperiment(experimentId, true)
      .then(() => {
        setLoadError(null);
        if (loadingMessage) {
          loadingMessage.textContent = 'Experiment loaded successfully';
        }
      })
      .catch(err => {
        console.error('Error loading experiment:', err);
        setLoadError(`Failed to load experiment: ${err instanceof Error ? err.message : String(err)}`);
        if (loadingMessage) {
          loadingMessage.textContent = 'Error loading experiment data';
        }
      });
  }, [experimentId, loadExperiment]);
  
  // Handle the Next button click on the welcome screen
  const handleWelcomeNext = () => {
    try {
      // Add safety check before continuing
      if (!experiment || !experiment.stages || experiment.stages.length === 0) {
        console.warn('Cannot start experiment: No experiment data or empty stages');
        
        // Show error message to user
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
          loadingMessage.textContent = 'Error: Cannot start experiment. Please refresh and try again.';
          loadingMessage.classList.add('text-red-500');
          // Make sure it's visible
          loadingMessage.classList.remove('hidden', 'md:inline');
          loadingMessage.classList.add('inline-block');
        }
        
        return; // Prevent proceeding with invalid state
      }
      
      // Proceed with transition - first update UI
      setViewMode('experiment');
      
      // Then try to update progress in the background
      if (experiment && experiment.id) {
        const startingStageId = experiment.stages[0]?.id;
        
        // Only make the API call if we have a valid stage ID
        if (startingStageId) {
          // Use setTimeout to avoid potential race conditions
          setTimeout(() => {
            updateParticipantProgress(experiment.id, 'in_progress', startingStageId)
              .catch(err => {
                console.warn('Error updating progress (non-critical):', err);
              });
          }, 100);
        }
      }
    } catch (err) {
      console.error('Error in handleWelcomeNext:', err);
      
      // Ensure user sees error message
      const loadingMessage = document.getElementById('loading-message');
      if (loadingMessage) {
        loadingMessage.textContent = 'Error starting experiment. Please refresh and try again.';
        loadingMessage.classList.add('text-red-500');
        loadingMessage.classList.remove('hidden', 'md:inline');
        loadingMessage.classList.add('inline-block');
      }
    }
  };
  
  // Handle Next button click for stage navigation
  const handleStageNext = () => {
    // Validate experiment data first
    if (!experiment || !experiment.stages) {
      console.warn('Cannot navigate: Invalid experiment data');
      return;
    }
    
    try {
      const currentIndex = currentStageNumber;
      const stagesCount = experiment.stages.length;
      
      // Validate index boundaries
      if (currentIndex < 0 || currentIndex >= stagesCount) {
        console.warn(`Invalid stage index: ${currentIndex} (total stages: ${stagesCount})`);
        return;
      }
      
      // Case 1: More stages to go
      if (currentIndex < stagesCount - 1) {
        // Ensure we have a valid next stage before proceeding
        const nextIndex = currentIndex + 1;
        if (nextIndex >= stagesCount || !experiment.stages[nextIndex]) {
          console.warn(`Cannot navigate to invalid stage index: ${nextIndex}`);
          return;
        }
        
        // Set the state for next stage
        setCurrentStageNumber(nextIndex);
        
        // Optional: Update progress in the background
        const nextStageId = experiment.stages[nextIndex].id;
        if (nextStageId) {
          // Use setTimeout to decouple from the state update
          setTimeout(() => {
            updateParticipantProgress(experiment.id, 'in_progress', nextStageId)
              .catch(err => {
                console.warn('Error updating progress during navigation (non-critical):', err);
              });
          }, 100);
        }
      } 
      // Case 2: Final stage completion
      else {
        // Transition UI first
        setViewMode('thankyou');
        
        // Then update server status in the background
        setTimeout(() => {
          updateParticipantProgress(experiment.id, 'completed')
            .catch(error => {
              console.warn('Error updating completion status (non-critical):', error);
            });
        }, 100);
      }
    } catch (error) {
      console.error('Error in handleStageNext:', error);
      
      // Show error message to user
      const loadingMessage = document.getElementById('loading-message');
      if (loadingMessage) {
        loadingMessage.textContent = 'Error navigating between stages';
        loadingMessage.classList.add('text-red-500');
        loadingMessage.classList.remove('hidden', 'md:inline');
        loadingMessage.classList.add('inline-block');
      }
    }
  };
  
  // Handle exit button
  const handleExit = () => {
    window.close();
  };
  
  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <h2 className="text-lg font-medium">Loading...</h2>
        </div>
      </div>
    );
  }
  
  // Authentication check
  if (!session || session.user.role !== 'participant') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You must be logged in as a participant to access this experiment.</p>
          <a href="/participant/login" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            Login as Participant
          </a>
        </div>
      </div>
    );
  }
  
  // Handle load errors
  if (loadError) {
    return (
      <div className="p-4">
        <div className="w-full p-4 bg-white rounded border text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold mb-2 text-red-600">Error Loading Experiment</h2>
          <p className="text-gray-600 mb-6">{loadError}</p>
          <a href="/participant/dashboard" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }
  
  // No experiment loaded yet
  if (!experiment) {
    return (
      <div className="p-4">
        <div className="w-full p-4 bg-white rounded border text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading experiment...</p>
        </div>
      </div>
    );
  }
  
  // Thank You screen view
  if (viewMode === 'thankyou') {
    return (
      <div className="p-4">
        <div className="w-full p-4 bg-white rounded border text-center">
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
            Close Window
          </button>
        </div>
      </div>
    );
  }
  
  // Welcome screen view with stages overview
  if (viewMode === 'welcome') {
    // Check if we have valid data before rendering the welcome screen
    const hasValidData = experiment && experiment.stages && experiment.stages.length > 0;
    
    return (
      <div className="p-4">
        <div className="w-full p-4 bg-white rounded border">
          {hasValidData ? (
            <>
              <div className="text-center mb-5">
                <h3 className="text-xl font-bold mb-2">Welcome to {experiment.name}</h3>
                <p className="text-gray-600 mb-2">{experiment.description || ''}</p>
                <div className="text-gray-600">
                  <p>This experiment consists of {experiment.stages.length} stages.</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded border p-4 mb-5">
                <h4 className="font-medium mb-2">Stages Overview:</h4>
                <div className="space-y-1">
                  {[...experiment.stages]
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((stage, index) => (
                      <div key={stage.id || index} className="flex items-center py-1 border-b border-gray-100 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3 text-sm font-medium text-blue-700">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{stage.title}</p>
                          <p className="text-xs text-gray-500">{stage.type}</p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {stage.durationSeconds > 0 ? `${stage.durationSeconds} sec` : 'No time limit'}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              
              <div className="text-center">
                <button 
                  onClick={handleWelcomeNext}
                  className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Begin Experiment
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <div className="mb-4">
                <svg className="w-16 h-16 text-yellow-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-yellow-800 mb-3">Experiment Data Loading</h3>
              <p className="text-gray-600 mb-4">
                The experiment data is still loading or couldn't be loaded properly. 
                Please wait a moment or try refreshing the page.
              </p>
              
              <div className="animate-pulse my-4">
                <div className="h-3 bg-gray-200 rounded w-3/4 mx-auto mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto"></div>
              </div>
              
              <div className="mt-6">
                <button 
                  onClick={() => window.location.reload()}
                  className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors mx-2"
                >
                  Refresh Page
                </button>
                <button 
                  onClick={() => {
                    // Force a new attempt to load the experiment
                    const loadingMessage = document.getElementById('loading-message');
                    if (loadingMessage) {
                      loadingMessage.textContent = 'Retrying experiment load...';
                      loadingMessage.classList.remove('text-red-500');
                      loadingMessage.classList.add('text-blue-500');
                    }
                    
                    // Try to load again with force refresh
                    loadExperiment(experimentId, true)
                      .catch(err => console.warn('Retry load failed:', err));
                  }}
                  className="px-6 py-2 border border-blue-500 text-blue-600 rounded hover:bg-blue-50 transition-colors mx-2 mt-2 md:mt-0"
                >
                  Retry Loading
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Experiment stage view
  if (viewMode === 'experiment' && experiment.stages.length > 0) {
    const stage = experiment.stages[currentStageNumber];
    if (!stage) return null;
    
    return (
      <div className="p-4">
        <div className="flex justify-between items-center w-full mb-4">
          <div>
            <p className="text-sm text-gray-500">Stage {currentStageNumber + 1} of {experiment.stages.length}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Experiment: {experiment.name}</p>
          </div>
        </div>
        
        <div className="w-full">
          {stage.type === 'instructions' && 'content' in stage && (
            <InstructionsView 
              stage={stage as InstructionsStage} 
              onNext={handleStageNext} 
            />
          )}
          
          {stage.type === 'break' && (
            <BreakStage 
              stage={stage} 
              onNext={handleStageNext} 
            />
          )}
          
          {stage.type === 'scenario' && (
            <ScenarioStage 
              stage={stage} 
              onNext={handleStageNext} 
            />
          )}
          
          {stage.type === 'survey' && (
            <SurveyStage 
              stage={stage} 
              onNext={handleStageNext} 
            />
          )}
          
          {!['instructions', 'break', 'scenario', 'survey'].includes(stage.type) && (
            <PlaceholderStage 
              stage={stage} 
              onNext={handleStageNext} 
            />
          )}
        </div>
      </div>
    );
  }
  
  return null;
}

// Main component with header and footer
export default function PerformExperimentPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-white shadow-sm py-3">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">LabLab Experiment</h1>
          <div className="flex items-center">
            <span id="loading-message" className="text-sm text-gray-600 mr-4 hidden md:inline">
              Initializing...
            </span>
            <button 
              onClick={() => window.close()}
              className="text-sm py-1 px-3 border border-gray-300 rounded hover:bg-gray-100"
            >
              Close Window
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <PreviewProvider>
            <ExperimentContent />
          </PreviewProvider>
        </div>
      </main>

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