'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Users, Trophy, Building, Settings, Activity, UserCheck, UserX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWhopAuthHeaders, isWhopAuthenticated } from '@/lib/whop-supabase-bridge';

interface AdminPermissions {
  permissions: string[];
  roles: any[];
  user_profile: {
    role: string;
    can_trade: boolean;
    organization_id: string;
  };
  is_admin: boolean;
}

interface User {
  user_id: string;
  whop_user_id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
  can_trade: boolean;
  created_at: string;
}

interface Organization {
  id: string;
  name: string;
  whop_company_id: string;
  description: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();

  // Form states
  const [newUser, setNewUser] = useState({
    whop_user_id: '',
    email: '',
    username: '',
    role_name: 'competition_admin',
    organization_id: ''
  });

  const [newOrg, setNewOrg] = useState({
    name: '',
    whop_company_id: '',
    description: ''
  });

  useEffect(() => {
    const checkAuthAndPermissions = async () => {
      if (!isWhopAuthenticated()) {
        router.push('/login');
        return;
      }
      
      await loadPermissions();
      setLoading(false);
    };

    checkAuthAndPermissions();
  }, [router]);

  const loadPermissions = async () => {
    try {
      const response = await fetch('/api/admin/permissions', {
        headers: getWhopAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setPermissions(data);
        
        // If user is admin, load additional data
        if (data.is_admin) {
          await Promise.all([
            loadUsers(),
            loadOrganizations()
          ]);
        }
      } else {
        console.error('Failed to load permissions:', response.status);
        router.push('/leaderboard'); // Redirect non-admin users
      }
    } catch (error) {
      console.error('Error loading permissions:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users?limit=100', {
        headers: getWhopAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadOrganizations = async () => {
    try {
      const response = await fetch('/api/admin/organizations', {
        headers: getWhopAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  };

  const createAdminUser = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getWhopAuthHeaders()
        },
        body: JSON.stringify(newUser)
      });
      
      if (response.ok) {
        alert('Admin user created successfully!');
        setNewUser({
          whop_user_id: '',
          email: '',
          username: '',
          role_name: 'competition_admin',
          organization_id: ''
        });
        await loadUsers();
      } else {
        const error = await response.json();
        alert(`Failed to create admin user: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating admin user:', error);
      alert('Error creating admin user');
    }
  };

  const createOrganization = async () => {
    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getWhopAuthHeaders()
        },
        body: JSON.stringify(newOrg)
      });
      
      if (response.ok) {
        alert('Organization created successfully!');
        setNewOrg({
          name: '',
          whop_company_id: '',
          description: ''
        });
        await loadOrganizations();
      } else {
        const error = await response.json();
        alert(`Failed to create organization: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      alert('Error creating organization');
    }
  };

  const hasPermission = (permission: string): boolean => {
    return permissions?.permissions.includes(permission) || false;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!permissions?.is_admin) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-red-400" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400">You don't have admin permissions to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center">
              <Shield className="h-7 w-7 mr-2 text-blue-400" />
              Admin Dashboard
            </h1>
            <p className="text-gray-400">Manage competitions, users, and organizations</p>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-blue-400 border-blue-400">
              {permissions.user_profile.role}
            </Badge>
            <Button
              onClick={() => router.push('/leaderboard')}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Back to Competitions
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 mb-6">
            <TabsTrigger value="overview" className="data-[state=active]:bg-gray-700">
              <Activity className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-gray-700">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="organizations" className="data-[state=active]:bg-gray-700">
              <Building className="h-4 w-4 mr-2" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="competitions" className="data-[state=active]:bg-gray-700">
              <Trophy className="h-4 w-4 mr-2" />
              Competitions
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card className="bg-gray-900 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-blue-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{users.length}</div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Admin Users</CardTitle>
                  <Shield className="h-4 w-4 text-green-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">
                    {users.filter(u => u.role === 'admin').length}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Organizations</CardTitle>
                  <Building className="h-4 w-4 text-purple-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{organizations.length}</div>
                </CardContent>
              </Card>

              <Card className="bg-gray-900 border-gray-700">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-gray-300">Your Permissions</CardTitle>
                  <Settings className="h-4 w-4 text-yellow-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{permissions.permissions.length}</div>
                </CardContent>
              </Card>
            </div>

            {/* Current Permissions */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Your Permissions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {permissions.permissions.map((perm, index) => (
                    <Badge key={index} className="bg-blue-600 text-white">
                      {perm.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            {hasPermission('manage_users') && (
              <Card className="bg-gray-900 border-gray-700 mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Create Admin User</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      placeholder="Whop User ID"
                      value={newUser.whop_user_id}
                      onChange={(e) => setNewUser({...newUser, whop_user_id: e.target.value})}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <Input
                      placeholder="Email"
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <Input
                      placeholder="Username"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <Select
                      value={newUser.role_name}
                      onValueChange={(value) => setNewUser({...newUser, role_name: value})}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="competition_admin">Competition Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="organization_admin">Organization Admin</SelectItem>
                        <SelectItem value="support_admin">Support Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    onClick={createAdminUser}
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                    disabled={!newUser.whop_user_id || !newUser.email || !newUser.username}
                  >
                    Create Admin User
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Users List */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">All Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.map((user) => (
                    <div key={user.user_id} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                      <div>
                        <div className="font-medium text-white">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-400">
                          @{user.username} • {user.email}
                        </div>
                        <div className="text-xs text-gray-500">
                          Whop ID: {user.whop_user_id}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge className={user.role === 'admin' ? 'bg-red-600' : 'bg-gray-600'}>
                          {user.role}
                        </Badge>
                        {user.can_trade ? (
                          <Badge className="bg-green-600">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Can Trade
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-600">
                            <UserX className="h-3 w-3 mr-1" />
                            No Trading
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Organizations Tab */}
          <TabsContent value="organizations">
            {hasPermission('manage_organizations') && (
              <Card className="bg-gray-900 border-gray-700 mb-6">
                <CardHeader>
                  <CardTitle className="text-white">Create Organization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    <Input
                      placeholder="Organization Name"
                      value={newOrg.name}
                      onChange={(e) => setNewOrg({...newOrg, name: e.target.value})}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <Input
                      placeholder="Whop Company ID (optional)"
                      value={newOrg.whop_company_id}
                      onChange={(e) => setNewOrg({...newOrg, whop_company_id: e.target.value})}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                    <Input
                      placeholder="Description"
                      value={newOrg.description}
                      onChange={(e) => setNewOrg({...newOrg, description: e.target.value})}
                      className="bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                  <Button 
                    onClick={createOrganization}
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                    disabled={!newOrg.name}
                  >
                    Create Organization
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Organizations List */}
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Organizations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {organizations.map((org) => (
                    <div key={org.id} className="p-4 bg-gray-800 rounded-lg">
                      <div className="font-medium text-white">{org.name}</div>
                      <div className="text-sm text-gray-400">{org.description}</div>
                      {org.whop_company_id && (
                        <div className="text-xs text-gray-500">
                          Whop Company: {org.whop_company_id}
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-2">
                        Created: {new Date(org.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Competitions Tab */}
          <TabsContent value="competitions">
            <Card className="bg-gray-900 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Competition Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-gray-400">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Competition Management</h3>
                  <p className="text-sm">
                    Use the main competitions page to create and manage competitions.
                  </p>
                  <Button 
                    onClick={() => router.push('/leaderboard')}
                    className="mt-4 bg-blue-600 hover:bg-blue-700"
                  >
                    Go to Competitions
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}