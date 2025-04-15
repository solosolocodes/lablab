'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import { toast } from 'react-hot-toast';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const isLoading = status === 'loading';
  const [dashboardData, setDashboardData] = useState<{
    analytics: {
      activeUsers: number;
      totalUsers: number;
      experimentsRun: number;
      activeExperiments: number;
      completedExperiments: number;
      userGroups: number;
      scenarios: number;
      completionRate: number;
      averageParticipantsPerExperiment: number;
      surveyResponses: number;
    };
    activeExperiments: Array<{
      id: string;
      name: string;
      status: string;
      participants: number;
      stages: number;
      progress: number;
    }>;
  } | null>(null);
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    // If not authenticated or not an admin, redirect to login
    if (!isLoading && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, isLoading, router]);
  
  useEffect(() => {
    // Fetch dashboard data when session is loaded
    if (session && session.user.role === 'admin') {
      fetchDashboardData();
    }
  }, [session]);
  
  const fetchDashboardData = async () => {
    try {
      setIsDataLoading(true);
      const response = await fetch('/api/dashboard');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
      }
      
      const data = await response.json();
      setDashboardData(data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'admin') {
    return null; // Will redirect via useEffect
  }
  
  if (isDataLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }
  
  // Use real data from API if available, otherwise fallback to defaults
  const analyticsData = dashboardData?.analytics || {
    activeUsers: 0,
    totalUsers: 0,
    experimentsRun: 0,
    activeExperiments: 0,
    completedExperiments: 0, 
    userGroups: 0,
    scenarios: 0,
    completionRate: 0,
    averageParticipantsPerExperiment: 0,
    surveyResponses: 0
  };

  // Use real experiments data if available
  const activeExperiments = dashboardData?.activeExperiments || [];

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-purple-700 text-white shadow-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">LabLab Admin</h1>
              <div className="hidden md:flex space-x-4">
                <Link href="/admin/dashboard" className="px-3 py-2 rounded bg-purple-600">Dashboard</Link>
                <Link href="/admin/experiments" className="px-3 py-2 rounded hover:bg-purple-600">Experiments</Link>
                <Link href="/admin/scenarios" className="px-3 py-2 rounded hover:bg-purple-600">Scenarios</Link>
                <Link href="/admin/surveys" className="px-3 py-2 rounded hover:bg-purple-600">Surveys</Link>
                <Link href="/admin/wallets" className="px-3 py-2 rounded hover:bg-purple-600">Wallets</Link>
                <Link href="/admin/user-groups" className="px-3 py-2 rounded hover:bg-purple-600">User Groups</Link>
                <Link href="/reports" className="px-3 py-2 rounded hover:bg-purple-600">Reporting</Link>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm hidden md:inline-block">
                {session.user.email}
              </span>
              <button
                onClick={handleSignOut}
                className="bg-purple-800 hover:bg-purple-900 px-3 py-1 rounded text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        {/* Analytics Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3 text-gray-700">Analytics Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-purple-500 text-3xl font-bold">{analyticsData.activeUsers}</div>
              <div className="text-gray-500 text-sm">Active Users</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-blue-500 text-3xl font-bold">{analyticsData.activeExperiments}</div>
              <div className="text-gray-500 text-sm">Active Experiments</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-green-500 text-3xl font-bold">{analyticsData.completionRate}%</div>
              <div className="text-gray-500 text-sm">Completion Rate</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-amber-500 text-3xl font-bold">{analyticsData.averageParticipantsPerExperiment}</div>
              <div className="text-gray-500 text-sm">Avg. Participants</div>
            </div>
          </div>
          
          {/* Additional Analytics in single row */}
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-3">
            <div className="bg-white rounded-lg shadow p-3">
              <div className="text-indigo-500 text-xl font-bold">{analyticsData.experimentsRun}</div>
              <div className="text-gray-500 text-xs">Total Experiments</div>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <div className="text-teal-500 text-xl font-bold">{analyticsData.completedExperiments}</div>
              <div className="text-gray-500 text-xs">Completed</div>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <div className="text-pink-500 text-xl font-bold">{analyticsData.surveyResponses}</div>
              <div className="text-gray-500 text-xs">Survey Responses</div>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <div className="text-cyan-500 text-xl font-bold">{analyticsData.totalUsers}</div>
              <div className="text-gray-500 text-xs">Total Users</div>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <div className="text-rose-500 text-xl font-bold">{analyticsData.scenarios}</div>
              <div className="text-gray-500 text-xs">Scenarios</div>
            </div>
            <div className="bg-white rounded-lg shadow p-3">
              <div className="text-orange-500 text-xl font-bold">{analyticsData.userGroups}</div>
              <div className="text-gray-500 text-xs">User Groups</div>
            </div>
          </div>
        </div>

        {/* Active Experiments */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold text-gray-700">Active Experiments</h2>
            <Link href="/admin/experiments">
              <Button className="text-sm py-1 px-3 bg-purple-600 hover:bg-purple-700">
                View All
              </Button>
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeExperiments.length > 0 ? (
                  activeExperiments.map((experiment) => (
                    <tr key={experiment.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{experiment.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          experiment.status === 'active' || experiment.status === 'published'
                            ? 'bg-green-100 text-green-800' 
                            : experiment.status === 'draft'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                        }`}>
                          {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {experiment.participants}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                            <div 
                              className="bg-purple-600 h-2.5 rounded-full" 
                              style={{ width: `${experiment.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">{experiment.progress}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/admin/experiments/${experiment.id}`} className="text-purple-600 hover:text-purple-900">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                      No active experiments found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Link href="/admin/experiments" className="block">
            <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 mr-4">
                  <svg className="h-6 w-6 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Experiments</h3>
                  <p className="text-gray-500 text-sm">Create and manage experiments</p>
                </div>
              </div>
            </div>
          </Link>
          
          <Link href="/admin/scenarios" className="block">
            <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 mr-4">
                  <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Scenarios</h3>
                  <p className="text-gray-500 text-sm">Organize test scenarios</p>
                </div>
              </div>
            </div>
          </Link>
          
          <Link href="/admin/wallets" className="block">
            <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100 mr-4">
                  <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Wallets</h3>
                  <p className="text-gray-500 text-sm">Manage participant payments</p>
                </div>
              </div>
            </div>
          </Link>
          
          <Link href="/admin/user-groups" className="block">
            <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-amber-100 mr-4">
                  <svg className="h-6 w-6 text-amber-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">User Groups</h3>
                  <p className="text-gray-500 text-sm">Organize participants</p>
                </div>
              </div>
            </div>
          </Link>
        </div>
        
        {/* Surveys and Reporting Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Link href="/admin/surveys" className="block">
            <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-pink-100 mr-4">
                  <svg className="h-6 w-6 text-pink-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Surveys</h3>
                  <p className="text-gray-500 text-sm">View participant survey responses</p>
                </div>
              </div>
            </div>
          </Link>
          
          <Link href="/reports" className="block">
            <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-indigo-100 mr-4">
                  <svg className="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Reporting</h3>
                  <p className="text-gray-500 text-sm">Export and analyze experiment data</p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white py-4 shadow-inner">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} LabLab Platform. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}