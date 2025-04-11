'use client';

import { useEffect, useState } from 'react';
import { debug } from '@/lib/debug';

/**
 * Debug Monitor Component
 * Displays debug information and environment variables in development mode
 * Only renders when debug mode is enabled
 */
export default function DebugMonitor() {
  const [isVisible, setIsVisible] = useState(false);
  const [envInfo, setEnvInfo] = useState<Record<string, string>>({});
  const [logCount, setLogCount] = useState(0);

  useEffect(() => {
    // Only run in debug mode
    if (!debug.isEnabled) return;

    // Collect environment information
    const env = {
      'Node Environment': process.env.NODE_ENV || 'unknown',
      'Debug Mode': debug.isEnabled ? 'Enabled' : 'Disabled',
      'Vercel Environment': process.env.VERCEL_ENV || 'local',
      'Build ID': process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'local',
    };
    
    setEnvInfo(env);

    // Intercept console logs to count them
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalConsoleInfo = console.info;

    let count = 0;
    
    console.log = function(...args) {
      count++;
      setLogCount(count);
      originalConsoleLog.apply(console, args);
    };
    
    console.error = function(...args) {
      count++;
      setLogCount(count);
      originalConsoleError.apply(console, args);
    };
    
    console.warn = function(...args) {
      count++;
      setLogCount(count);
      originalConsoleWarn.apply(console, args);
    };
    
    console.info = function(...args) {
      count++;
      setLogCount(count);
      originalConsoleInfo.apply(console, args);
    };

    // Restore original console methods on cleanup
    return () => {
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      console.info = originalConsoleInfo;
    };
  }, []);

  // Only render in debug mode
  if (!debug.isEnabled) return null;

  // Toggle visibility
  const toggleVisibility = () => setIsVisible(!isVisible);

  return (
    <div className="fixed bottom-0 right-0 z-50">
      {/* Debug icon button */}
      <button 
        onClick={toggleVisibility}
        className="bg-yellow-500 text-black p-2 m-2 rounded-full shadow-lg flex items-center justify-center"
        title="Debug Monitor"
      >
        <span className="text-xs font-mono font-bold">{logCount}</span>
        <span className="ml-1">🐞</span>
      </button>

      {/* Debug panel */}
      {isVisible && (
        <div className="bg-black/90 text-green-400 p-4 m-2 rounded shadow-lg font-mono text-xs w-80 max-h-96 overflow-auto">
          <h3 className="font-bold mb-2">Debug Monitor</h3>
          
          <div className="mb-4">
            <h4 className="text-yellow-400 mb-1">Environment</h4>
            <ul>
              {Object.entries(envInfo).map(([key, value]) => (
                <li key={key} className="flex justify-between">
                  <span>{key}:</span>
                  <span className="font-bold">{value}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="mb-2">
            <h4 className="text-yellow-400 mb-1">Console Output</h4>
            <p>{logCount} log entries</p>
          </div>
          
          <button 
            onClick={() => console.clear()} 
            className="bg-red-800 text-white px-2 py-1 rounded text-xs"
          >
            Clear Console
          </button>
        </div>
      )}
    </div>
  );
}