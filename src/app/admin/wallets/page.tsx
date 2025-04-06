'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/Button';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Type definitions
type Asset = {
  _id?: string;
  type: string;
  name: string;
  symbol: string;
  amount: number;
  initialAmount: number;
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type Wallet = {
  id: string;
  name: string;
  description: string;
  assets: Asset[];
  scenarioId?: string;
  createdAt: string;
};

export default function WalletsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  // State for users - no longer needed since we removed owner requirement
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [assetModalType, setAssetModalType] = useState<'create' | 'edit'>('create');
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [assetFormData, setAssetFormData] = useState<Asset>({
    type: 'cryptocurrency',
    name: '',
    symbol: '',
    amount: 0,
    initialAmount: 0,
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
        
        // No longer need to fetch users since we removed owner requirement
        
        // Fetch wallets
        const walletsResponse = await fetch('/api/wallets');
        if (!walletsResponse.ok) {
          throw new Error('Failed to fetch wallets');
        }
        
        const wallets = await walletsResponse.json();
        setWallets(wallets);
        
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

  // Filter wallets based on search query
  const filteredWallets = wallets.filter(wallet => 
    wallet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    wallet.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Open wallet modal
  const openWalletModal = (type: 'create' | 'edit', wallet?: Wallet) => {
    setModalType(type);
    setIsModalOpen(true);
    
    // Reset form data
    setFormData({
      name: '',
      description: '',
    });
    
    // If editing, set the form data
    if (type === 'edit' && wallet) {
      setSelectedWallet(wallet);
      setFormData({
        name: wallet.name,
        description: wallet.description,
      });
    }
  };

  // Open asset modal
  const openAssetModal = (walletId: string, type: 'create' | 'edit', asset?: Asset) => {
    setAssetModalType(type);
    setIsAssetModalOpen(true);
    
    // Find the wallet
    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) return;
    
    setSelectedWallet(wallet);
    
    // Reset asset form data
    setAssetFormData({
      type: 'fiat',
      name: '',
      symbol: '',
      amount: 0,
      initialAmount: 0,
    });
    
    // If editing, set the form data
    if (type === 'edit' && asset) {
      setSelectedAsset(asset);
      setAssetFormData({
        type: asset.type,
        name: asset.name,
        symbol: asset.symbol,
        amount: asset.amount,
        initialAmount: asset.initialAmount,
      });
    }
  };

  // Handle wallet form submission
  const handleWalletFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (formData.name.length < 3) {
      toast.error('Wallet name must be at least 3 characters');
      return;
    }
    if (formData.description.length < 10) {
      toast.error('Description must be at least 10 characters');
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    
    if (modalType === 'create') {
      try {
        // Create loading state
        toast.loading('Creating wallet...', { id: 'create-wallet' });
        
        // Create the wallet in MongoDB
        const response = await fetch('/api/wallets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to create wallet');
        }
        
        const responseData = await response.json();
        
        // Add new wallet to state
        setWallets([...wallets, responseData.wallet]);
        toast.success('Wallet created successfully', { id: 'create-wallet' });
      } catch (error) {
        console.error('Error creating wallet:', error);
        toast.error('Failed to create wallet: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'create-wallet' });
        setIsSubmitting(false);
        return; // Don't close the modal
      }
    } 
    else if (modalType === 'edit' && selectedWallet) {
      try {
        // Loading state
        toast.loading('Updating wallet...', { id: 'edit-wallet' });
        
        // Update the wallet in MongoDB
        const response = await fetch('/api/wallets', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: selectedWallet.id,
            name: formData.name,
            description: formData.description,
            assets: selectedWallet.assets,
            scenarioId: selectedWallet.scenarioId,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to update wallet');
        }
        
        const responseData = await response.json();
        
        // Update wallet in state
        const updatedWallets = wallets.map(wallet => 
          wallet.id === selectedWallet.id 
            ? responseData.wallet
            : wallet
        );
        setWallets(updatedWallets);
        toast.success('Wallet updated successfully', { id: 'edit-wallet' });
      } catch (error) {
        console.error('Error updating wallet:', error);
        toast.error('Failed to update wallet: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'edit-wallet' });
        setIsSubmitting(false);
        return; // Don't close the modal
      }
    }
    
    // Close modal
    setIsModalOpen(false);
    setSelectedWallet(null);
    setIsSubmitting(false);
  };

  // Handle asset form submission
  const handleAssetFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!assetFormData.name) {
      toast.error('Asset name is required');
      return;
    }
    if (!assetFormData.symbol) {
      toast.error('Asset symbol is required');
      return;
    }
    if (assetFormData.amount < 0) {
      toast.error('Asset amount cannot be negative');
      return;
    }
    
    // Set loading state
    setIsSubmitting(true);
    
    if (assetModalType === 'create' && selectedWallet) {
      try {
        // Create loading state
        toast.loading('Adding asset...', { id: 'add-asset' });
        
        // Ensure initialAmount matches amount for new assets
        const assetToAdd = {
          ...assetFormData,
          initialAmount: assetFormData.initialAmount || assetFormData.amount,
        };
        
        // Add the asset to the wallet
        const response = await fetch('/api/wallets/assets', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletId: selectedWallet.id,
            asset: assetToAdd,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to add asset');
        }
        
        const responseData = await response.json();
        
        // Update wallet in state
        const updatedWallets = wallets.map(wallet => 
          wallet.id === selectedWallet.id 
            ? responseData.wallet
            : wallet
        );
        setWallets(updatedWallets);
        toast.success('Asset added successfully', { id: 'add-asset' });
      } catch (error) {
        console.error('Error adding asset:', error);
        toast.error('Failed to add asset: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'add-asset' });
        setIsSubmitting(false);
        return; // Don't close the modal
      }
    } 
    else if (assetModalType === 'edit' && selectedWallet && selectedAsset && selectedAsset._id) {
      try {
        // Loading state
        toast.loading('Updating asset...', { id: 'edit-asset' });
        
        // Update the asset in the wallet
        const response = await fetch('/api/wallets/assets', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletId: selectedWallet.id,
            assetId: selectedAsset._id,
            asset: assetFormData,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to update asset');
        }
        
        const responseData = await response.json();
        
        // Update wallet in state
        const updatedWallets = wallets.map(wallet => 
          wallet.id === selectedWallet.id 
            ? responseData.wallet
            : wallet
        );
        setWallets(updatedWallets);
        toast.success('Asset updated successfully', { id: 'edit-asset' });
      } catch (error) {
        console.error('Error updating asset:', error);
        toast.error('Failed to update asset: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'edit-asset' });
        setIsSubmitting(false);
        return; // Don't close the modal
      }
    }
    
    // Close modal
    setIsAssetModalOpen(false);
    setSelectedWallet(null);
    setSelectedAsset(null);
    setIsSubmitting(false);
  };

  // Delete a wallet
  const deleteWallet = async (walletId: string) => {
    const wallet = wallets.find(w => w.id === walletId);
    if (!wallet) return;
    
    if (!confirm(`Are you sure you want to delete the wallet "${wallet.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Start loading
      toast.loading('Deleting wallet...', { id: `delete-wallet-${walletId}` });
      
      // Send delete request to API
      const response = await fetch(`/api/wallets?id=${walletId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete wallet');
      }
      
      // Remove from local state
      setWallets(wallets.filter(wallet => wallet.id !== walletId));
      
      // Show success message
      toast.success('Wallet deleted successfully', { id: `delete-wallet-${walletId}` });
    } catch (error) {
      console.error('Error deleting wallet:', error);
      toast.error(
        'Failed to delete wallet: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        { id: `delete-wallet-${walletId}` }
      );
    }
  };

  // Delete an asset
  const deleteAsset = async (walletId: string, assetId: string) => {
    const wallet = wallets.find(w => w.id === walletId);
    const asset = wallet?.assets.find(a => a._id === assetId);
    
    if (!wallet || !asset) return;
    
    if (!confirm(`Are you sure you want to delete the asset "${asset.name} (${asset.symbol})" from this wallet?`)) {
      return;
    }
    
    try {
      // Start loading
      toast.loading('Deleting asset...', { id: `delete-asset-${assetId}` });
      
      // Send delete request to API
      const response = await fetch(`/api/wallets/assets?walletId=${walletId}&assetId=${assetId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete asset');
      }
      
      // Update wallet in state by removing the asset
      const updatedWallets = wallets.map(wallet => {
        if (wallet.id === walletId) {
          return {
            ...wallet,
            assets: wallet.assets.filter(a => a._id !== assetId)
          };
        }
        return wallet;
      });
      
      setWallets(updatedWallets);
      
      // Show success message
      toast.success('Asset deleted successfully', { id: `delete-asset-${assetId}` });
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast.error(
        'Failed to delete asset: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        { id: `delete-asset-${assetId}` }
      );
    }
  };

  // Get asset icon based on type
  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'share':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
      case 'cryptocurrency':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'fiat':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'commodity':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        );
      case 'bond':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'real_estate':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        );
      case 'collectible':
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        );
    }
  };

  // Get type label
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'share':
        return 'Share';
      case 'cryptocurrency':
        return 'Crypto';
      case 'fiat':
        return 'Fiat';
      case 'commodity':
        return 'Commodity';
      case 'bond':
        return 'Bond';
      case 'real_estate':
        return 'Real Estate';
      case 'collectible':
        return 'Collectible';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
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
                <Link href="/admin/user-groups" className="px-3 py-2 rounded hover:bg-purple-600">User Groups</Link>
                <Link href="/admin/wallets" className="px-3 py-2 rounded bg-purple-600">Wallets</Link>
                <Link href="#" className="px-3 py-2 rounded hover:bg-purple-600">Experiments</Link>
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
          <h1 className="text-2xl font-bold text-gray-800">Wallet Management</h1>
        </div>
        
        {/* Search and Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-lg shadow mb-6">
          <div className="mb-4 md:mb-0 md:w-1/2">
            <div className="relative">
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Search wallets..."
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
            <Button 
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2"
              onClick={() => openWalletModal('create')}
            >
              Create Wallet
            </Button>
          </div>
        </div>
        
        {/* Wallets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWallets.map((wallet) => (
            <div key={wallet.id} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">{wallet.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{wallet.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => openWalletModal('edit', wallet)}
                      className="text-indigo-600 hover:text-indigo-900 p-1"
                      title="Edit Wallet"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button 
                      onClick={() => deleteWallet(wallet.id)}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="Delete Wallet"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center mt-3 text-sm">
                  <div className="text-gray-500">
                    Created: {new Date(wallet.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              {/* Assets List */}
              <div>
                <div className="px-4 py-2 bg-gray-50 border-b flex justify-between items-center">
                  <h4 className="font-medium text-gray-700">Assets ({wallet.assets.length})</h4>
                  <button 
                    onClick={() => openAssetModal(wallet.id, 'create')}
                    className="text-xs bg-green-100 text-green-800 hover:bg-green-200 px-2 py-1 rounded"
                  >
                    Add Asset
                  </button>
                </div>
                
                {wallet.assets.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {wallet.assets.map((asset) => (
                      <div key={asset._id} className="px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                            asset.type === 'share' ? 'bg-blue-100 text-blue-600' :
                            asset.type === 'cryptocurrency' ? 'bg-purple-100 text-purple-600' :
                            asset.type === 'fiat' ? 'bg-green-100 text-green-600' :
                            asset.type === 'commodity' ? 'bg-yellow-100 text-yellow-600' :
                            asset.type === 'bond' ? 'bg-indigo-100 text-indigo-600' :
                            asset.type === 'real_estate' ? 'bg-pink-100 text-pink-600' :
                            asset.type === 'collectible' ? 'bg-amber-100 text-amber-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {getAssetIcon(asset.type)}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium">{asset.name}</div>
                            <div className="text-xs text-gray-500 flex items-center">
                              <span className="mr-2">{asset.symbol}</span>
                              <span className="bg-gray-100 text-gray-600 px-1 rounded-sm text-xs">
                                {getTypeLabel(asset.type)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div className="text-right mr-4">
                            <div className="text-sm font-medium">{asset.amount.toLocaleString()}</div>
                            <div className="text-xs text-gray-500">
                              Initial: {asset.initialAmount.toLocaleString()}
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            <button 
                              onClick={() => openAssetModal(wallet.id, 'edit', asset)}
                              className="text-indigo-600 hover:text-indigo-900 p-1"
                              title="Edit Asset"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => deleteAsset(wallet.id, asset._id as string)}
                              className="text-red-600 hover:text-red-900 p-1"
                              title="Delete Asset"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-gray-500 text-center">
                    No assets added yet
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {filteredWallets.length === 0 && (
            <div className="col-span-full bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-500">No wallets found. Create a new wallet to get started.</p>
            </div>
          )}
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
      
      {/* Wallet Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {modalType === 'create' ? 'Create Wallet' : 'Edit Wallet'}
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
            
            <form onSubmit={handleWalletFormSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                  Wallet Name
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
                  placeholder="Enter wallet name (3-50 characters)"
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
                  placeholder="Enter wallet description (10-200 characters)"
                />
                {formData.description && formData.description.length < 10 && (
                  <p className="text-red-500 text-xs mt-1">Description must be at least 10 characters</p>
                )}
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
                      {modalType === 'create' ? 'Creating...' : 'Saving...'}
                    </span>
                  ) : (
                    modalType === 'create' ? 'Create Wallet' : 'Save Changes'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Asset Modal */}
      {isAssetModalOpen && selectedWallet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {assetModalType === 'create' ? 'Add Asset to Wallet' : 'Edit Asset'}
              </h2>
              <button 
                onClick={() => setIsAssetModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleAssetFormSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="assetType">
                  Asset Type
                </label>
                <select
                  id="assetType"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={assetFormData.type}
                  onChange={(e) => setAssetFormData({ ...assetFormData, type: e.target.value })}
                  required
                >
                  <option value="fiat">Fiat Currency</option>
                  <option value="cryptocurrency">Cryptocurrency</option>
                  <option value="share">Share</option>
                  <option value="commodity">Commodity</option>
                  <option value="bond">Bond</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="collectible">Collectible</option>
                </select>
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="assetName">
                  Asset Name
                </label>
                <input
                  type="text"
                  id="assetName"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={assetFormData.name}
                  onChange={(e) => setAssetFormData({ ...assetFormData, name: e.target.value })}
                  required
                  placeholder={
                    assetFormData.type === 'fiat' ? 'e.g., US Dollar' :
                    assetFormData.type === 'cryptocurrency' ? 'e.g., Bitcoin' :
                    'e.g., Apple Inc.'
                  }
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="assetSymbol">
                  Symbol
                </label>
                <input
                  type="text"
                  id="assetSymbol"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={assetFormData.symbol}
                  onChange={(e) => setAssetFormData({ ...assetFormData, symbol: e.target.value })}
                  required
                  placeholder={
                    assetFormData.type === 'fiat' ? 'e.g., USD' :
                    assetFormData.type === 'cryptocurrency' ? 'e.g., BTC' :
                    'e.g., AAPL'
                  }
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="assetAmount">
                  Amount
                </label>
                <input
                  type="number"
                  id="assetAmount"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  value={assetFormData.amount}
                  onChange={(e) => setAssetFormData({ ...assetFormData, amount: parseFloat(e.target.value) })}
                  required
                  min="0"
                  step={assetFormData.type === 'share' ? '1' : '0.01'}
                />
              </div>
              
              {assetModalType === 'edit' && (
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="assetInitialAmount">
                    Initial Amount
                  </label>
                  <input
                    type="number"
                    id="assetInitialAmount"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    value={assetFormData.initialAmount}
                    onChange={(e) => setAssetFormData({ ...assetFormData, initialAmount: parseFloat(e.target.value) })}
                    required
                    min="0"
                    step={assetFormData.type === 'share' ? '1' : '0.01'}
                  />
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800"
                  onClick={() => setIsAssetModalOpen(false)}
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
                      {assetModalType === 'create' ? 'Adding...' : 'Updating...'}
                    </span>
                  ) : (
                    assetModalType === 'create' ? 'Add Asset' : 'Update Asset'
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