'use client';

import { useCallback, useState, useEffect } from 'react';
import * as cache from '@/lib/cache';

/**
 * Custom hook for prefetching experiment data
 * Returns the prefetch function and status information
 */
export function usePrefetchExperiment() {
  const [status, setStatus] = useState<'idle' | 'prefetching' | 'success' | 'error'>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [prefetchedIds, setPrefetchedIds] = useState<string[]>([]);

  // Clear prefetch status when component unmounts
  useEffect(() => {
    return () => {
      setStatus('idle');
      setError(null);
    };
  }, []);

  /**
   * Function to prefetch experiment data
   * @param experimentId The experiment ID to prefetch
   * @param force Whether to force a fresh fetch even if data is in cache
   */
  const prefetchExperiment = useCallback(async (experimentId: string, force = false) => {
    if (!experimentId) return;

    try {
      // Already prefetched this experiment in this session
      if (prefetchedIds.includes(experimentId) && !force) {
        console.log(`Experiment ${experimentId} already prefetched`);
        return;
      }

      setStatus('prefetching');
      console.log(`Prefetching experiment ${experimentId}...`);

      // Use the cache module to prefetch and store data
      const result = await cache.cacheExperimentData(experimentId, force);

      if (result.success) {
        setStatus('success');
        
        // Add to the list of prefetched IDs to avoid duplicate prefetches
        setPrefetchedIds(prev => {
          if (prev.includes(experimentId)) return prev;
          return [...prev, experimentId];
        });

        console.log(`Successfully prefetched experiment ${experimentId}`);

        // Prefetch all scenario data for this experiment
        if (result.experiment?.stages && Array.isArray(result.experiment.stages)) {
          // Use setTimeout to avoid blocking the UI
          setTimeout(() => {
            result.experiment.stages.forEach((stage: any) => {
              if (stage?.type === 'scenario' && stage?.scenarioId) {
                console.log(`Prefetching scenario data for ${stage.scenarioId}...`);
                cache.getCachedScenarioData(stage.scenarioId, force)
                  .then((scenarioResult) => {
                    if (scenarioResult.success && scenarioResult.scenario?.walletId) {
                      // Also prefetch wallet data
                      cache.getCachedWalletAssets(scenarioResult.scenario.walletId, force)
                        .catch(err => console.warn(`Error prefetching wallet data: ${err.message}`));
                    }
                  })
                  .catch(err => console.warn(`Error prefetching scenario data: ${err.message}`));
              }
            });
          }, 500);
        }
      } else {
        throw new Error('Failed to prefetch experiment data');
      }
    } catch (err) {
      console.error('Error prefetching experiment:', err);
      setStatus('error');
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [prefetchedIds]);

  /**
   * Function to check if experiment data is already in the cache
   */
  const isExperimentCached = useCallback((experimentId: string): boolean => {
    return cache.has(`experiment:${experimentId}`);
  }, []);

  /**
   * Function to get cache stats
   */
  const getCacheStats = useCallback(() => {
    return cache.stats();
  }, []);

  return {
    prefetchExperiment,
    isExperimentCached,
    getCacheStats,
    prefetchStatus: status,
    prefetchError: error,
    prefetchedIds
  };
}