"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";

export default function TestThemePage() {
  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Theme Test Page</h1>
        <ThemeToggle />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Card Example</CardTitle>
            <CardDescription>This is a test card to check the theme</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Here's some text in the muted foreground color to test contrast
            </p>
            <div className="flex flex-wrap gap-2">
              <Button>Default Button</Button>
              <Button variant="secondary">Secondary Button</Button>
              <Button variant="destructive">Destructive Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Button</Button>
              <Button variant="link">Link Button</Button>
            </div>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">Card footer</p>
          </CardFooter>
        </Card>
        
        <div className="space-y-4">
          <div className="p-4 bg-background border rounded-lg">
            <h3 className="font-medium mb-2">Background</h3>
            <p className="text-foreground">Foreground text on background</p>
          </div>
          
          <div className="p-4 bg-card rounded-lg">
            <h3 className="font-medium mb-2 text-card-foreground">Card</h3>
            <p className="text-card-foreground">Card foreground text</p>
          </div>
          
          <div className="p-4 bg-primary rounded-lg">
            <h3 className="font-medium mb-2 text-primary-foreground">Primary</h3>
            <p className="text-primary-foreground">Primary foreground text</p>
          </div>
          
          <div className="p-4 bg-secondary rounded-lg">
            <h3 className="font-medium mb-2 text-secondary-foreground">Secondary</h3>
            <p className="text-secondary-foreground">Secondary foreground text</p>
          </div>
        </div>
      </div>
      
      <div className="mt-8">
        <Button asChild>
          <a href="/dashboard">Back to Dashboard</a>
        </Button>
      </div>
    </div>
  );
} 