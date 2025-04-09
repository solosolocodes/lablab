'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Button from '@/components/Button';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

// Type definitions
type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type UserGroup = {
  id: string;
  name: string;
  description: string;
  users: User[];
  experimentsCount: number;
  createdAt: string;
};

export default function UserGroupsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'groups' | 'users'>('groups');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'createUser' | 'createGroup' | 'editGroup' | 'editUser' | ''>('');
  const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    description: '',
    groupId: '',
  });

  // Redirect if not admin
  useEffect(() => {
    if (status !== 'loading' && (!session || session.user.role !== 'admin')) {
      router.push('/admin/login');
    }
  }, [session, status, router]);

  // We no longer need the dummy data since we're using real MongoDB data
  // This code is kept as reference but not used
  /*
  const generateDummyUserGroups = (): UserGroup[] => {
    const generateId = () => Math.random().toString(36).substring(2, 10);
    const groups: UserGroup[] = [
      {
        id: 'grp-' + generateId(),
        name: 'Cognitive Testing Group',
        description: 'Participants for cognitive response studies',
        experimentsCount: 3,
        createdAt: '2025-01-15T10:30:00Z',
        users: []
      },
      {
        id: 'grp-' + generateId(),
        name: 'Memory Research',
        description: 'Participants for memory-based experiments',
        experimentsCount: 2,
        createdAt: '2025-02-10T14:45:00Z',
        users: []
      },
      {
        id: 'grp-' + generateId(),
        name: 'Visual Perception Study',
        description: 'Group for visual perception tests',
        experimentsCount: 1,
        createdAt: '2025-03-05T09:15:00Z',
        users: []
      },
      {
        id: 'grp-' + generateId(),
        name: 'Decision Making Research',
        description: 'Participants for decision-making studies',
        experimentsCount: 4,
        createdAt: '2025-03-20T16:30:00Z',
        users: []
      },
    ];

    return groups;
  };
  */
  
  // We no longer need the dummy users since we're fetching from MongoDB
  // This function is kept as reference but commented out
  /*
  const generateDummyUsers = (): User[] => {
    const generateId = () => Math.random().toString(36).substring(2, 10);
    const names = [
      'Emma Johnson', 'Liam Smith', 'Olivia Williams', 'Noah Brown', 'Ava Jones',
      'Sophia Garcia', 'Jackson Miller', 'Isabella Davis', 'Lucas Rodriguez', 'Mia Martinez'
    ];
    
    return names.map((name, index) => {
      const id = 'usr-' + generateId();
      const email = `participant${index + 1}@lablab.com`;
      
      return {
        id,
        name,
        email,
        role: 'participant',
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString()
      };
    });
  };
  */

  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  
  // Initialize data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Create loading state (could also use a loading state variable)
        toast.loading('Loading data...', { id: 'loading-data' });
        
        // Fetch participants from API
        const usersResponse = await fetch('/api/users?role=participant');
        if (!usersResponse.ok) {
          throw new Error('Failed to fetch participants');
        }
        
        const participants = await usersResponse.json();
        setAllUsers(participants);
        
        // Fetch actual user groups from API
        const groupsResponse = await fetch('/api/user-groups');
        if (!groupsResponse.ok) {
          throw new Error('Failed to fetch user groups');
        }
        
        const groups = await groupsResponse.json();
        setUserGroups(groups);
        
        // Dismiss loading toast
        toast.success('Data loaded successfully', { id: 'loading-data' });
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load data: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'loading-data' });
      }
    };
    
    fetchData();
  }, []);

  // Filter groups based on search query
  const filteredGroups = userGroups.filter(group => 
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.id.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Filter users based on search query
  const filteredUsers = allUsers.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle modal open
  const openModal = (type: 'createUser' | 'createGroup' | 'editGroup' | 'editUser', item?: UserGroup | User) => {
    setModalType(type);
    setIsModalOpen(true);
    
    // Reset form data
    setFormData({
      name: '',
      email: '',
      description: '',
      groupId: '',
    });
    
    // If editing, set the form data
    if (type === 'editGroup' && item && 'users' in item) {
      const group = item as UserGroup;
      setSelectedGroup(group);
      setFormData({
        ...formData,
        name: group.name,
        description: group.description,
      });
    } else if (type === 'editUser' && item && !('users' in item)) {
      const user = item as User;
      setSelectedUser(user);
      setFormData({
        ...formData,
        name: user.name,
        email: user.email,
      });
    }
  };
  
  // Handle form submission
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (modalType === 'createGroup' || modalType === 'editGroup') {
      if (formData.name.length < 3) {
        toast.error('Group name must be at least 3 characters');
        return;
      }
      if (formData.description.length < 10) {
        toast.error('Description must be at least 10 characters');
        return;
      }
    } else if (modalType === 'createUser' || modalType === 'editUser') {
      if (formData.name.length < 2) {
        toast.error('Name must be at least 2 characters');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        toast.error('Please enter a valid email address');
        return;
      }
    }
    
    // Set loading state
    setIsSubmitting(true);
    
    const generateId = () => Math.random().toString(36).substring(2, 10);
    
    if (modalType === 'createGroup') {
      try {
        // Create loading state
        toast.loading('Creating group...', { id: 'create-group' });
        
        // Create the group in MongoDB
        const response = await fetch('/api/user-groups', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            description: formData.description,
            users: [],
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to create group');
        }
        
        const responseData = await response.json();
        
        // Add new group to state
        setUserGroups([...userGroups, responseData.group]);
        toast.success('Group created successfully', { id: 'create-group' });
      } catch (error) {
        console.error('Error creating group:', error);
        toast.error('Failed to create group: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'create-group' });
        return; // Don't close the modal
      }
    } 
    else if (modalType === 'editGroup' && selectedGroup) {
      try {
        // Loading state
        toast.loading('Updating group...', { id: 'edit-group' });
        
        // Get selected user IDs
        const selectedUserIds = selectedGroup.users.map(user => user.id);
        
        // Update the group in MongoDB
        const response = await fetch('/api/user-groups', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: selectedGroup.id,
            name: formData.name,
            description: formData.description,
            users: selectedUserIds,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to update group');
        }
        
        const responseData = await response.json();
        
        // Update group in state
        const updatedGroups = userGroups.map(group => 
          group.id === selectedGroup.id 
            ? responseData.group
            : group
        );
        setUserGroups(updatedGroups);
        toast.success('Group updated successfully', { id: 'edit-group' });
      } catch (error) {
        console.error('Error updating group:', error);
        toast.error('Failed to update group: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'edit-group' });
        return; // Don't close the modal
      }
    }
    else if (modalType === 'createUser') {
      try {
        // First create the participant in MongoDB
        const response = await fetch('/api/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            role: 'participant',
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to create participant');
        }
        
        const responseData = await response.json();
        
        // Create the user locally with the MongoDB ID
        const newUser: User = {
          id: responseData.user.id || 'usr-' + generateId(),
          name: formData.name,
          email: formData.email,
          role: 'participant',
          createdAt: new Date().toISOString(),
        };
        
        setAllUsers([...allUsers, newUser]);
        
        // Add user to selected group if a group ID was provided
        if (formData.groupId) {
          try {
            // Find the group
            const selectedGroup = userGroups.find(g => g.id === formData.groupId);
            if (!selectedGroup) throw new Error("Selected group not found");
            
            // Update the group in MongoDB with the new user
            const updatedUserIds = [...selectedGroup.users.map(u => u.id), newUser.id];
            
            // API request to update the group
            const response = await fetch('/api/user-groups', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                id: selectedGroup.id,
                name: selectedGroup.name,
                description: selectedGroup.description,
                users: updatedUserIds,
              }),
            });
            
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.message || 'Failed to add user to group');
            }
            
            const responseData = await response.json();
            
            // Update local state with server response
            const updatedGroups = userGroups.map(group => 
              group.id === formData.groupId 
                ? responseData.group 
                : group
            );
            setUserGroups(updatedGroups);
            
            toast.success(`User added to group "${selectedGroup.name}"`, { id: 'add-user-to-group' });
          } catch (error) {
            console.error('Error adding user to group:', error);
            toast.error(
              'Failed to add user to group: ' + (error instanceof Error ? error.message : 'Unknown error'), 
              { id: 'add-user-to-group' }
            );
            // User was created but not added to group
          }
        }
      } catch (error) {
        console.error('Error creating participant:', error);
        toast.error('Failed to create participant: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'create-user' });
        return; // Don't close the modal so they can try again
      }
    }
    else if (modalType === 'editUser' && selectedUser) {
      try {
        // Update user in MongoDB
        const response = await fetch('/api/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: selectedUser.id,
            name: formData.name,
            email: formData.email,
          }),
        });
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to update participant');
        }
        
        // Update in local state
        const updatedUsers = allUsers.map(user => 
          user.id === selectedUser.id 
            ? { ...user, name: formData.name, email: formData.email }
            : user
        );
        setAllUsers(updatedUsers);
        
        // Update user in all groups
        const updatedGroups = userGroups.map(group => ({
          ...group,
          users: group.users.map(user => 
            user.id === selectedUser.id 
              ? { ...user, name: formData.name, email: formData.email }
              : user
          )
        }));
        setUserGroups(updatedGroups);
      } catch (error) {
        console.error('Error updating participant:', error);
        toast.error('Failed to update participant: ' + (error instanceof Error ? error.message : 'Unknown error'), { id: 'edit-user' });
        return;
      }
    }
    
    // Close modal
    setIsModalOpen(false);
    setSelectedGroup(null);
    setSelectedUser(null);
    setIsSubmitting(false);
  };

  // Add/remove user from group
  const toggleUserInGroup = async (userId: string, groupId: string) => {
    const group = userGroups.find(g => g.id === groupId);
    if (!group) return;
    
    const userInGroup = group.users.some(u => u.id === userId);
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    try {
      // Start loading indicator
      toast.loading(
        userInGroup ? 'Removing user from group...' : 'Adding user to group...', 
        { id: `toggle-user-${userId}` }
      );
      
      // Create updated user list
      const updatedUserIds = userInGroup
        ? group.users.filter(u => u.id !== userId).map(u => u.id)  // Remove user
        : [...group.users.map(u => u.id), userId];                 // Add user
      
      // Update the group in MongoDB
      const response = await fetch('/api/user-groups', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: groupId,
          name: group.name,
          description: group.description,
          users: updatedUserIds,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update group');
      }
      
      const responseData = await response.json();
      
      // Update in local state
      const updatedGroups = userGroups.map(g => 
        g.id === groupId ? responseData.group : g
      );
      setUserGroups(updatedGroups);
      
      // Show success message
      toast.success(
        userInGroup ? 'User removed from group' : 'User added to group', 
        { id: `toggle-user-${userId}` }
      );
    } catch (error) {
      console.error('Error updating group:', error);
      toast.error(
        'Failed to update group: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        { id: `toggle-user-${userId}` }
      );
    }
  };
  
  // Delete a user group
  const deleteGroup = async (groupId: string) => {
    const group = userGroups.find(g => g.id === groupId);
    if (!group) return;
    
    if (!confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Start loading
      toast.loading('Deleting group...', { id: `delete-group-${groupId}` });
      
      // Send delete request to API
      const response = await fetch(`/api/user-groups?id=${groupId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete group');
      }
      
      // Remove from local state
      setUserGroups(userGroups.filter(group => group.id !== groupId));
      
      // Show success message
      toast.success('Group deleted successfully', { id: `delete-group-${groupId}` });
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error(
        'Failed to delete group: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        { id: `delete-group-${groupId}` }
      );
    }
  };
  
  // Delete a user
  const deleteUser = async (userId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    
    if (!confirm(`Are you sure you want to delete the user "${user.name}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      // Start loading state
      toast.loading('Deleting user...', { id: `delete-user-${userId}` });
      
      // Send delete request to API
      const response = await fetch(`/api/users?id=${userId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete user');
      }
      
      // Remove from local state
      setAllUsers(allUsers.filter(user => user.id !== userId));
      
      // Also remove from any groups they were part of
      const updatedGroups = userGroups.map(group => ({
        ...group,
        users: group.users.filter(u => u.id !== userId)
      }));
      setUserGroups(updatedGroups);
      
      // Show success message
      toast.success('User deleted successfully', { id: `delete-user-${userId}` });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(
        'Failed to delete user: ' + (error instanceof Error ? error.message : 'Unknown error'), 
        { id: `delete-user-${userId}` }
      );
    }
  };

  // Export group data to CSV
  const exportGroupToCsv = (group: UserGroup) => {
    // Create CSV content
    const headers = ['ID', 'Name', 'Email', 'Role', 'Added Date'];
    const csvRows = [headers.join(',')];
    
    group.users.forEach(user => {
      const row = [
        user.id,
        `"${user.name.replace(/"/g, '""')}"`, // Escape quotes in CSV
        `"${user.email.replace(/"/g, '""')}"`,
        user.role,
        new Date(user.createdAt).toISOString().split('T')[0]
      ];
      csvRows.push(row.join(','));
    });
    
    // Create downloadable link
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // Create a link and click it to download
    const link = document.createElement('a');
    const fileName = `${group.name.replace(/\s+/g, '_')}_users_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success notification
    toast.success(`Exported ${group.users.length} users to CSV`);
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
                <Link href="/admin/experiments" className="px-3 py-2 rounded hover:bg-purple-600">Experiments</Link>
                <Link href="/admin/scenarios" className="px-3 py-2 rounded hover:bg-purple-600">Scenarios</Link>
                <Link href="/admin/surveys" className="px-3 py-2 rounded hover:bg-purple-600">Surveys</Link>
                <Link href="/admin/wallets" className="px-3 py-2 rounded hover:bg-purple-600">Wallets</Link>
                <Link href="/admin/user-groups" className="px-3 py-2 rounded bg-purple-600">User Groups</Link>
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
          <h1 className="text-2xl font-bold text-gray-800">User Groups Management</h1>
          <div className="flex space-x-4">
            <Button 
              className="bg-green-600 hover:bg-green-700 px-4 py-2 flex items-center"
              onClick={() => openModal('createUser')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create User
            </Button>
            <div className="flex space-x-2">
              <Button 
                className={`px-4 py-2 ${activeTab === 'groups' ? 'bg-purple-600' : 'bg-gray-200 text-gray-800'}`}
                onClick={() => setActiveTab('groups')}
              >
                Groups
              </Button>
              <Button 
                className={`px-4 py-2 ${activeTab === 'users' ? 'bg-purple-600' : 'bg-gray-200 text-gray-800'}`}
                onClick={() => setActiveTab('users')}
              >
                Participants
              </Button>
            </div>
          </div>
        </div>
        
        {/* Search and Actions Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-4 rounded-lg shadow mb-6">
          <div className="mb-4 md:mb-0 md:w-1/2">
            <div className="relative">
              <input
                type="text"
                className="w-full pl-10 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder={`Search ${activeTab === 'groups' ? 'groups' : 'users'}...`}
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
            {activeTab === 'groups' && (
              <Button 
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2"
                onClick={() => openModal('createGroup')}
              >
                Create Group
              </Button>
            )}
          </div>
        </div>
        
        {/* Groups Tab Content */}
        {activeTab === 'groups' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Group Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Experiments
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredGroups.map((group) => (
                  <tr key={group.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-purple-100 text-purple-600">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{group.name}</div>
                          <div className="text-sm text-gray-500">{group.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{group.description}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{group.users.length}</div>
                      <div className="flex -space-x-1 overflow-hidden mt-1">
                        {group.users.slice(0, 3).map((user) => (
                          <div key={user.id} className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 border border-white text-xs">
                            {user.name.charAt(0)}
                          </div>
                        ))}
                        {group.users.length > 3 && (
                          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 border border-white text-xs">
                            +{group.users.length - 3}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{group.experimentsCount}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => openModal('editGroup', group)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Edit
                      </button>
                      {group.users.length > 0 && (
                        <button 
                          onClick={() => exportGroupToCsv(group)}
                          className="text-emerald-600 hover:text-emerald-900 mr-3"
                          title="Export users to CSV"
                        >
                          Export
                        </button>
                      )}
                      <button 
                        onClick={() => deleteGroup(group.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                
                {filteredGroups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No groups found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Users Tab Content */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Groups
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-500">{user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">{user.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-wrap">
                        {userGroups
                          .filter(group => group.users.some(u => u.id === user.id))
                          .map((group) => (
                            <span 
                              key={group.id} 
                              className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800 mr-1 mb-1"
                            >
                              {group.name}
                            </span>
                          ))}
                        {!userGroups.some(group => group.users.some(u => u.id === user.id)) && (
                          <span className="text-sm text-gray-500">No groups</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onClick={() => openModal('editUser', user)}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => deleteUser(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white py-4 shadow-inner">
        <div className="container mx-auto px-4">
          <p className="text-center text-gray-600 text-sm">
            © {new Date().getFullYear()} LabLab Platform. All rights reserved.
          </p>
        </div>
      </footer>
      
      {/* Modal for creating/editing groups and users */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {modalType === 'createGroup' ? 'Create Group' : 
                 modalType === 'editGroup' ? 'Edit Group' :
                 modalType === 'createUser' ? 'Create User' : 'Edit User'}
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
              {(modalType === 'createGroup' || modalType === 'editGroup') && (
                <>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                      Group Name
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
                      placeholder="Enter group name (3-50 characters)"
                    />
                    {formData.name && formData.name.length < 3 && (
                      <p className="text-red-500 text-xs mt-1">Name must be at least 3 characters</p>
                    )}
                  </div>
                  
                  <div className="mb-6">
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
                      placeholder="Enter group description (10-200 characters)"
                    />
                    {formData.description && formData.description.length < 10 && (
                      <p className="text-red-500 text-xs mt-1">Description must be at least 10 characters</p>
                    )}
                  </div>
                </>
              )}
              
              {(modalType === 'createUser' || modalType === 'editUser') && (
                <>
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      minLength={2}
                      maxLength={50}
                      placeholder="Enter participant's full name"
                    />
                    {formData.name && formData.name.length < 2 && (
                      <p className="text-red-500 text-xs mt-1">Name must be at least 2 characters</p>
                    )}
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                      pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                      placeholder="participant@example.com"
                    />
                    {formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) && (
                      <p className="text-red-500 text-xs mt-1">Please enter a valid email address</p>
                    )}
                  </div>
                  
                  {modalType === 'createUser' && (
                    <div className="mb-6">
                      <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="groupId">
                        Add to Group (Optional)
                      </label>
                      <select
                        id="groupId"
                        className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        value={formData.groupId}
                        onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                      >
                        <option value="">-- Select Group --</option>
                        {userGroups.map(group => (
                          <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              
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
                      {modalType.startsWith('create') ? 'Creating...' : 'Saving...'}
                    </span>
                  ) : (
                    modalType.startsWith('create') ? 'Create' : 'Save Changes'
                  )}
                </Button>
              </div>
            </form>
            
            {/* User Group Management (when editing a user) */}
            {modalType === 'editUser' && selectedUser && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Group Membership</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {userGroups.map(group => {
                    const isUserInGroup = group.users.some(u => u.id === selectedUser.id);
                    return (
                      <div key={group.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                        <span className="text-sm font-medium">{group.name}</span>
                        <Button
                          type="button"
                          className={`text-xs px-3 py-1 font-medium ${isUserInGroup 
                            ? 'bg-red-500 text-white hover:bg-red-600' 
                            : 'bg-green-500 text-white hover:bg-green-600'}`}
                          onClick={() => toggleUserInGroup(selectedUser.id, group.id)}
                        >
                          {isUserInGroup ? 'Remove' : 'Add'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* User Management (when editing a group) */}
            {modalType === 'editGroup' && selectedGroup && (
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Manage Users</h3>
                <div className="mb-2">
                  <input
                    type="text"
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Search users..."
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="mb-2 flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    {selectedGroup.users.length} users in this group
                  </span>
                  <div className="flex space-x-2">
                    {filteredUsers.filter(user => !selectedGroup.users.some(u => u.id === user.id)).length > 0 && (
                      <Button
                        type="button"
                        className="text-xs px-3 py-1 bg-green-500 text-white hover:bg-green-600 font-medium"
                        onClick={() => {
                          if (confirm(`Add all ${filteredUsers.filter(user => !selectedGroup.users.some(u => u.id === user.id)).length} filtered users to "${selectedGroup.name}"?`)) {
                            // Get IDs of all filtered users that aren't in the group yet
                            const usersToAdd = filteredUsers
                              .filter(user => !selectedGroup.users.some(u => u.id === user.id));
                            
                            if (usersToAdd.length === 0) return;
                            
                            // Add batch of users to the group
                            // Show loading indicator
                            toast.loading('Adding users to group...', { id: 'batch-add-users' });
                            
                            // Update in the database
                            (async () => {
                              try {
                                // Get all user IDs for the updated group
                                const updatedUserIds = [
                                  ...selectedGroup.users.map(u => u.id),
                                  ...usersToAdd.map(u => u.id)
                                ];
                                
                                // Update the group in MongoDB
                                const response = await fetch('/api/user-groups', {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    id: selectedGroup.id,
                                    name: selectedGroup.name,
                                    description: selectedGroup.description,
                                    users: updatedUserIds,
                                  }),
                                });
                                
                                if (!response.ok) {
                                  const data = await response.json();
                                  throw new Error(data.message || 'Failed to update group');
                                }
                                
                                const responseData = await response.json();
                                
                                // Update in local state
                                const updatedGroups = userGroups.map(g => 
                                  g.id === selectedGroup.id 
                                    ? responseData.group
                                    : g
                                );
                                setUserGroups(updatedGroups);
                                setSelectedGroup(responseData.group);
                                
                                // Toast notification
                                toast.success(`Added ${usersToAdd.length} users to group`, { id: 'batch-add-users' });
                              } catch (error) {
                                console.error('Error updating group:', error);
                                toast.error(
                                  'Failed to update group: ' + (error instanceof Error ? error.message : 'Unknown error'), 
                                  { id: 'batch-add-users' }
                                );
                              }
                            })();
                          }
                        }}
                      >
                        Add All Filtered
                      </Button>
                    )}
                    {selectedGroup.users.length > 0 && (
                      <Button
                        type="button"
                        className="text-xs px-3 py-1 bg-red-500 text-white hover:bg-red-600 font-medium"
                        onClick={() => {
                          if (confirm(`Remove all users from "${selectedGroup.name}"?`)) {
                            // Show loading indicator
                            toast.loading('Removing users from group...', { id: 'batch-remove-users' });
                            
                            // Update in the database
                            (async () => {
                              try {
                                // Update the group in MongoDB with empty users array
                                const response = await fetch('/api/user-groups', {
                                  method: 'PUT',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    id: selectedGroup.id,
                                    name: selectedGroup.name,
                                    description: selectedGroup.description,
                                    users: [], // Empty array
                                  }),
                                });
                                
                                if (!response.ok) {
                                  const data = await response.json();
                                  throw new Error(data.message || 'Failed to update group');
                                }
                                
                                const responseData = await response.json();
                                
                                // Update in local state
                                const updatedGroups = userGroups.map(g => 
                                  g.id === selectedGroup.id 
                                    ? responseData.group
                                    : g
                                );
                                setUserGroups(updatedGroups);
                                setSelectedGroup(responseData.group);
                                
                                // Toast notification
                                toast.success('Removed all users from group', { id: 'batch-remove-users' });
                              } catch (error) {
                                console.error('Error updating group:', error);
                                toast.error(
                                  'Failed to update group: ' + (error instanceof Error ? error.message : 'Unknown error'), 
                                  { id: 'batch-remove-users' }
                                );
                              }
                            })();
                          }
                        }}
                      >
                        Remove All
                      </Button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {allUsers
                    .filter(user => 
                      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      user.email.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(user => {
                    const isUserInGroup = selectedGroup.users.some(u => u.id === user.id);
                    return (
                      <div key={user.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs">
                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                          </div>
                        </div>
                        <Button
                          type="button"
                          className={`text-xs px-3 py-1 font-medium ${isUserInGroup 
                            ? 'bg-red-500 text-white hover:bg-red-600' 
                            : 'bg-green-500 text-white hover:bg-green-600'}`}
                          onClick={() => toggleUserInGroup(user.id, selectedGroup.id)}
                        >
                          {isUserInGroup ? 'Remove' : 'Add'}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}