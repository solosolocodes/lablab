'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/Button';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Type definitions
type AssetPrice = {
  assetId: string;
  symbol: string;
  prices: number[];
};

type Scenario = {
  id: string;
  name: string;
  description: string;
  walletId: string;
  rounds: number;
  roundDuration: number;
  assetPrices: AssetPrice[];
  isActive: boolean;
  createdAt: string;
};

type Wallet = {
  id: string;
  name: string;
  description: string;
  assets: {
    _id?: string;
    type: string;
    name: string;
    symbol: string;
    amount: number;
    initialAmount: number;
  }[];
};

export default function ScenariosPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    walletId: '',
    rounds: 10,
    roundDuration: 30,
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
        
        // Fetch wallets
        const walletsResponse = await fetch('/api/wallets');
        if (!walletsResponse.ok) {
          throw new Error('Failed to fetch wallets');
        }
        
        const walletsData = await walletsResponse.json();
        setWallets(walletsData);
        
        // Fetch scenarios
        const scenariosResponse = await fetch('/api/scenarios');
        if (!scenariosResponse.ok) {
          throw new Error('Failed to fetch scenarios');
        }
        
        const scenariosData = await scenariosResponse.json();
        setScenarios(scenariosData);
        
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

  // Filter scenarios based on search query and active filter
  const filteredScenarios = scenarios.filter(scenario => {
    const matchesSearch = 
      scenario.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch;
    if (activeFilter === 'active') return matchesSearch && scenario.isActive;
    if (activeFilter === 'inactive') return matchesSearch && !scenario.isActive;
    
    return matchesSearch;
  });

  // Open scenario modal
  const openScenarioModal = (type: 'create' | 'edit' | 'view', scenario?: Scenario) => {
    setModalType(type);
    setIsModalOpen(true);
    
    // Reset form data
    setFormData({
      name: '',
      description: '',
      walletId: '',
      rounds: 10,
      roundDuration: 30,
    });
    
    // If editing or viewing, set the form data
    if ((type === 'edit' || type === 'view') && scenario) {
      setSelectedScenario(scenario);
      setFormData({
        name: scenario.name,
        description: scenario.description,
        walletId: scenario.walletId,
        rounds: scenario.rounds,
        roundDuration: scenario.roundDuration,
      });
    }
  };

  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (formData.name.length < 3) {
      toast.error('Scenario name must be at least 3 characters');
      return;
    }
    if (formData.description.length < 10) {
      toast.error('Description must be at least 10 characters');
      return;
    }
    if (!formData.walletId) {
      toast.error('Please select a wallet');
      return;
    }
    if (formData.rounds < 1 || formData.rounds > 50) {
      toast.error('Number of rounds must be between 1 and 50');
      return;
    }
    if (formData.roundDuration < 0.1 || formData.roundDuration > 300) {
      toast.error('Round duration must be between 0.1 and 300 seconds');
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    
    if (modalType === 'create') {
      try {
        // Create loading state
        toast.loading('Creating scenario...', { id: 'create-scenario' });
        
        // Create the scenario
        const response = await fetch('/api/scenarios', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            walletId: formData.walletId,
            rounds: formData.rounds,
            roundDuration: formData.roundDuration,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to create scenario');
        }
        
        const responseData = await response.json();
        
        // Add new scenario to state
        setScenarios([...scenarios, responseData.scenario]);
        toast.success('Scenario created successfully', { id: 'create-scenario' });
        
        // After creating, navigate to the edit scenario page
        router.push(`/admin/scenarios/${responseData.scenario.id}`);
      } catch (error) {
        console.error('Error creating scenario:', error);
        toast.error('Failed to create scenario: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'create-scenario' });
        setIsSubmitting(false);
        return; // Don't close the modal
      }
    } 
    else if (modalType === 'edit' && selectedScenario) {
      try {
        // Loading state
        toast.loading('Updating scenario...', { id: 'edit-scenario' });
        
        // Update the scenario
        const response = await fetch('/api/scenarios', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: selectedScenario.id,
            name: formData.name,
            description: formData.description,
            walletId: formData.walletId,
            rounds: formData.rounds,
            roundDuration: formData.roundDuration,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to update scenario');
        }
        
        const responseData = await response.json();
        
        // Update scenario in state
        const updatedScenarios = scenarios.map(scenario => 
          scenario.id === selectedScenario.id 
            ? responseData.scenario
            : scenario
        );
        setScenarios(updatedScenarios);
        toast.success('Scenario updated successfully', { id: 'edit-scenario' });
      } catch (error) {
        console.error('Error updating scenario:', error);
        toast.error('Failed to update scenario: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'edit-scenario' });
        setIsSubmitting(false);
        return; // Don't close the modal
      }
    }
    
    // Close modal
    setIsModalOpen(false);
    setSelectedScenario(null);
    setIsSubmitting(false);
  };
  
  // Toggle scenario active status
  const toggleScenarioStatus = async (scenario: Scenario) => {
    try {
      // Loading state
      toast.loading(`${scenario.isActive ? 'Deactivating' : 'Activating'} scenario...`, { id: `toggle-scenario-${scenario.id}` });
      
      // Update the scenario
      const response = await fetch('/api/scenarios', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          isActive: !scenario.isActive,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update scenario status');
      }
      
      const responseData = await response.json();
      
      // Update scenario in state
      const updatedScenarios = scenarios.map(s => 
        s.id === scenario.id 
          ? responseData.scenario
          : s
      );
      setScenarios(updatedScenarios);
      toast.success(`Scenario ${scenario.isActive ? 'deactivated' : 'activated'} successfully`, { id: `toggle-scenario-${scenario.id}` });
    } catch (error) {
      console.error('Error toggling scenario status:', error);
      toast.error('Failed to update scenario status: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: `toggle-scenario-${scenario.id}` });
    }
  };

  // Delete a scenario
  const deleteScenario = async (scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return;
    
    if (!confirm(`Are you sure you want to delete the scenario "${scenario.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Start loading
      toast.loading('Deleting scenario...', { id: `delete-scenario-${scenarioId}` });
      
      // Send delete request to API
      const response = await fetch(`/api/scenarios?id=${scenarioId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete scenario');
      }
      
      // Remove from local state
      setScenarios(scenarios.filter(s => s.id !== scenarioId));
      
      // Show success message
      toast.success('Scenario deleted successfully', { id: `delete-scenario-${scenarioId}` });
    } catch (error) {
      console.error('Error deleting scenario:', error);
      toast.error(
        'Failed to delete scenario: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        { id: `delete-scenario-${scenarioId}` }
      );
    }
  };

  // Format duration in a readable way
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds} sec`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m${remainingSeconds > 0 ? ` ${remainingSeconds}s` : ''}`;
  };

  // Get wallet name by ID
  const getWalletName = (walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId);
    return wallet ? wallet.name : 'Unknown Wallet';
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
                <Link href="/admin/user-groups" className="px-3 py-2 rounded hover:bg-purple-600">User Groups</Link>
                <Link href="/admin/wallets" className="px-3 py-2 rounded hover:bg-purple-600">Wallets</Link>
                <Link href="/admin/scenarios" className="px-3 py-2 rounded bg-purple-600">Scenarios</Link>
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
          <h1 className="text-2xl font-bold text-gray-800">Scenario Management</h1>
        </div>
        
        {/* Search and Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-lg shadow mb-6">
          <div className="mb-4 md:mb-0 md:w-1/2">
            <div className="relative">
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Search scenarios..."
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
                className={`px-3 py-2 text-sm ${activeFilter === 'all' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
                onClick={() => setActiveFilter('all')}
              >
                All
              </button>
              <button 
                className={`px-3 py-2 text-sm ${activeFilter === 'active' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
                onClick={() => setActiveFilter('active')}
              >
                Active
              </button>
              <button 
                className={`px-3 py-2 text-sm ${activeFilter === 'inactive' ? 'bg-purple-600 text-white' : 'text-gray-600'}`}
                onClick={() => setActiveFilter('inactive')}
              >
                Inactive
              </button>
            </div>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2"
              onClick={() => openScenarioModal('create')}
            >
              Create Scenario
            </Button>
          </div>
        </div>
        
        {/* Scenarios Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wallet
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rounds
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredScenarios.map((scenario) => (
                <tr key={scenario.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{scenario.name}</div>
                        <div className="text-xs text-gray-500">{scenario.description.length > 50 ? scenario.description.substring(0, 50) + '...' : scenario.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{getWalletName(scenario.walletId)}</div>
                    <div className="text-xs text-gray-500">{scenario.assetPrices.length} assets</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{scenario.rounds}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDuration(scenario.roundDuration)} / round</div>
                    <div className="text-xs text-gray-500">Total: {formatDuration(scenario.rounds * scenario.roundDuration)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      scenario.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {scenario.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => openScenarioModal('view', scenario)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="View Scenario"
                    >
                      View
                    </button>
                    <Link 
                      href={`/admin/scenarios/${scenario.id}`}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                      title="Edit Prices"
                    >
                      Prices
                    </Link>
                    <button 
                      onClick={() => toggleScenarioStatus(scenario)}
                      className={`${scenario.isActive ? 'text-yellow-600 hover:text-yellow-900' : 'text-green-600 hover:text-green-900'} mr-3`}
                      title={scenario.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {scenario.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button 
                      onClick={() => deleteScenario(scenario.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete Scenario"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredScenarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No scenarios found. Create a new scenario to get started.
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
      
      {/* Scenario Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {modalType === 'create' ? 'Create Scenario' : 
                 modalType === 'edit' ? 'Edit Scenario' : 'View Scenario'}
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
                  Scenario Name
                </label>
                <input
                  type="text"
                  id="name"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  minLength={3}
                  maxLength={50}
                  placeholder="Enter scenario name (3-50 characters)"
                  disabled={modalType === 'view'}
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
                  maxLength={200}
                  placeholder="Enter scenario description (10-200 characters)"
                  disabled={modalType === 'view'}
                />
                {formData.description && formData.description.length < 10 && (
                  <p className="text-red-500 text-xs mt-1">Description must be at least 10 characters</p>
                )}
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="walletId">
                  Wallet
                </label>
                <select
                  id="walletId"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={formData.walletId}
                  onChange={(e) => setFormData({ ...formData, walletId: e.target.value })}
                  required
                  disabled={modalType === 'view' || modalType === 'edit'} // Cannot change wallet after creation
                >
                  <option value="">-- Select Wallet --</option>
                  {wallets.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name} ({wallet.assets.length} assets)
                    </option>
                  ))}
                </select>
                {modalType === 'edit' && (
                  <p className="text-yellow-500 text-xs mt-1">Wallet cannot be changed after scenario creation</p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="rounds">
                    Number of Rounds
                  </label>
                  <input
                    type="number"
                    id="rounds"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={formData.rounds}
                    onChange={(e) => setFormData({ ...formData, rounds: parseInt(e.target.value) })}
                    required
                    min={1}
                    max={50}
                    disabled={modalType === 'view' || modalType === 'edit'} // Cannot change rounds after creation
                  />
                  {modalType === 'edit' && (
                    <p className="text-yellow-500 text-xs mt-1">Rounds cannot be changed after creation</p>
                  )}
                </div>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="roundDuration">
                    Round Duration (sec)
                  </label>
                  <input
                    type="number"
                    id="roundDuration"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={formData.roundDuration}
                    onChange={(e) => setFormData({ ...formData, roundDuration: parseFloat(e.target.value) })}
                    required
                    min={0.1}
                    max={300}
                    step={0.1}
                    disabled={modalType === 'view'}
                  />
                </div>
              </div>
              
              {modalType !== 'view' && (
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
                        {modalType === 'create' ? 'Creating...' : 'Saving...'}
                      </span>
                    ) : (
                      modalType === 'create' ? 'Create Scenario' : 'Save Changes'
                    )}
                  </Button>
                </div>
              )}
              
              {modalType === 'view' && (
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Close
                  </Button>
                  <Link href={`/admin/scenarios/${selectedScenario?.id}`}>
                    <Button
                      type="button"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Edit Prices
                    </Button>
                  </Link>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}