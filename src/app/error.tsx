'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-red-600 mb-2">Something went wrong!</h1>
          <div className="bg-red-50 border border-red-200 rounded-md p-4 my-4 text-left">
            <p className="text-red-700 font-medium">Error details:</p>
            <p className="text-red-600 text-sm mt-1 break-all">{error.message || 'Unknown error'}</p>
            {error.digest && (
              <p className="text-red-500 text-xs mt-2">Error ID: {error.digest}</p>
            )}
          </div>
          <div className="flex flex-col space-y-3 items-center mt-4">
            <button
              onClick={() => reset()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}