'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function IndexRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.push('/login');
  }, [router]);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md text-center">
        <h2 className="text-2xl font-semibold mb-4">Redirecting...</h2>
        <p className="text-gray-600">
          Please wait while we redirect you to the login page.
        </p>
        <div className="mt-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-purple-500 border-r-transparent"></div>
      </div>
    </div>
  );
}