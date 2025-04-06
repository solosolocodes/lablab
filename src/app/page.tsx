'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoading = status === 'loading';

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect if already logged in (to appropriate dashboard based on role)
  if (session) {
    const isAdmin = session.user.role === 'admin';
    router.push(isAdmin ? '/admin/dashboard' : '/participant/dashboard');
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-6">
          <h1 className="text-3xl font-bold text-blue-600">LabLab Platform</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-800 mb-4">Welcome to LabLab</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A secure platform for participants and administrators to collaborate on research projects.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
          {/* Participant Card */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all hover:scale-105">
            <div className="h-2 bg-blue-500"></div>
            <div className="p-8">
              <div className="flex items-center justify-center mb-6">
                <div className="rounded-full bg-blue-100 p-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-center text-gray-800 mb-4">Participant Access</h3>
              <p className="text-gray-600 mb-8 text-center">
                Join research studies, track your progress, and contribute to groundbreaking research.
              </p>
              <div className="space-y-3">
                <Link href="/participant/login" 
                  className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-md font-medium transition-colors">
                  Log In as Participant
                </Link>
                <Link href="/participant/register"
                  className="block w-full text-center bg-white hover:bg-gray-50 text-blue-600 border border-blue-600 py-3 px-4 rounded-md font-medium transition-colors">
                  Register as Participant
                </Link>
              </div>
            </div>
          </div>

          {/* Admin Card */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all hover:scale-105">
            <div className="h-2 bg-purple-500"></div>
            <div className="p-8">
              <div className="flex items-center justify-center mb-6">
                <div className="rounded-full bg-purple-100 p-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-center text-gray-800 mb-4">Administrator Access</h3>
              <p className="text-gray-600 mb-8 text-center">
                Manage research projects, monitor participant data, and analyze results.
              </p>
              <div className="space-y-3">
                <Link href="/admin/login"
                  className="block w-full text-center bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-md font-medium transition-colors">
                  Log In as Admin
                </Link>
                <Link href="/admin/register"
                  className="block w-full text-center bg-white hover:bg-gray-50 text-purple-600 border border-purple-600 py-3 px-4 rounded-md font-medium transition-colors">
                  Register as Admin
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white py-6 shadow-inner">
        <div className="container mx-auto px-6">
          <p className="text-center text-gray-600">
            © {new Date().getFullYear()} LabLab Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}