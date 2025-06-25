'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, LogIn, Crown, Users, Trophy, BarChart3 } from 'lucide-react';

export default function CreatorAuthPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  const router = useRouter();

  // Login form state
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/creator/auth/verify');
      
      if (response.ok) {
        const data = await response.json();
        if (data.authenticated) {
          router.push('/creator');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/creator/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: loginData.email,
          password: loginData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: data.error || 'Login failed' });
        return;
      }

      setMessage({ type: 'success', text: 'Login successful! Redirecting...' });
      
      // Clear form
      setLoginData({ email: '', password: '' });
      
      setTimeout(() => router.push('/creator'), 1000);

    } catch (error) {
      console.error('Login error:', error);
      setMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };


  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Crown className="h-12 w-12 text-yellow-500 mr-3" />
            <h1 className="text-4xl font-bold text-white">WhopTrade Creator</h1>
          </div>
          <p className="text-xl text-gray-400">
            Build and manage your paper trading platform
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Features Section */}
          <div className="space-y-6">
            <div className="text-center lg:text-left">
              <h2 className="text-2xl font-bold text-white mb-4">Creator Features</h2>
              <p className="text-gray-400 mb-6">
                Everything you need to run successful trading competitions and manage your community
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <Users className="h-6 w-6 text-blue-400 mt-1" />
                <div>
                  <h3 className="text-white font-semibold">User Management</h3>
                  <p className="text-gray-400 text-sm">
                    Manage user accounts, balances, and trading permissions with full control
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Trophy className="h-6 w-6 text-yellow-400 mt-1" />
                <div>
                  <h3 className="text-white font-semibold">Competition Hosting</h3>
                  <p className="text-gray-400 text-sm">
                    Create and manage trading competitions with custom rules and prizes
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <BarChart3 className="h-6 w-6 text-green-400 mt-1" />
                <div>
                  <h3 className="text-white font-semibold">Analytics & Insights</h3>
                  <p className="text-gray-400 text-sm">
                    Track user performance, trading statistics, and platform engagement
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Auth Section */}
          <div>
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white text-center">Get Started</CardTitle>
                <CardDescription className="text-gray-400 text-center">
                  Sign in to your creator account or create a new one
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-gray-800">
                    <TabsTrigger value="login" className="data-[state=active]:bg-gray-700">
                      Sign In
                    </TabsTrigger>
                    <TabsTrigger value="register" className="data-[state=active]:bg-gray-700">
                      Create Account
                    </TabsTrigger>
                  </TabsList>

                  {/* Success/Error Messages */}
                  {message && (
                    <Alert className={`mt-4 ${
                      message.type === 'success' 
                        ? 'border-green-700 bg-green-900/20' 
                        : 'border-red-700 bg-red-900/20'
                    }`}>
                      <AlertDescription className={
                        message.type === 'success' ? 'text-green-400' : 'text-red-400'
                      }>
                        {message.text}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Login Tab */}
                  <TabsContent value="login" className="space-y-4">
                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-gray-300">Email</Label>
                        <Input
                          id="login-email"
                          type="email"
                          value={loginData.email}
                          onChange={(e) => setLoginData({...loginData, email: e.target.value})}
                          placeholder="creator@example.com"
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="login-password" className="text-gray-300">Password</Label>
                        <Input
                          id="login-password"
                          type="password"
                          value={loginData.password}
                          onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing In...
                          </>
                        ) : (
                          <>
                            <LogIn className="mr-2 h-4 w-4" />
                            Sign In
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  {/* Register Tab */}
                  <TabsContent value="register" className="space-y-4">
                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="first-name" className="text-gray-300">First Name</Label>
                          <Input
                            id="first-name"
                            value={registerData.first_name}
                            onChange={(e) => setRegisterData({...registerData, first_name: e.target.value})}
                            placeholder="John"
                            className="bg-gray-800 border-gray-600 text-white"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="last-name" className="text-gray-300">Last Name</Label>
                          <Input
                            id="last-name"
                            value={registerData.last_name}
                            onChange={(e) => setRegisterData({...registerData, last_name: e.target.value})}
                            placeholder="Doe"
                            className="bg-gray-800 border-gray-600 text-white"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="username" className="text-gray-300">Username</Label>
                        <Input
                          id="username"
                          value={registerData.username}
                          onChange={(e) => setRegisterData({...registerData, username: e.target.value})}
                          placeholder="creator_username"
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-email" className="text-gray-300">Email</Label>
                        <Input
                          id="register-email"
                          type="email"
                          value={registerData.email}
                          onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                          placeholder="creator@example.com"
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="register-password" className="text-gray-300">Password</Label>
                        <Input
                          id="register-password"
                          type="password"
                          value={registerData.password}
                          onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                          placeholder="Must be at least 6 characters"
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-password" className="text-gray-300">Confirm Password</Label>
                        <Input
                          id="confirm-password"
                          type="password"
                          value={registerData.confirmPassword}
                          onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                          className="bg-gray-800 border-gray-600 text-white"
                          required
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating Account...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Create Creator Account
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm">
          <p>© 2024 WhopTrade. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}