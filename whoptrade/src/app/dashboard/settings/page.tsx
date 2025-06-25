"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWhopIframe } from "@/hooks/use-whop-iframe";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { whopUser: user, whopExperience: experience, accessLevel } = useWhopIframe();
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize the database schema
  const initializeDatabase = async () => {
    setIsInitializing(true);
    try {
      const response = await fetch('/api/reset-db', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initialize database');
      }

      toast.success('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      toast.error('Failed to initialize database', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="debug" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="debug">Debug Information</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>
        
        <TabsContent value="debug">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>User Object</CardTitle>
                <CardDescription>Details about the current authenticated user</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 dark:bg-neutral-900 p-4 rounded-md overflow-auto max-h-[400px]">
                  {JSON.stringify(user, null, 2)}
                </pre>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Experience Object</CardTitle>
                <CardDescription>Details about the current experience/app</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 dark:bg-neutral-900 p-4 rounded-md overflow-auto max-h-[400px]">
                  {JSON.stringify(experience, null, 2)}
                </pre>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Access Level</CardTitle>
                <CardDescription>Current user's access permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 dark:bg-neutral-900 p-4 rounded-md">
                  {accessLevel}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Database Management</CardTitle>
                <CardDescription>Initialize or reset the trading database</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={initializeDatabase} 
                  disabled={isInitializing}
                  className="w-full"
                >
                  {isInitializing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    'Initialize Trading Database'
                  )}
                </Button>
                <p className="text-sm text-muted-foreground mt-2">
                  This will set up the necessary database tables for paper trading and create a trading account with $10,000 if one doesn't exist.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>Manage your account preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Account settings will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Trading Preferences</CardTitle>
              <CardDescription>Customize your trading experience</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Trading preferences will be available in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 