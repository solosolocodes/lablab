'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Input from '@/components/Input';
import Button from '@/components/Button';

export default function AdminLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/admin/dashboard';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      setIsLoading(true);
      setError('');
      
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false,
      });
      
      if (result?.error) {
        setError(result.error);
        return;
      }
      
      // We need to check if the user is actually an admin
      const response = await fetch('/api/auth/session');
      const session = await response.json();
      
      if (session?.user?.role !== 'admin') {
        await signIn('credentials', { redirect: false }); // Sign out
        setError('You do not have admin privileges');
        return;
      }
      
      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      console.error('Login error:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-lg shadow">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-purple-600">Admin Login</h1>
          <p className="mt-2 text-gray-600">Sign in to your admin account</p>
        </div>
        
        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {searchParams.get('registered') && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            Registration successful! Please sign in with your credentials.
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
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
          </div>
          
          <Button
            type="submit"
            className="w-full bg-purple-600 hover:bg-purple-700"
            isLoading={isLoading}
          >
            Sign In
          </Button>
        </form>
        
        <div className="mt-4 text-center text-sm">
          <p>
            Don&apos;t have an account?{' '}
            <Link href="/admin/register" className="text-purple-600 hover:underline">
              Sign up
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