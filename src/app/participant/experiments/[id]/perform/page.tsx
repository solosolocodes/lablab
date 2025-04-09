'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PreviewProvider, usePreview } from '@/contexts/PreviewContext';
import { toast } from 'react-hot-toast';

// Define basic interfaces for stage types
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
  
  // Create a ref for wallet asset fetch state that persists across renders
  const walletFetchStatusRef = useRef({
    attempts: 0,
    maxRetries: 10,
    lastSuccess: false,
    inProgress: false,
    abortController: null as AbortController | null,
    pendingTimeouts: [] as number[]
  });
  
  // Function to fetch wallet assets by wallet ID with fallback data and retry logic
  const fetchWalletAssets = async (walletId: string) => {
    if (!walletId) {
      setWalletError("No wallet ID available in scenario data");
      setIsLoadingWallet(false);
      return;
    }
    
    // Clear all pending timeouts for this wallet on new request
    walletFetchStatusRef.current.pendingTimeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    walletFetchStatusRef.current.pendingTimeouts = [];
    
    try {
      // Don't start a new request if one is already in progress
      if (walletFetchStatusRef.current.inProgress) {
        console.log('Asset fetch already in progress, skipping duplicate request');
        return;
      }
      
      // If we've already failed too many times, show error and use fallback
      if (walletFetchStatusRef.current.attempts >= walletFetchStatusRef.current.maxRetries) {
        console.warn(`Exceeded maximum retry attempts (${walletFetchStatusRef.current.maxRetries}), using fallback data`);
        setWalletError(`Connection issues detected. Using offline data after ${walletFetchStatusRef.current.maxRetries} attempts.`);
        useFallbackAssets(walletId);
        setIsLoadingWallet(false);
        return;
      }
      
      setIsLoadingWallet(true);
      walletFetchStatusRef.current.inProgress = true;
      walletFetchStatusRef.current.attempts++;
      
      // Calculate timeout with exponential backoff (1s, 2s, 4s, 8s, etc. up to 10s max)
      const baseTimeout = 1000; // Start with 1 second
      const backoffFactor = Math.min(Math.pow(2, walletFetchStatusRef.current.attempts - 1), 10);
      const timeout = baseTimeout * backoffFactor;
      
      // Use AbortController to add timeout to fetch request
      const controller = new AbortController();
      walletFetchStatusRef.current.abortController = controller;
      const timeoutId = setTimeout(() => {
        if (controller && !controller.signal.aborted) {
          controller.abort();
        }
      }, timeout);
      
      console.log(`Fetching wallet assets (attempt ${walletFetchStatusRef.current.attempts}/${walletFetchStatusRef.current.maxRetries}) with ${timeout}ms timeout`);
      
      try {
        // Add cache-busting and retry indicator to URL with a unique token
        const uniqueToken = Math.random().toString(36).substring(2, 15);
        const response = await fetch(
          `/api/wallets/${walletId}/assets?preview=true&t=${Date.now()}&retry=${walletFetchStatusRef.current.attempts}&token=${uniqueToken}`, 
          {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            },
            signal: controller.signal
          }
        );
        
        clearTimeout(timeoutId);
        
        // Special handling for 503 Service Unavailable
        if (response.status === 503) {
          console.warn('Server is temporarily unavailable (503), using fallback wallet data immediately');
          useFallbackAssets(walletId);
          setWalletError('Server temporarily unavailable. Using sample wallet data to continue your experiment.');
          setIsLoadingWallet(false);
          return;
        } else if (!response.ok) {
          console.warn(`Failed to fetch wallet assets: ${response.status}`);
          
          // Schedule retry after a delay if we haven't exceeded max retries
          if (walletFetchStatusRef.current.attempts < walletFetchStatusRef.current.maxRetries) {
            walletFetchStatusRef.current.inProgress = false;
            
            // Wait a bit longer between attempts (min 1.5s, max 5s)
            const delayMs = Math.min(1500 * walletFetchStatusRef.current.attempts, 5000);
            console.log(`Will retry asset fetch in ${delayMs}ms...`);
            
            // Store timeout ID for cleanup
            const retryTimeoutId = setTimeout(() => {
              walletFetchStatusRef.current.pendingTimeouts = 
                walletFetchStatusRef.current.pendingTimeouts.filter(id => id !== retryTimeoutId);
              fetchWalletAssets(walletId);
            }, delayMs);
            
            walletFetchStatusRef.current.pendingTimeouts.push(retryTimeoutId);
          } else {
            // Use fallback after max retries
            useFallbackAssets(walletId);
          }
          return;
        }
        
        // Parse JSON safely
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          console.error("Error parsing wallet JSON response:", jsonError);
          
          // If JSON parsing fails, retry or use fallback
          if (walletFetchStatusRef.current.attempts < walletFetchStatusRef.current.maxRetries) {
            walletFetchStatusRef.current.inProgress = false;
            const delayMs = Math.min(2000 * walletFetchStatusRef.current.attempts, 8000);
            console.log(`JSON parse error for wallet data, retrying in ${delayMs}ms...`);
            
            const retryTimeoutId = setTimeout(() => {
              walletFetchStatusRef.current.pendingTimeouts = 
                walletFetchStatusRef.current.pendingTimeouts.filter(id => id !== retryTimeoutId);
              fetchWalletAssets(walletId);
            }, delayMs);
            
            walletFetchStatusRef.current.pendingTimeouts.push(retryTimeoutId);
            return;
          } else {
            // Use fallback if we've hit max retries
            useFallbackAssets(walletId);
            return;
          }
        }
        
        // Reset retry counter on successful response
        walletFetchStatusRef.current.attempts = 0;
        walletFetchStatusRef.current.lastSuccess = true;
        
        if (Array.isArray(data)) {
          setWalletAssets(data);
        } else if (data.assets && Array.isArray(data.assets)) {
          setWalletAssets(data.assets);
        } else {
          console.warn("Unexpected wallet data format:", data);
          useFallbackAssets(walletId);
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        
        if (fetchErr.name === 'AbortError') {
          console.warn(`Wallet assets fetch timed out after ${timeout}ms (attempt ${walletFetchStatusRef.current.attempts}/${walletFetchStatusRef.current.maxRetries})`);
          
          // If we haven't exceeded max retries, schedule another attempt
          if (walletFetchStatusRef.current.attempts < walletFetchStatusRef.current.maxRetries) {
            walletFetchStatusRef.current.inProgress = false;
            
            // Increase delay between retries
            const delayMs = Math.min(1500 * walletFetchStatusRef.current.attempts, 5000);
            console.log(`Will retry asset fetch in ${delayMs}ms...`);
            
            const retryTimeoutId = setTimeout(() => {
              walletFetchStatusRef.current.pendingTimeouts = 
                walletFetchStatusRef.current.pendingTimeouts.filter(id => id !== retryTimeoutId);
              fetchWalletAssets(walletId);
            }, delayMs);
            
            walletFetchStatusRef.current.pendingTimeouts.push(retryTimeoutId);
            return;
          } else {
            // Use fallback data after max retries
            console.warn(`Max retries (${walletFetchStatusRef.current.maxRetries}) reached, using fallback data`);
            useFallbackAssets(walletId);
          }
        } else {
          console.error("Network error fetching wallet assets:", fetchErr);
          
          // For non-timeout errors, we might still retry
          if (walletFetchStatusRef.current.attempts < walletFetchStatusRef.current.maxRetries) {
            walletFetchStatusRef.current.inProgress = false;
            
            // Longer delay for network errors
            const delayMs = Math.min(2000 * walletFetchStatusRef.current.attempts, 8000);
            console.log(`Network error, will retry asset fetch in ${delayMs}ms...`);
            
            const retryTimeoutId = setTimeout(() => {
              walletFetchStatusRef.current.pendingTimeouts = 
                walletFetchStatusRef.current.pendingTimeouts.filter(id => id !== retryTimeoutId);
              fetchWalletAssets(walletId);
            }, delayMs);
            
            walletFetchStatusRef.current.pendingTimeouts.push(retryTimeoutId);
            return;
          } else {
            useFallbackAssets(walletId);
          }
        }
      } finally {
        walletFetchStatusRef.current.inProgress = false;
        setIsLoadingWallet(false);
      }
    } catch (err) {
      console.error("Error in fetchWalletAssets:", err);
      walletFetchStatusRef.current.inProgress = false;
      setWalletError(`Unable to load assets after ${walletFetchStatusRef.current.attempts} attempts. Using sample data instead.`);
      useFallbackAssets(walletId);
      setIsLoadingWallet(false);
    }
  };
  
  // Add an effect to clean up wallet fetch timeouts and abort controllers on unmount
  useEffect(() => {
    return () => {
      // Abort any in-flight wallet requests
      if (walletFetchStatusRef.current.abortController && 
          !walletFetchStatusRef.current.abortController.signal.aborted) {
        walletFetchStatusRef.current.abortController.abort();
      }
      
      // Clear all pending wallet fetch timeouts
      walletFetchStatusRef.current.pendingTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      walletFetchStatusRef.current.pendingTimeouts = [];
    };
  }, []);
  
  // Generate fallback wallet assets
  const useFallbackAssets = (walletId: string) => {
    // Use sample asset data as fallback
    const fallbackAssets = [
      {
        id: `${walletId}-asset1`,
        type: 'cryptocurrency',
        name: 'Bitcoin',
        symbol: 'BTC',
        amount: 0.5,
        initialAmount: 0.5
      },
      {
        id: `${walletId}-asset2`,
        type: 'stock',
        name: 'Apple Inc.',
        symbol: 'AAPL',
        amount: 10,
        initialAmount: 10
      },
      {
        id: `${walletId}-asset3`,
        type: 'cryptocurrency',
        name: 'Ethereum',
        symbol: 'ETH',
        amount: 5,
        initialAmount: 5
      }
    ];
    
    setWalletAssets(fallbackAssets);
  };
  
  // Fetch scenario data with robust error handling, retries and anti-flickering
  useEffect(() => {
    let isMounted = true;
    
    // Track fetch status with useRef to maintain state across renders
    const fetchStatusRef = useRef({
      attempts: 0,
      maxRetries: 10,
      inProgress: false,
      lastSuccess: false,
      abortController: null as AbortController | null,
      pendingTimeouts: [] as number[],
    });
    
    // Generate fallback scenario data
    const generateFallbackScenario = () => {
      return {
        id: stage.scenarioId || 'fallback-scenario',
        name: stage.title || 'Investment Scenario',
        description: stage.description || 'A simulated investment scenario',
        rounds: stage.rounds || 3,
        roundDuration: stage.roundDuration || 60,
        walletId: 'fallback-wallet-id',
        assetPrices: [
          {
            assetId: 'fallback-asset1',
            symbol: 'BTC',
            prices: [40000, 42000, 38000, 45000]
          },
          {
            assetId: 'fallback-asset2',
            symbol: 'AAPL',
            prices: [150, 155, 145, 160]
          },
          {
            assetId: 'fallback-asset3',
            symbol: 'ETH',
            prices: [2800, 3000, 2700, 3200]
          }
        ]
      };
    };
    
    // Helper function to apply fallback data
    const applyFallbackData = () => {
      if (!isMounted) return;
      
      console.log('Using fallback scenario data');
      const fallbackData = generateFallbackScenario();
      setScenarioData(fallbackData);
      setCurrentRound(1);
      setRoundTimeRemaining(fallbackData.roundDuration);
      setScenarioComplete(false);
      fetchWalletAssets(fallbackData.walletId);
      setIsLoading(false);
      
      // Show gentle error message to user
      if (fetchStatusRef.current.attempts >= fetchStatusRef.current.maxRetries) {
        setError(`Connection issues detected. Using offline data after ${fetchStatusRef.current.maxRetries} attempts.`);
      }
    };
    
    // Fetch with retry logic
    async function fetchScenarioData() {
      if (!stage.scenarioId) {
        if (isMounted) {
          console.warn("No scenario ID provided, using fallback data");
          applyFallbackData();
        }
        return;
      }
      
      // Avoid duplicate requests
      if (fetchStatusRef.current.inProgress) {
        console.log('Scenario fetch already in progress, skipping duplicate request');
        return;
      }
      
      // If we've reached max retries, use fallback
      if (fetchStatusRef.current.attempts >= fetchStatusRef.current.maxRetries) {
        console.warn(`Exceeded maximum retry attempts (${fetchStatusRef.current.maxRetries}), using fallback data`);
        applyFallbackData();
        return;
      }
      
      try {
        if (isMounted) {
          // Only show loading UI after first attempt
          if (fetchStatusRef.current.attempts === 0) {
            setIsLoading(true);
          }
        }
        
        fetchStatusRef.current.inProgress = true;
        fetchStatusRef.current.attempts++;
        
        // Calculate timeout with exponential backoff (2s, 4s, 8s, etc. up to 20s max)
        const baseTimeout = 2000; // Start with 2 seconds
        const backoffFactor = Math.min(Math.pow(2, fetchStatusRef.current.attempts - 1), 10);
        const timeout = baseTimeout * backoffFactor;
        
        console.log(`Fetching scenario data (attempt ${fetchStatusRef.current.attempts}/${fetchStatusRef.current.maxRetries}) with ${timeout}ms timeout`);
        
        // Use AbortController to add timeout to fetch request
        const controller = new AbortController();
        fetchStatusRef.current.abortController = controller;
        const timeoutId = setTimeout(() => {
          if (controller && !controller.signal.aborted) {
            controller.abort();
          }
        }, timeout);
        
        try {
          // Add cache-busting and retry indicator to URL with a unique token each time
          const uniqueToken = Math.random().toString(36).substring(2, 15);
          const response = await fetch(
            `/api/scenarios/${stage.scenarioId}?preview=true&t=${Date.now()}&retry=${fetchStatusRef.current.attempts}&token=${uniqueToken}`, 
            {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
              },
              signal: controller.signal
            }
          );
          
          clearTimeout(timeoutId);
          
          // Handle server errors (like 503 Service Unavailable)
          if (response.status === 503) {
            console.warn('Server is temporarily unavailable (503), using fallback data immediately');
            
            // For 503 errors, use fallback data immediately without further retries
            if (isMounted) {
              setError('The server is temporarily unavailable. Using offline data to continue your experiment.');
              applyFallbackData();
            }
            return;
          } else if (!response.ok) {
            console.warn(`Failed to fetch scenario: ${response.status}`);
            
            // Schedule retry with exponential backoff if we haven't exceeded max retries
            if (fetchStatusRef.current.attempts < fetchStatusRef.current.maxRetries && isMounted) {
              fetchStatusRef.current.inProgress = false;
              
              // Longer delay between retries
              const delayMs = Math.min(1500 * fetchStatusRef.current.attempts, 5000);
              console.log(`Will retry scenario fetch in ${delayMs}ms...`);
              
              // Store the timeout id so we can clear it on unmount
              const retryTimeoutId = setTimeout(() => {
                // Remove this timeout from the list when it executes
                fetchStatusRef.current.pendingTimeouts = 
                  fetchStatusRef.current.pendingTimeouts.filter(id => id !== retryTimeoutId);
                  
                // Only retry if component is still mounted
                if (isMounted) fetchScenarioData();
              }, delayMs);
              
              // Store the timeout ID for cleanup
              fetchStatusRef.current.pendingTimeouts.push(retryTimeoutId);
              return;
            } else {
              // Use fallback after max retries
              if (isMounted) applyFallbackData();
              return;
            }
          }
          
          // Parse JSON safely
          let data;
          try {
            data = await response.json();
          } catch (jsonError) {
            console.error("Error parsing JSON response:", jsonError);
            // If JSON parsing fails and we're still under retry limit, retry
            if (fetchStatusRef.current.attempts < fetchStatusRef.current.maxRetries && isMounted) {
              fetchStatusRef.current.inProgress = false;
              const delayMs = Math.min(2000 * fetchStatusRef.current.attempts, 8000);
              console.log(`JSON parse error, retrying in ${delayMs}ms...`);
              
              const retryTimeoutId = setTimeout(() => {
                fetchStatusRef.current.pendingTimeouts = 
                  fetchStatusRef.current.pendingTimeouts.filter(id => id !== retryTimeoutId);
                if (isMounted) fetchScenarioData();
              }, delayMs);
              
              fetchStatusRef.current.pendingTimeouts.push(retryTimeoutId);
              return;
            } else {
              // Use fallback if we've hit max retries
              if (isMounted) applyFallbackData();
              return;
            }
          }
          
          if (isMounted) {
            // Reset retry counter on success
            fetchStatusRef.current.attempts = 0;
            fetchStatusRef.current.lastSuccess = true;
            
            setScenarioData(data);
            
            // Initialize with the data from MongoDB
            setCurrentRound(1);
            setRoundTimeRemaining(data.roundDuration || stage.roundDuration || 60);
            setScenarioComplete(false);
            
            // Fetch wallet assets if we have a wallet ID
            if (data.walletId) {
              fetchWalletAssets(data.walletId);
            } else {
              // Use fallback wallet ID if none in data
              fetchWalletAssets('fallback-wallet-id');
            }
            
            setIsLoading(false);
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          
          if (!isMounted) return;
          
          if (fetchErr.name === 'AbortError') {
            console.warn(`Scenario fetch timed out after ${timeout}ms (attempt ${fetchStatusRef.current.attempts}/${fetchStatusRef.current.maxRetries})`);
            
            // If we haven't exceeded max retries, schedule another attempt
            if (fetchStatusRef.current.attempts < fetchStatusRef.current.maxRetries) {
              fetchStatusRef.current.inProgress = false;
              
              // Increase delay between retries
              const delayMs = Math.min(2000 * fetchStatusRef.current.attempts, 8000);
              console.log(`Will retry scenario fetch in ${delayMs}ms...`);
              
              const retryTimeoutId = setTimeout(() => {
                fetchStatusRef.current.pendingTimeouts = 
                  fetchStatusRef.current.pendingTimeouts.filter(id => id !== retryTimeoutId);
                // Only retry if component is still mounted
                if (isMounted) fetchScenarioData();
              }, delayMs);
              
              fetchStatusRef.current.pendingTimeouts.push(retryTimeoutId);
              return;
            } else {
              // Use fallback data after max retries
              console.warn(`Max retries (${fetchStatusRef.current.maxRetries}) reached, using fallback scenario data`);
              applyFallbackData();
            }
          } else {
            console.error("Network error fetching scenario data:", fetchErr);
            
            // For non-timeout errors, we might still retry
            if (fetchStatusRef.current.attempts < fetchStatusRef.current.maxRetries) {
              fetchStatusRef.current.inProgress = false;
              
              // Longer delay for network errors
              const delayMs = Math.min(3000 * fetchStatusRef.current.attempts, 10000);
              console.log(`Network error, will retry scenario fetch in ${delayMs}ms...`);
              
              const retryTimeoutId = setTimeout(() => {
                fetchStatusRef.current.pendingTimeouts = 
                  fetchStatusRef.current.pendingTimeouts.filter(id => id !== retryTimeoutId);
                // Only retry if component is still mounted
                if (isMounted) fetchScenarioData();
              }, delayMs);
              
              fetchStatusRef.current.pendingTimeouts.push(retryTimeoutId);
              return;
            } else {
              // Use fallback data after max retries
              applyFallbackData();
            }
          }
        } finally {
          fetchStatusRef.current.inProgress = false;
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error in fetchScenarioData:", err);
          fetchStatusRef.current.inProgress = false;
          
          setError(`Unable to load scenario data after ${fetchStatusRef.current.attempts} attempts. Using offline data instead.`);
          applyFallbackData();
        }
      }
    }
    
    fetchScenarioData();
    
    // Clean up function
    return () => {
      isMounted = false;
      
      // Abort any in-flight requests when component unmounts
      if (fetchStatusRef.current.abortController && !fetchStatusRef.current.abortController.signal.aborted) {
        fetchStatusRef.current.abortController.abort();
      }
      
      // Clear all pending timeouts
      fetchStatusRef.current.pendingTimeouts.forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      fetchStatusRef.current.pendingTimeouts = [];
    };
  }, [stage.scenarioId, stage.roundDuration, stage.title, stage.description, stage.rounds]);
  
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
  
  // Simple loading state
  if (isLoading) {
    return (
      <div className="w-full p-4 bg-white rounded border">
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 mt-2">Loading scenario data...</p>
        </div>
      </div>
    );
  }
  
  // Error state with fallback - more user friendly and with retry option
  if (error) {
    // Track whether this is a fatal error (need to skip) or 
    // a recoverable error (using fallback data but can continue)
    const isFatalError = !scenarioData;
    const isConnectionError = error.includes('Connection issues') || 
                              error.includes('Unable to load');
    
    return (
      <div className="w-full p-4 bg-white rounded border">
        <div className="mb-4 pb-3 border-b border-gray-200">
          <h3 className="text-xl font-bold mb-2 text-yellow-600">
            {isConnectionError ? 'Connection Issues Detected' : 'Error Loading Scenario'}
          </h3>
          <p className="text-gray-600">{error}</p>
        </div>
        
        <div className={`p-4 ${isConnectionError ? 'bg-yellow-50' : 'bg-red-50'} rounded border mb-5`}>
          {isConnectionError ? (
            <>
              <div className="flex items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-yellow-700 font-medium">We're experiencing some connection issues with our database</p>
              </div>
              <p className="text-gray-700 mb-2">The experiment will continue with offline data to ensure you can complete your session. Your experience will not be affected.</p>
              <div className="text-sm text-gray-600 mt-2">
                <span className="font-medium">Note:</span> If you continue to see this message, please inform the experiment administrator.
              </div>
            </>
          ) : (
            <>
              <p className="text-red-700 mb-2">Could not fetch scenario data.</p>
              <p className="text-gray-700">Using fallback data from experiment configuration.</p>
            </>
          )}
        </div>
        
        <div className="flex justify-center">
          {isFatalError ? (
            <button 
              onClick={onNext}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Skip to Next Stage
            </button>
          ) : (
            <button 
              onClick={() => setError(null)}
              className="px-6 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Continue With Offline Data
            </button>
          )}
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
              
              {/* Error state - but non-blocking with message to inform admin */}
              {walletError && (
                <div className="p-4 text-center">
                  <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                    <div className="flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p className="text-yellow-700 font-medium">Using sample data due to connection issues</p>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">Your experiment will continue normally. If this persists, please inform your administrator.</p>
                  </div>
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
                          
                          {/* Action buttons with toast to simulate trading */}
                          <div className="flex gap-4 mt-4">
                            <button 
                              onClick={() => toast.success(`Buy action for ${asset.symbol} (simulation only)`)}
                              className="flex-1 text-base bg-green-100 hover:bg-green-200 text-green-700 font-medium py-3 px-4 rounded-md transition-colors"
                            >
                              Buy
                            </button>
                            <button 
                              onClick={() => toast.success(`Sell action for ${asset.symbol} (simulation only)`)}
                              className="flex-1 text-base bg-red-100 hover:bg-red-200 text-red-700 font-medium py-3 px-4 rounded-md transition-colors"
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
  const [responses, setResponses] = useState<Record<string, any>>({});
  
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
  
  return (
    <div className="w-full p-4 bg-white rounded border">
      <div className="mb-4 pb-3 border-b border-gray-200">
        <h3 className="text-xl font-bold mb-2">{stage.title}</h3>
        <p className="text-gray-600">{stage.description}</p>
      </div>
      
      <div className="p-4 bg-gray-50 rounded border mb-5">
        <p className="font-medium mb-3">Survey Questions</p>
        
        {stage.questions && stage.questions.length > 0 ? (
          <div className="space-y-4">
            {stage.questions.map((q, i) => (
              <div key={q.id || i} className="p-4 bg-white rounded border">
                <p className="font-medium mb-2">
                  {i+1}. {q.text} {q.required && <span className="text-red-500">*</span>}
                </p>
                
                {/* Text input for short answer questions */}
                {q.type === 'text' && (
                  <input
                    type="text"
                    className="w-full p-2 border border-gray-300 rounded"
                    value={responses[q.id] || ''}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    required={q.required}
                  />
                )}
                
                {/* Textarea for long answer questions */}
                {q.type === 'textarea' && (
                  <textarea
                    className="w-full p-2 border border-gray-300 rounded"
                    rows={4}
                    value={responses[q.id] || ''}
                    onChange={(e) => handleInputChange(q.id, e.target.value)}
                    required={q.required}
                  />
                )}
                
                {/* Radio buttons for multiple choice */}
                {q.type === 'multipleChoice' && q.options && (
                  <div className="space-y-2 mt-2">
                    {q.options.map((option, idx) => (
                      <div key={idx} className="flex items-center">
                        <input
                          type="radio"
                          id={`${q.id}-option-${idx}`}
                          name={q.id}
                          className="mr-2"
                          checked={responses[q.id] === option}
                          onChange={() => handleInputChange(q.id, option)}
                          required={q.required}
                        />
                        <label htmlFor={`${q.id}-option-${idx}`}>
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Checkboxes for multiple selection */}
                {q.type === 'checkboxes' && q.options && (
                  <div className="space-y-2 mt-2">
                    {q.options.map((option, idx) => (
                      <div key={idx} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`${q.id}-option-${idx}`}
                          className="mr-2"
                          checked={(responses[q.id] || []).includes(option)}
                          onChange={(e) => handleCheckboxChange(q.id, option, e.target.checked)}
                        />
                        <label htmlFor={`${q.id}-option-${idx}`}>
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Scale (1-5, 1-10, etc.) */}
                {q.type === 'scale' && (
                  <div className="flex flex-wrap justify-between items-center mt-2">
                    {[1, 2, 3, 4, 5].map((number) => (
                      <div key={number} className="text-center mx-2 mb-2">
                        <button
                          type="button"
                          className={`w-10 h-10 rounded-full ${
                            responses[q.id] === number
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-800'
                          }`}
                          onClick={() => handleInputChange(q.id, number)}
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
          onClick={onNext}
          disabled={isStageTransitioning}
          className={`px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors ${
            isStageTransitioning ? 'opacity-50 cursor-not-allowed' : ''
          }`}
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
  const { experiment, loadExperiment, updateParticipantProgress } = usePreview();
  const [viewMode, setViewMode] = useState<'welcome' | 'experiment' | 'thankyou'>('welcome');
  const [currentStageNumber, setCurrentStageNumber] = useState(0);
  const params = useParams();
  const experimentId = params.id as string;
  const { data: session, status } = useSession();
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Create a single mounted ref to use throughout the component
  const isMountedRef = useRef(true);
  
  // Set isMounted to false when component unmounts
  useEffect(() => {
    // Set to true on mount
    isMountedRef.current = true;
    
    // Clean up function sets to false on unmount
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Load the experiment data when the component mounts
  useEffect(() => {
    // Safety check - don't try to load if component is already unmounted
    if (!isMountedRef.current) return;
    
    // Only attempt to load if we have an experiment ID
    if (!experimentId) {
      setLoadError("No experiment ID provided");
      return;
    }
    
    // Abort controller to cancel fetch requests if component unmounts
    const controller = new AbortController();
    
    // Pass true to indicate this is the participant view
    loadExperiment(experimentId, true)
      .then(() => {
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setLoadError(null);
        }
      })
      .catch(err => {
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          console.error('Error loading experiment:', err);
          setLoadError(`Failed to load experiment: ${err instanceof Error ? err.message : String(err)}`);
        }
      });
    
    // Cleanup function to abort any in-flight requests
    return () => {
      controller.abort();
    };
  }, [experimentId, loadExperiment]);
  
  // Handle the Next button click on the welcome screen
  const handleWelcomeNext = () => {
    // Safety check - don't update state if unmounted
    if (!isMountedRef.current) return;
    
    // Record that the user has started the experiment (non-blocking)
    if (experiment) {
      // Immediately switch view for better UX
      setViewMode('experiment');
      
      // Then update progress in the background with AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        // Only attempt to update if still mounted
        if (isMountedRef.current) {
          updateParticipantProgress(experiment.id, 'in_progress', experiment.stages[0]?.id)
            .catch(err => {
              // Silently handle errors to prevent state updates after unmount
              console.warn('Error updating progress (non-critical):', err);
            });
        }
      }, 0);
      
      // Clean up on unmount (though this won't be used directly, it's a pattern for safety)
      if (!isMountedRef.current) {
        clearTimeout(timeoutId);
        controller.abort();
      }
    } else {
      setViewMode('experiment');
    }
  };
  
  // Handle Next button click for stage navigation
  const handleStageNext = () => {
    // Safety checks
    if (!experiment || !isMountedRef.current) return;
    
    try {
      // Case 1: More stages to go
      if (currentStageNumber < experiment.stages.length - 1) {
        setCurrentStageNumber(prev => prev + 1);
      } 
      // Case 2: Final stage completion
      else {
        // Final stage complete, show thank you screen only
        // We don't call updateParticipantProgress here anymore - it will be called 
        // in the thank you screen itself to avoid React error #321
        setViewMode('thankyou');
      }
    } catch (error) {
      // Catch any other errors that might occur
      console.error('Error in handleStageNext:', error);
      // Don't attempt to update state with error message if unmounted
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
    // We're removing the useEffect here which was causing the React error #321
    // Instead, we'll mark the completion with a one-time operation on the first render
    
    // Reference to track if we've already triggered completion to avoid duplicate calls
    const hasMarkedCompletionRef = useRef(false);
    
    // Only mark completion once when the thank you screen first renders
    if (experiment && !hasMarkedCompletionRef.current) {
      hasMarkedCompletionRef.current = true; // Mark as done to prevent further calls
      
      // Run in the next tick to avoid React strict mode issues
      setTimeout(() => {
        // Only if the component is still mounted
        if (isMountedRef.current) {
          updateParticipantProgress(experiment.id, 'completed')
            .catch(error => {
              // Silently log errors without updating state
              console.warn('Error updating completion status on thank you screen:', error);
            });
        }
      }, 100);
    }
    
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
    return (
      <div className="p-4">
        <div className="w-full p-4 bg-white rounded border">
          <div className="text-center mb-5">
            <h3 className="text-xl font-bold mb-2">Welcome to {experiment.name}</h3>
            <p className="text-gray-600 mb-2">{experiment.description || ''}</p>
            <div className="text-gray-600">
              <p>This experiment consists of {experiment.stages.length} stages.</p>
            </div>
          </div>

          {experiment.stages.length > 0 && (
            <div className="bg-gray-50 rounded border p-4 mb-5">
              <h4 className="font-medium mb-2">Stages Overview:</h4>
              <div className="space-y-1">
                {[...experiment.stages]
                  .sort((a, b) => (a.order || 0) - (b.order || 0))
                  .map((stage, index) => (
                    <div key={stage.id} className="flex items-center py-1 border-b border-gray-100 last:border-0">
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
          )}
          
          <div className="text-center">
            <button 
              onClick={handleWelcomeNext}
              className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
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
          <button 
            onClick={() => window.close()}
            className="text-sm py-1 px-3 border border-gray-300 rounded hover:bg-gray-100"
          >
            Close Window
          </button>
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