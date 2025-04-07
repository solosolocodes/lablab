'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function CatchAllPage() {
  const pathname = usePathname();

  useEffect(() => {
    // Log 404 error to console or analytics
    console.error(`404 error: Path not found: ${pathname}`);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-6xl font-bold text-purple-600 mb-2">404</h1>
          <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
          <p className="text-gray-600 mb-6">
            The page you are looking for doesn&apos;t exist or has been moved.
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6 text-left">
            <p className="text-gray-700 font-medium">Requested path:</p>
            <p className="text-gray-600 break-all mt-1">{pathname}</p>
          </div>
          <div className="flex flex-col space-y-3 items-center">
            <Link
              href="/"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md transition-colors"
            >
              Return Home
            </Link>
            <button 
              onClick={() => window.history.back()}
              className="px-4 py-2 text-purple-600 hover:text-purple-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}