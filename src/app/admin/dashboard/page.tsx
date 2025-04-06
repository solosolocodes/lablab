'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoading = status === 'loading';

  useEffect(() => {
    // If not authenticated or not an admin, redirect to login
    if (!isLoading && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, isLoading, router]);

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'admin') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-600">Admin Dashboard</h1>
          <Button
            variant="outline"
            className="text-red-600 border-red-600 hover:bg-red-50"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Welcome, {session.user.name}!</h2>
          <div className="space-y-2">
            <p><span className="font-medium">Email:</span> {session.user.email}</p>
            <p><span className="font-medium">Role:</span> Administrator</p>
            <p><span className="font-medium">User ID:</span> {session.user.id}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="h-2 bg-purple-500"></div>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-3">Studies</h3>
              <p className="text-gray-600 mb-4">Manage research studies and experiments.</p>
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                Manage Studies
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="h-2 bg-indigo-500"></div>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-3">Participants</h3>
              <p className="text-gray-600 mb-4">View and manage participant data.</p>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                Manage Participants
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="h-2 bg-pink-500"></div>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-3">Analytics</h3>
              <p className="text-gray-600 mb-4">View study results and analytics.</p>
              <Button className="w-full bg-pink-600 hover:bg-pink-700">
                View Analytics
              </Button>
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