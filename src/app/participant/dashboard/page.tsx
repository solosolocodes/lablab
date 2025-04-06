'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Button from '@/components/Button';

export default function ParticipantDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoading = status === 'loading';

  useEffect(() => {
    // If not authenticated or not a participant, redirect to login
    if (!isLoading && (!session || session.user.role !== 'participant')) {
      router.push('/participant/login');
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

  if (!session || session.user.role !== 'participant') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm py-4">
        <div className="container mx-auto px-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">Participant Dashboard</h1>
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
            <p><span className="font-medium">Role:</span> Participant</p>
            <p><span className="font-medium">User ID:</span> {session.user.id}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="h-2 bg-blue-500"></div>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-3">My Studies</h3>
              <p className="text-gray-600 mb-4">You are not enrolled in any studies yet.</p>
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Browse Available Studies
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="h-2 bg-green-500"></div>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-3">My Progress</h3>
              <p className="text-gray-600 mb-4">Track your participation and progress here.</p>
              <Button className="w-full bg-green-600 hover:bg-green-700">
                View Progress
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