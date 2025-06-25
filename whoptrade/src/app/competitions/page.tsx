'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, ChevronRightIcon, SearchIcon, TrophyIcon, Users } from 'lucide-react';

// Mock competitions data
const mockCompetitions = [
  {
    id: '1',
    name: 'Weekly Trading Challenge',
    description: 'Test your trading skills in this week-long challenge. Top traders win prizes!',
    startDate: '2023-08-01T00:00:00Z',
    endDate: '2023-08-07T23:59:59Z',
    status: 'active',
    prizeAmount: 500,
    participantCount: 45,
    creator: 'Trading Academy',
    yourRank: 12,
    yourPnL: 386.25,
  },
  {
    id: '2',
    name: 'Crypto Bull Run Challenge',
    description: 'Cryptocurrency only trading competition. Can you ride the bull market?',
    startDate: '2023-07-15T00:00:00Z',
    endDate: '2023-08-15T23:59:59Z',
    status: 'active',
    prizeAmount: 1000,
    participantCount: 78,
    creator: 'Crypto Wizards',
    yourRank: 8,
    yourPnL: 754.80,
  },
  {
    id: '3',
    name: 'Day Trading Masters',
    description: 'Short term trading skills put to the test. Highest daily P&L wins!',
    startDate: '2023-07-01T00:00:00Z',
    endDate: '2023-07-05T23:59:59Z',
    status: 'completed',
    prizeAmount: 250,
    participantCount: 32,
    creator: 'Pro Traders Guild',
    yourRank: 5,
    yourPnL: 183.40,
    winner: 'John Doe',
    winnerPnL: 892.70,
  },
  {
    id: '4',
    name: 'Stock Market Bootcamp Competition',
    description: 'Final challenge for Stock Market Bootcamp graduates. Show what you learned!',
    startDate: '2023-06-01T00:00:00Z',
    endDate: '2023-06-30T23:59:59Z',
    status: 'completed',
    prizeAmount: 750,
    participantCount: 25,
    creator: 'Stock Market Bootcamp',
    yourRank: 1,
    yourPnL: 1254.30,
    winner: 'You',
    winnerPnL: 1254.30,
  },
  {
    id: '5',
    name: 'August Equity Challenge',
    description: 'US Stocks only trading competition.',
    startDate: '2023-08-10T00:00:00Z',
    endDate: '2023-09-10T23:59:59Z',
    status: 'upcoming',
    prizeAmount: 1200,
    participantCount: 15,
    creator: 'WallStreet Wizards',
  },
];

export default function CompetitionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  
  // Filter competitions based on search term and selected tab
  const filteredCompetitions = mockCompetitions.filter(comp => {
    const matchesSearch = comp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         comp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         comp.creator.toLowerCase().includes(searchTerm.toLowerCase());
                         
    const matchesTab = selectedTab === 'all' || 
                      (selectedTab === 'active' && comp.status === 'active') ||
                      (selectedTab === 'completed' && comp.status === 'completed') ||
                      (selectedTab === 'upcoming' && comp.status === 'upcoming');
                      
    return matchesSearch && matchesTab;
  });
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };
  
  // Format currency safely
  const formatCurrency = (value: number | undefined | null): string => {
    if (value === undefined || value === null || isNaN(value)) {
      return 'N/A';
    }
    return value.toFixed(2);
  };
  
  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'completed': return 'bg-gray-500';
      case 'upcoming': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Trading Competitions</h1>
        <Button>
          <TrophyIcon className="mr-2 h-4 w-4" />
          My Rankings
        </Button>
      </div>
      
      <div className="mb-6">
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search competitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid grid-cols-4 w-full max-w-md">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {filteredCompetitions.length === 0 ? (
        <div className="text-center py-16">
          <TrophyIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No competitions found</h2>
          <p className="text-muted-foreground">
            {searchTerm 
              ? `No competitions match "${searchTerm}"`
              : 'No competitions available in this category'
            }
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCompetitions.map((competition) => (
            <Card key={competition.id} className="flex flex-col h-full">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{competition.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Hosted by {competition.creator}
                    </CardDescription>
                  </div>
                  <Badge className={`${getStatusColor(competition.status)} capitalize`}>
                    {competition.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground mb-4">
                  {competition.description}
                </p>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Start Date</span>
                    </div>
                    <span className="font-medium">{formatDate(competition.startDate)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>End Date</span>
                    </div>
                    <span className="font-medium">{formatDate(competition.endDate)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <TrophyIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Prize</span>
                    </div>
                    <span className="font-medium">${competition.prizeAmount.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>Participants</span>
                    </div>
                    <span className="font-medium">{competition.participantCount}</span>
                  </div>
                  
                  {competition.status !== 'upcoming' && competition.yourRank && (
                    <>
                      <Separator />
                      <div className="flex justify-between items-center text-sm">
                        <span>Your Rank</span>
                        <span className="font-medium">{competition.yourRank} of {competition.participantCount}</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span>Your P&L</span>
                        <span className={`font-medium ${competition.yourPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {competition.yourPnL >= 0 ? '+' : ''}${typeof competition.yourPnL === 'number' && !isNaN(competition.yourPnL) ? formatCurrency(competition.yourPnL) : 'N/A'}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Link href={`/competitions/${competition.id}`} className="w-full">
                  <Button className="w-full" variant={competition.status === 'upcoming' ? 'default' : 'outline'}>
                    {competition.status === 'upcoming' ? 'Join Competition' : 'View Details'}
                    <ChevronRightIcon className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 