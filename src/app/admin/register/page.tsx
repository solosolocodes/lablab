'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/Input';
import Button from '@/components/Button';

export default function AdminRegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    adminCode: '', // Special code for admin registration
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name || !formData.email || !formData.password || !formData.adminCode) {
      setError('Please fill in all fields');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    // In a real application, you would validate this admin code server-side
    // For demonstration, we're using a simple code: "ADMIN123"
    if (formData.adminCode !== 'ADMIN123') {
      setError('Invalid admin registration code');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: 'admin',
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to register');
      }
      
      // Registration successful, redirect to login
      router.push('/admin/login?registered=true');
    } catch (error: unknown) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-purple-600">Admin Registration</h1>
          <p className="mt-2 text-gray-600">Create your admin account</p>
        </div>
        
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <Input
              id="name"
              name="name"
              type="text"
              label="Full Name"
              placeholder="John Doe"
              required
              value={formData.name}
              onChange={handleChange}
            />
            
            <Input
              id="email"
              name="email"
              type="email"
              label="Email Address"
              placeholder="your@email.com"
              required
              value={formData.email}
              onChange={handleChange}
            />
            
            <Input
              id="password"
              name="password"
              type="password"
              label="Password"
              placeholder="••••••••"
              required
              value={formData.password}
              onChange={handleChange}
            />
            
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              label="Confirm Password"
              placeholder="••••••••"
              required
              value={formData.confirmPassword}
              onChange={handleChange}
            />
            
            <Input
              id="adminCode"
              name="adminCode"
              type="password"
              label="Admin Registration Code"
              placeholder="Enter admin code"
              required
              value={formData.adminCode}
              onChange={handleChange}
            />
          </div>
          
          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700"
            isLoading={isLoading}
          >
            Create Admin Account
          </Button>
        </form>
        
        <div className="mt-4 text-center text-sm">
          <p>
            Already have an account?{' '}
            <Link href="/admin/login" className="text-purple-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
        
        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-600 hover:text-purple-600 text-sm">
            ← Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}