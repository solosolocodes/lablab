'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/Button';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Type definitions
type Experiment = {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  userGroups: {
    userGroupId: string;
    condition: string;
    maxParticipants?: number;
  }[];
  stageCount: number;
  createdAt: string;
  updatedAt: string;
  lastEditedAt: string;
};

type UserGroup = {
  id: string;
  name: string;
  description: string;
  users: {
    id: string;
    name: string;
    email: string;
  }[];
};

export default function ExperimentsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Using "_" prefix to signal this state is meant to be unused in this context
  // but we're keeping it for future functionality
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_selectedExperiment, _setSelectedExperiment] = useState<Experiment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    userGroups: [] as { userGroupId: string; condition: string; maxParticipants?: number }[],
  });

  // Redirect if not admin
  useEffect(() => {
    if (status !== 'loading' && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Create loading state
        toast.loading('Loading data...', { id: 'loading-data' });
        
        // Fetch experiments in parallel with user groups
        const [experimentsResponse, userGroupsResponse] = await Promise.all([
          fetch('/api/experiments'),
          fetch('/api/user-groups')
        ]);
        
        if (!experimentsResponse.ok) {
          throw new Error('Failed to fetch experiments');
        }
        
        if (!userGroupsResponse.ok) {
          throw new Error('Failed to fetch user groups');
        }
        
        const experiments = await experimentsResponse.json();
        const userGroups = await userGroupsResponse.json();
        
        setExperiments(experiments);
        setUserGroups(userGroups);
        
        // Dismiss loading toast
        toast.success('Data loaded successfully', { id: 'loading-data' });
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'loading-data' });
      }
    };
    
    if (status === 'authenticated') {
      fetchData();
    }
  }, [status]);

  // Filter experiments based on search query and status filter
  const filteredExperiments = experiments.filter(experiment => {
    const matchesSearch = 
      experiment.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      experiment.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && experiment.status === statusFilter;
  });

  // Open experiment creation modal
  const openExperimentModal = () => {
    setIsModalOpen(true);
    _setSelectedExperiment(null);
    setFormData({
      name: '',
      description: '',
      userGroups: [],
    });
  };

  // Add a user group to the experiment
  const addUserGroup = (userGroupId: string) => {
    // Check if user group is already added
    if (formData.userGroups.some(group => group.userGroupId === userGroupId)) {
      toast.error('This user group is already added to the experiment');
      return;
    }
    
    // Add user group with default condition
    setFormData({
      ...formData,
      userGroups: [
        ...formData.userGroups,
        { userGroupId, condition: 'default' }
      ]
    });
  };

  // Remove a user group from the experiment
  const removeUserGroup = (userGroupId: string) => {
    setFormData({
      ...formData,
      userGroups: formData.userGroups.filter(group => group.userGroupId !== userGroupId)
    });
  };

  // Update user group condition
  const updateUserGroupCondition = (userGroupId: string, condition: string) => {
    setFormData({
      ...formData,
      userGroups: formData.userGroups.map(group => 
        group.userGroupId === userGroupId 
          ? { ...group, condition } 
          : group
      )
    });
  };

  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (formData.name.length < 3) {
      toast.error('Experiment name must be at least 3 characters');
      return;
    }
    if (formData.description.length < 10) {
      toast.error('Description must be at least 10 characters');
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    
    try {
      // Create loading state
      toast.loading('Creating experiment...', { id: 'create-experiment' });
      
      // Create the experiment
      const response = await fetch('/api/experiments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          userGroups: formData.userGroups,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create experiment');
      }
      
      const responseData = await response.json();
      
      // Add new experiment to state
      setExperiments([...experiments, responseData.experiment]);
      toast.success('Experiment created successfully', { id: 'create-experiment' });
      
      // After creating, navigate to the experiment designer page
      router.push(`/admin/experiments/${responseData.experiment.id}/designer`);
    } catch (error) {
      console.error('Error creating experiment:', error);
      toast.error('Failed to create experiment: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'create-experiment' });
      setIsSubmitting(false);
      return; // Don't close the modal
    }
    
    // Close modal
    setIsModalOpen(false);
    setIsSubmitting(false);
  };

  // Publish an experiment
  const publishExperiment = async (experimentId: string) => {
    const experiment = experiments.find(e => e.id === experimentId);
    if (!experiment) return;
    
    if (!confirm(`Are you sure you want to publish the experiment "${experiment.name}"? This will make it active and visible to participants in the selected user groups.`)) {
      return;
    }
    
    try {
      // Start loading
      toast.loading('Publishing experiment...', { id: `publish-experiment-${experimentId}` });
      
      // Send publish request to API (updating status to 'active')
      const response = await fetch(`/api/experiments/${experimentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...experiment,
          status: 'active',
          lastEditedAt: new Date().toISOString()
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to publish experiment');
      }
      
      // Update in local state
      setExperiments(experiments.map(exp => 
        exp.id === experimentId 
          ? { ...exp, status: 'active' }
          : exp
      ));
      
      // Show success message
      toast.success('Experiment published successfully', { id: `publish-experiment-${experimentId}` });
    } catch (error) {
      console.error('Error publishing experiment:', error);
      toast.error(
        'Failed to publish experiment: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        { id: `publish-experiment-${experimentId}` }
      );
    }
  };

  // Delete an experiment
  const deleteExperiment = async (experimentId: string) => {
    const experiment = experiments.find(e => e.id === experimentId);
    if (!experiment) return;
    
    if (!confirm(`Are you sure you want to delete the experiment "${experiment.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Start loading
      toast.loading('Deleting experiment...', { id: `delete-experiment-${experimentId}` });
      
      // Send delete request to API
      const response = await fetch(`/api/experiments?id=${experimentId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete experiment');
      }
      
      // Remove from local state
      setExperiments(experiments.filter(exp => exp.id !== experimentId));
      
      // Show success message
      toast.success('Experiment deleted successfully', { id: `delete-experiment-${experimentId}` });
    } catch (error) {
      console.error('Error deleting experiment:', error);
      toast.error(
        'Failed to delete experiment: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        { id: `delete-experiment-${experimentId}` }
      );
    }
  };

  // Format date in a readable way
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get user group name by ID
  const getUserGroupName = (userGroupId: string) => {
    const userGroup = userGroups.find(group => group.id === userGroupId);
    return userGroup ? userGroup.name : 'Unknown Group';
  };

  // Get status badge classes
  const getStatusBadgeClasses = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'paused':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Check if user is authenticated and is admin
  if (!session || session.user.role !== 'admin') {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-purple-700 text-white shadow-md">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link href="/admin/dashboard" className="text-xl font-bold">LabLab Admin</Link>
              <div className="hidden md:flex space-x-4">
                <Link href="/admin/dashboard" className="px-3 py-2 rounded hover:bg-purple-600">Dashboard</Link>
                <Link href="/admin/experiments" className="px-3 py-2 rounded bg-purple-600">Experiments</Link>
                <Link href="/admin/scenarios" className="px-3 py-2 rounded hover:bg-purple-600">Scenarios</Link>
                <Link href="/admin/wallets" className="px-3 py-2 rounded hover:bg-purple-600">Wallets</Link>
                <Link href="/admin/user-groups" className="px-3 py-2 rounded hover:bg-purple-600">User Groups</Link>
                <Link href="#" className="px-3 py-2 rounded hover:bg-purple-600">Reporting</Link>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-sm hidden md:inline-block">
                {session.user.email}
              </span>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="flex-grow container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Experiment Management</h1>
        </div>
        
        {/* Search and Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-lg shadow mb-6">
          <div className="mb-4 md:mb-0 md:w-1/2">
            <div className="relative">
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Search experiments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="absolute left-3 top-2.5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            <div className="flex bg-gray-100 rounded-lg overflow-hidden mr-2">
              <button 
                className={`px-3 py-2 text-sm ${statusFilter === 'all' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
                onClick={() => setStatusFilter('all')}
              >
                All
              </button>
              <button 
                className={`px-3 py-2 text-sm ${statusFilter === 'draft' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
                onClick={() => setStatusFilter('draft')}
              >
                Draft
              </button>
              <button 
                className={`px-3 py-2 text-sm ${statusFilter === 'active' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
                onClick={() => setStatusFilter('active')}
              >
                Active
              </button>
              <button 
                className={`px-3 py-2 text-sm ${statusFilter === 'completed' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
                onClick={() => setStatusFilter('completed')}
              >
                Completed
              </button>
            </div>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2"
              onClick={openExperimentModal}
            >
              Create Experiment
            </Button>
          </div>
        </div>
        
        {/* Experiments Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User Groups
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExperiments.map((experiment) => (
                <tr key={experiment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{experiment.name}</div>
                        <div className="text-xs text-gray-500">{experiment.description.length > 50 ? experiment.description.substring(0, 50) + '...' : experiment.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {experiment.userGroups.length > 0 
                        ? experiment.userGroups.map(group => getUserGroupName(group.userGroupId)).join(', ')
                        : 'No groups assigned'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {experiment.userGroups.length} {experiment.userGroups.length === 1 ? 'group' : 'groups'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{experiment.stageCount}</div>
                    <div className="text-xs text-gray-500">{experiment.stageCount === 1 ? 'stage' : 'stages'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusBadgeClasses(experiment.status)}`}>
                      {experiment.status.charAt(0).toUpperCase() + experiment.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(experiment.lastEditedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      href={`/admin/experiments/${experiment.id}/designer`}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                      title="Design Experiment"
                    >
                      Design
                    </Link>
                    <Link
                      href={`/admin/experiments/${experiment.id}`}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="View Experiment"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/experiments/${experiment.id}/preview`}
                      className="text-green-600 hover:text-green-900 mr-3"
                      title="Preview Experiment"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Preview
                    </Link>
                    {experiment.status !== 'active' && (
                      <button
                        onClick={() => publishExperiment(experiment.id)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                        title="Publish Experiment"
                      >
                        Publish
                      </button>
                    )}
                    <button 
                      onClick={() => deleteExperiment(experiment.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Experiment"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredExperiments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No experiments found. Create a new experiment to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
      
      {/* Create Experiment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                Create New Experiment
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleFormSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                  Experiment Name
                </label>
                <input
                  type="text"
                  id="name"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  minLength={3}
                  maxLength={100}
                  placeholder="Enter experiment name (3-100 characters)"
                />
                {formData.name && formData.name.length < 3 && (
                  <p className="text-red-500 text-xs mt-1">Name must be at least 3 characters</p>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="description">
                  Description
                </label>
                <textarea
                  id="description"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  required
                  minLength={10}
                  maxLength={500}
                  placeholder="Enter experiment description (10-500 characters)"
                />
                {formData.description && formData.description.length < 10 && (
                  <p className="text-red-500 text-xs mt-1">Description must be at least 10 characters</p>
                )}
              </div>
              
              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  User Groups (Optional)
                </label>
                
                {formData.userGroups.length > 0 ? (
                  <div className="space-y-2 mb-2">
                    {formData.userGroups.map(group => {
                      const userGroup = userGroups.find(ug => ug.id === group.userGroupId);
                      return (
                        <div key={group.userGroupId} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                          <div>
                            <div className="text-sm font-medium">{userGroup?.name || 'Unknown Group'}</div>
                            <div className="flex items-center">
                              <span className="text-xs text-gray-500 mr-2">Condition:</span>
                              <input
                                type="text"
                                className="text-xs py-1 px-2 border rounded w-28"
                                value={group.condition}
                                onChange={(e) => updateUserGroupCondition(group.userGroupId, e.target.value)}
                                placeholder="condition"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeUserGroup(group.userGroupId)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm mb-2">No user groups added. You can add them now or later.</p>
                )}
                
                <div className="mt-2">
                  <select
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        addUserGroup(e.target.value);
                        e.target.value = '';  // Reset select after adding
                      }
                    }}
                  >
                    <option value="">-- Add a User Group --</option>
                    {userGroups.map(group => (
                      <option 
                        key={group.id} 
                        value={group.id}
                        disabled={formData.userGroups.some(g => g.userGroupId === group.id)}
                      >
                        {group.name} ({group.users.length} users)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    'Create Experiment'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}