'use client';

import { useState, useEffect } from 'react';
import { usePreview } from '@/contexts/PreviewContext';
import TransactionModal from '../modals/TransactionModal';

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

interface Transaction {
  type: 'buy' | 'sell';
  assetId: string;
  symbol: string;
  quantity: number;
  price: number;
  totalValue: number;
  timestamp: Date;
}

export default function ScenarioStage() {
  const { currentStage, goToNextStage } = usePreview();
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTimeRemaining, setRoundTimeRemaining] = useState(0);
  const [scenarioComplete, setScenarioComplete] = useState(false);
  const [scenarioData, setScenarioData] = useState<ScenarioData | null>(null);
  const [walletAssets, setWalletAssets] = useState<WalletAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingWallet, setIsLoadingWallet] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  
  // Trading functionality state
  const [usdBalance, setUsdBalance] = useState(10000); // Starting with $10,000 USD
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);
  const [transactionMode, setTransactionMode] = useState<'buy' | 'sell'>('buy');
  const [selectedAsset, setSelectedAsset] = useState<WalletAsset | null>(null);
  const [selectedAssetPrice, setSelectedAssetPrice] = useState(0);
  
  // Round-based price update states
  const [priceChangeAlerts, setPriceChangeAlerts] = useState<{
    assetId: string;
    symbol: string;
    previousPrice: number;
    newPrice: number;
    percentChange: number;
  }[]>([]);
  const [showPriceAlerts, setShowPriceAlerts] = useState(false);
  const [priceAlertTimer, setPriceAlertTimer] = useState<NodeJS.Timeout | null>(null);

  if (!currentStage || currentStage.type !== 'scenario') {
    return <div>Invalid stage type</div>;
  }
  
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

  // Fetch scenario data from MongoDB when the component mounts
  useEffect(() => {
    async function fetchScenarioData() {
      if (!currentStage.scenarioId) {
        setError("No scenario ID provided");
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        console.log(`Fetching scenario data for ID: ${currentStage.scenarioId}`);
        
        const response = await fetch(`/api/scenarios/${currentStage.scenarioId}?preview=true`, {
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
        setCurrentRound(1); // Reset to first round when scenario loads
        
        // Reset timer with the actual duration from MongoDB
        if (data.roundDuration) {
          setRoundTimeRemaining(data.roundDuration);
        }
        
        // Fetch wallet assets if we have a wallet ID
        if (data.walletId) {
          fetchWalletAssets(data.walletId);
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching scenario data:", err);
        setError(err instanceof Error ? err.message : "Failed to load scenario data");
        setIsLoading(false);
      }
    }
    
    fetchScenarioData();
  }, [currentStage.scenarioId]);
  
  // Use the data from MongoDB, or fall back to the stage data if not available yet
  const totalRounds = scenarioData?.rounds || currentStage.rounds || 1;
  const roundDuration = scenarioData?.roundDuration || currentStage.roundDuration || 60;
  
  // Calculate price changes between rounds
  const calculatePriceChanges = (newRound: number, previousRound: number) => {
    if (!scenarioData?.assetPrices?.length) return;
    
    const priceChanges = scenarioData.assetPrices.map(assetPrice => {
      if (assetPrice.prices.length <= Math.max(newRound - 1, 0) || 
          assetPrice.prices.length <= Math.max(previousRound - 1, 0)) {
        return null;
      }
      
      const newPrice = assetPrice.prices[newRound - 1];
      const oldPrice = assetPrice.prices[previousRound - 1];
      const percentChange = ((newPrice - oldPrice) / oldPrice) * 100;
      
      return {
        assetId: assetPrice.assetId,
        symbol: assetPrice.symbol,
        previousPrice: oldPrice,
        newPrice: newPrice,
        percentChange: percentChange
      };
    }).filter(change => change !== null) as {
      assetId: string;
      symbol: string;
      previousPrice: number;
      newPrice: number;
      percentChange: number;
    }[];
    
    return priceChanges;
  };
  
  // Handle round timer - only start once we have the scenario data
  useEffect(() => {
    // Only initialize timer if we have scenario data and we're not in an error state
    if (isLoading || error || !scenarioData) {
      return;
    }
    
    console.log(`Starting timer with ${totalRounds} rounds and ${roundDuration} seconds per round`);
    // Initialize once scenarioData is loaded
    setCurrentRound(1);
    setRoundTimeRemaining(roundDuration);
    setScenarioComplete(false);
    
    // Create interval to decrement timer
    const interval = setInterval(() => {
      setRoundTimeRemaining(prevTime => {
        if (prevTime <= 1) {
          // Time for this round is up
          if (currentRound < totalRounds) {
            // Calculate price changes for the new round
            const newRound = currentRound + 1;
            const priceChanges = calculatePriceChanges(newRound, currentRound);
            
            if (priceChanges && priceChanges.length > 0) {
              setPriceChangeAlerts(priceChanges);
              setShowPriceAlerts(true);
              
              // Log price changes to the database
              logPriceChangesToDatabase(priceChanges)
                .then(success => {
                  if (!success) {
                    console.warn("Price changes were not logged to database");
                  }
                })
                .catch(error => {
                  console.error("Error logging price changes:", error);
                });
              
              // Auto-dismiss price alerts after 5 seconds
              if (priceAlertTimer) {
                clearTimeout(priceAlertTimer);
              }
              
              const timer = setTimeout(() => {
                setShowPriceAlerts(false);
              }, 5000);
              
              setPriceAlertTimer(timer);
            }
            
            // Move to next round
            setCurrentRound(newRound);
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
    return () => {
      clearInterval(interval);
      if (priceAlertTimer) {
        clearTimeout(priceAlertTimer);
      }
    };
  }, [currentStage.id, currentStage.experimentId, roundDuration, totalRounds, isLoading, error, scenarioData, currentRound, priceAlertTimer]); // Add dependencies
  
  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };
  
  // Handle opening the transaction modal
  const handleOpenTransactionModal = (asset: WalletAsset, mode: 'buy' | 'sell') => {
    // Find current price for the asset
    const assetPrice = scenarioData?.assetPrices?.find(p => 
      p.assetId === asset.id || p.symbol === asset.symbol
    );
    
    if (assetPrice?.prices?.length) {
      const currentRoundIndex = Math.min(currentRound - 1, assetPrice.prices.length - 1);
      const currentPrice = assetPrice.prices[currentRoundIndex];
      
      setSelectedAsset(asset);
      setSelectedAssetPrice(currentPrice);
      setTransactionMode(mode);
      setTransactionModalOpen(true);
    } else {
      console.error("No price data available for asset:", asset);
      // Could show a notification/error here
    }
  };
  
  // Log transaction to database
  const logTransactionToDatabase = async (transaction: Transaction): Promise<boolean> => {
    try {
      if (!currentStage.experimentId) {
        console.error("No experiment ID available for transaction logging");
        return false;
      }
      
      const response = await fetch(`/api/experiments/${currentStage.experimentId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assetId: transaction.assetId,
          symbol: transaction.symbol,
          type: transaction.type,
          quantity: transaction.quantity,
          price: transaction.price,
          totalValue: transaction.totalValue,
          roundNumber: currentRound,
          timestamp: transaction.timestamp
        })
      });
      
      if (!response.ok) {
        console.error("Failed to log transaction:", await response.text());
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error logging transaction to database:", error);
      return false;
    }
  };
  
  // Log price changes to database
  const logPriceChangesToDatabase = async (priceChanges: {
    assetId: string;
    symbol: string;
    previousPrice: number;
    newPrice: number;
    percentChange: number;
  }[]): Promise<boolean> => {
    if (!priceChanges || priceChanges.length === 0 || !currentStage.experimentId) {
      return false;
    }
    
    try {
      const response = await fetch(`/api/experiments/${currentStage.experimentId}/price-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          logs: priceChanges.map(change => ({
            experimentId: currentStage.experimentId,
            assetId: change.assetId,
            symbol: change.symbol,
            roundNumber: currentRound,
            price: change.newPrice,
            previousPrice: change.previousPrice,
            percentChange: change.percentChange,
            timestamp: new Date()
          }))
        })
      });
      
      if (!response.ok) {
        console.error("Failed to log price changes:", await response.text());
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Error logging price changes to database:", error);
      return false;
    }
  };

  // Handle transactions (buy or sell)
  const handleTransaction = async (assetId: string, quantity: number, totalValue: number): Promise<boolean> => {
    // Simple validation
    if (quantity <= 0) {
      return false;
    }
    
    try {
      // Find the asset to update
      const assetToUpdate = walletAssets.find(asset => asset.id === assetId);
      if (!assetToUpdate) {
        console.error("Asset not found:", assetId);
        return false;
      }
      
      // Buy-specific validation
      if (transactionMode === 'buy' && totalValue > usdBalance) {
        return false;
      }
      
      // Sell-specific validation
      if (transactionMode === 'sell' && quantity > assetToUpdate.amount) {
        return false;
      }
      
      // Update USD balance
      if (transactionMode === 'buy') {
        setUsdBalance(prevBalance => prevBalance - totalValue);
      } else {
        setUsdBalance(prevBalance => prevBalance + totalValue);
      }
      
      // Update asset amount in wallet
      setWalletAssets(prevAssets => 
        prevAssets.map(asset => 
          asset.id === assetId 
            ? { 
                ...asset, 
                amount: transactionMode === 'buy' 
                  ? asset.amount + quantity 
                  : asset.amount - quantity 
              } 
            : asset
        )
      );
      
      // Create transaction record
      const newTransaction: Transaction = {
        type: transactionMode,
        assetId,
        symbol: assetToUpdate.symbol,
        quantity,
        price: selectedAssetPrice,
        totalValue,
        timestamp: new Date()
      };
      
      // Add to local state
      setTransactions(prevTransactions => [...prevTransactions, newTransaction]);
      
      // Log to database (async, don't wait for result)
      logTransactionToDatabase(newTransaction)
        .then(success => {
          if (!success) {
            console.warn("Transaction was not logged to database");
          }
        })
        .catch(error => {
          console.error("Error logging transaction:", error);
        });
      
      // Simulate network latency (remove in production)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return true;
    } catch (error) {
      console.error("Transaction error:", error);
      return false;
    }
  };
  
  // Auto-advance after completion with delay
  useEffect(() => {
    if (scenarioComplete) {
      const timeout = setTimeout(() => {
        goToNextStage();
      }, 10000); // Auto-advance after 10 seconds
      
      return () => clearTimeout(timeout);
    }
  }, [scenarioComplete, goToNextStage]);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Loading Scenario...</h2>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
          <p className="text-gray-600 mt-4">Fetching scenario data from database</p>
        </div>
      </div>
    );
  }
  
  // Handle error state
  if (error) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Scenario</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200 mb-4">
            <p className="text-red-700">
              Could not fetch scenario data from MongoDB. 
              This may be due to a connection issue or missing scenario in the database.
            </p>
          </div>
          <div className="text-center">
            <button
              onClick={goToNextStage}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium shadow-md transition-all"
            >
              Skip to Next Stage
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          {scenarioData?.name || currentStage.title}
        </h2>
        <p className="text-gray-600 mb-6">
          {scenarioData?.description || currentStage.description}
        </p>
        
        {/* Round and Timer display with circular progress */}
        <div className="mb-6 bg-blue-50 p-5 rounded-lg border border-blue-100">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            {/* Circular Timer */}
            <div className="relative w-40 h-40">
              {/* Background circle */}
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle 
                  cx="50" 
                  cy="50" 
                  r="46" 
                  fill="white" 
                  stroke="#E2E8F0" 
                  strokeWidth="6"
                />
                
                {/* Progress circle */}
                {!scenarioComplete && (
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="46" 
                    fill="none" 
                    stroke="#3B82F6" 
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 46}`}
                    strokeDashoffset={`${2 * Math.PI * 46 * (1 - roundTimeRemaining / roundDuration)}`}
                    transform="rotate(-90 50 50)"
                    className="transition-all duration-1000 ease-linear"
                  />
                )}
                
                {/* Completed circle */}
                {scenarioComplete && (
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="46" 
                    fill="none" 
                    stroke="#10B981" 
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                )}
              </svg>
              
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-mono font-bold text-blue-900">
                  {formatTime(roundTimeRemaining)}
                </span>
                <span className="text-xs text-gray-500 mt-1">remaining</span>
              </div>
            </div>
            
            <div className="flex flex-col w-full">
              {/* Round counter and total progress */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="text-center md:text-left">
                  <div className="mb-1">
                    <span className="font-semibold text-blue-800 text-lg">Round</span>
                    <span className="ml-2 text-2xl font-bold text-blue-900 flex items-center">
                      {currentRound} of {totalRounds}
                      {showPriceAlerts && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 text-indigo-800 rounded-full animate-pulse">
                          Prices Updated!
                        </span>
                      )}
                    </span>
                  </div>
                  
                  <div className="text-sm">
                    <span className="font-medium text-blue-700">Total Duration: </span>
                    <span className="text-blue-900">{totalRounds * roundDuration} seconds</span>
                  </div>
                </div>
                
                <div className="flex items-center bg-white p-2 rounded-lg shadow-sm">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <div>
                    <div className="font-medium text-gray-800">MongoDB Data</div>
                    <div className="text-xs text-gray-500">{roundDuration}s × {totalRounds} rounds</div>
                  </div>
                </div>
              </div>
              
              {/* Rounds remaining indicator */}
              <div className="w-full bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                <p className="text-sm text-gray-700 text-center">
                  {totalRounds - currentRound > 0 ? (
                    <span>
                      {totalRounds - currentRound} {totalRounds - currentRound === 1 ? 'round' : 'rounds'} remaining after this one
                    </span>
                  ) : (
                    <span className="font-medium text-green-600">
                      Final round in progress
                    </span>
                  )}
                </p>
              </div>
              
              {/* Status message */}
              <div className="mt-4 text-center">
                {scenarioComplete ? (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 text-green-700 font-medium">
                    All rounds completed! Proceeding to next stage shortly...
                  </div>
                ) : (
                  <p className="text-gray-600">
                    {`${totalRounds - currentRound} ${totalRounds - currentRound === 1 ? 'round' : 'rounds'} remaining after this one`}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Trading Interface</h3>
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
                          
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <div className="text-base text-gray-600 mb-2">Assets Value</div>
                              <div className="text-xl font-mono font-bold text-blue-900">
                                ${Math.round(totalUsdValue).toLocaleString()}
                              </div>
                            </div>
                            
                            <div>
                              <div className="text-base text-gray-600 mb-2">USD Balance</div>
                              <div className="text-xl font-mono font-bold text-green-700">
                                ${usdBalance.toLocaleString()}
                              </div>
                            </div>
                            
                            {hasCompleteData && (
                              <div className={`px-3 py-2 rounded-lg ${colors.bg}`}>
                                <div className="text-base text-gray-600 mb-2">Round Change</div>
                                <div className={`text-xl font-mono font-bold ${colors.text} flex items-center`}>
                                  {colors.icon} ${Math.round(Math.abs(portfolioChange)).toLocaleString()} ({Math.abs(portfolioChangePercent).toFixed(1)}%)
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Transaction count */}
                          {transactions.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-blue-200 text-sm text-blue-800">
                              <span className="font-medium">{transactions.length}</span> transactions in this session
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Individual Asset Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
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
                        
                        // Check if this asset has a recent price change alert
                        const hasRecentPriceChange = showPriceAlerts && 
                          priceChangeAlerts.some(alert => 
                            alert.assetId === asset.id || alert.symbol === asset.symbol
                          );
                        
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
                            className={`bg-white border ${hasRecentPriceChange ? `${colors.border || 'border-indigo-300'} ring-2 ring-indigo-300` : 'border-gray-200'} rounded-lg p-3 shadow hover:shadow-md transition-all ${hasRecentPriceChange ? 'animate-pulse' : ''} text-sm`}
                          >
                            {/* Header with symbol and name */}
                            <div className="flex justify-between items-center mb-2 border-b border-gray-100 pb-2">
                              <div className="flex flex-col">
                                <span className="text-lg font-bold text-gray-900">
                                  {asset.symbol}
                                </span>
                                <span className="text-xs text-gray-600" title={asset.name}>
                                  {asset.name || asset.symbol}
                                </span>
                              </div>
                              {priceDataAvailable && (
                                <div className={`px-2 py-1 rounded-lg ${colors.bg}`}>
                                  <span className={`text-xs font-medium ${colors.text} flex items-center ${hasRecentPriceChange ? 'font-bold' : ''}`}>
                                    {colors.icon} {Math.abs(changePercent).toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            {/* Asset amount and value */}
                            <div className="flex flex-col space-y-2 mb-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-600">Amount:</span>
                                <span className="text-xs font-mono font-bold text-blue-900">
                                  {asset.amount.toFixed(2)}
                                </span>
                              </div>
                              
                              {priceDataAvailable && (
                                <div className="flex justify-between items-center">
                                  <span className="text-xs text-gray-600">USD Value:</span>
                                  <span className="text-xs font-mono font-bold text-gray-900">
                                    ${Math.round(usdValue).toLocaleString()}
                                  </span>
                                </div>
                              )}
                              
                              {priceDataAvailable && (
                                <div className={`text-xs ${hasRecentPriceChange ? colors.text : 'text-gray-600'} border-t border-gray-100 pt-1 text-center ${hasRecentPriceChange ? 'font-medium' : ''}`}>
                                  Price: ${currentPrice.toFixed(2)}
                                  {hasRecentPriceChange && (
                                    <span className="ml-1 inline-block">
                                      {colors.icon}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {/* Action buttons */}
                            <div className="flex gap-2 mt-2">
                              <button 
                                className="flex-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 font-medium py-1 px-2 rounded-md transition-colors"
                                onClick={() => handleOpenTransactionModal(asset, 'buy')}
                                disabled={!priceDataAvailable || scenarioComplete}
                              >
                                Buy
                              </button>
                              <button 
                                className="flex-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 font-medium py-1 px-2 rounded-md transition-colors"
                                onClick={() => handleOpenTransactionModal(asset, 'sell')}
                                disabled={asset.amount <= 0 || !priceDataAvailable || scenarioComplete}
                              >
                                Sell
                              </button>
                            </div>
                            
                            {/* Fall back if no price data available */}
                            {!priceDataAvailable && (
                              <div className="mt-2 bg-gray-50 rounded px-2 py-1 text-xs text-gray-500 text-center">
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
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h3 className="font-semibold text-blue-800">Scenario Details from MongoDB</h3>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Scenario ID:</span>
                  <span className="font-medium">{currentStage.scenarioId || 'Default'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Scenario Name:</span>
                  <span className="font-medium">{scenarioData?.name || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Rounds:</span>
                  <span className="font-medium">{totalRounds}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Round Duration:</span>
                  <span className="font-medium">{roundDuration} seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Duration:</span>
                  <span className="font-medium">{totalRounds * roundDuration} seconds</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Status:</span>
                  <span className="font-medium text-blue-700">{scenarioComplete ? 'Complete' : 'In Progress'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="text-center mt-6">
          {scenarioComplete ? (
            <button
              onClick={goToNextStage}
              className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium shadow-md transition-all"
            >
              Continue to Next Stage
            </button>
          ) : (
            <button
              disabled={true}
              className="bg-gray-400 text-white px-6 py-3 rounded-lg cursor-not-allowed opacity-70 font-medium shadow-md"
            >
              Please complete all rounds...
            </button>
          )}
        </div>
      </div>
      
      {/* Price Change Alerts */}
      {showPriceAlerts && priceChangeAlerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          <div className="bg-indigo-600 text-white p-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Round {currentRound} Price Updates</h3>
              <button 
                onClick={() => setShowPriceAlerts(false)}
                className="text-white hover:text-indigo-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-2">
            {priceChangeAlerts.map((alert, index) => {
              const isPositive = alert.percentChange > 0;
              const isNegative = alert.percentChange < 0;
              const isUnchanged = alert.percentChange === 0;
              
              // Determine colors based on price change
              const colors = {
                bg: isPositive ? 'bg-green-50' : isNegative ? 'bg-red-50' : 'bg-gray-50',
                text: isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-600',
                icon: isPositive ? '↑' : isNegative ? '↓' : '→',
                border: isPositive ? 'border-green-200' : isNegative ? 'border-red-200' : 'border-gray-200'
              };
              
              return (
                <div 
                  key={`${alert.assetId}-${index}`}
                  className={`${colors.bg} ${colors.border} border rounded-lg p-3 mb-2`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{alert.symbol}</span>
                    <span className={`${colors.text} font-mono flex items-center`}>
                      {colors.icon} {Math.abs(alert.percentChange).toFixed(2)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                    <div>
                      <span className="text-gray-500">Previous Price:</span>
                      <div className="font-mono font-medium">${alert.previousPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">New Price:</span>
                      <div className={`font-mono font-medium ${colors.text}`}>${alert.newPrice.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Transaction Modal */}
      {selectedAsset && (
        <TransactionModal 
          isOpen={transactionModalOpen}
          onClose={() => setTransactionModalOpen(false)}
          asset={selectedAsset}
          currentPrice={selectedAssetPrice}
          availableFunds={usdBalance}
          mode={transactionMode}
          onConfirmTransaction={handleTransaction}
        />
      )}
    </div>
  );
}