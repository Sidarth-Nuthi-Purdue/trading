'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { registerUser, showAuthToast } from '@/lib/auth-helpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error } = await registerUser(email, password, firstName, lastName);

      if (error) {
        setError(error.message);
        showAuthToast('error', error.message);
        setIsLoading(false);
        return;
      }
      
      // Show success message
      showAuthToast('success', 'Registration successful! Check your email to confirm your account.');
      
      // Redirect to login page
      router.push('/login?message=Check your email to confirm your registration.');

    } catch (err: any) {
      const errorMessage = err.message || 'Registration failed. Please try again.';
      setError(errorMessage);
      showAuthToast('error', errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">Create Your Account</CardTitle>
        <CardDescription className="text-center text-gray-300">
          Enter your details to create a new trading account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-gray-200">First Name</Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="text-gray-200">Last Name</Label>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-200">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-gray-200">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button 
            type="submit" 
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Register'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-center text-gray-300">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-blue-400 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
} 