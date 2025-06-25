'use client';

import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, Undo, Eye, Trophy, Medal, Crown, 
  Award, Users, Calendar, TrendingUp, TrendingDown,
  Plus, Minus, Copy, Download, Upload, Palette,
  BarChart3, PieChart, Target, Zap, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import LeaderboardTemplates from './leaderboard-templates';

interface LeaderboardConfig {
  id?: string;
  name: string;
  description: string;
  type: 'global' | 'competition' | 'custom';
  ranking_criteria: 'pnl' | 'roi' | 'win_rate' | 'total_trades' | 'volume' | 'sharpe_ratio';
  time_period: 'all_time' | 'yearly' | 'monthly' | 'weekly' | 'daily' | 'custom';
  custom_period_days?: number;
  max_entries: number;
  auto_refresh: boolean;
  refresh_interval: number; // minutes
  display_settings: {
    show_rank_icons: boolean;
    show_user_avatar: boolean;
    show_join_date: boolean;
    show_balance: boolean;
    show_percentage_change: boolean;
    show_trade_count: boolean;
    color_scheme: 'default' | 'green_red' | 'blue_orange' | 'purple_gold' | 'custom';
    custom_colors?: {
      positive: string;
      negative: string;
      neutral: string;
      background: string;
      text: string;
    };
    animation_enabled: boolean;
    compact_mode: boolean;
  };
  filters: {
    min_balance?: number;
    min_trades?: number;
    min_days_active?: number;
    exclude_inactive: boolean;
    verified_only: boolean;
  };
  rewards: {
    enabled: boolean;
    positions: Array<{
      rank: number;
      reward_type: 'cash' | 'points' | 'badge' | 'custom';
      reward_value: number;
      reward_description?: string;
    }>;
  };
  visibility: {
    public: boolean;
    featured: boolean;
    embed_enabled: boolean;
    api_access: boolean;
  };
}

interface LeaderboardConfiguratorProps {
  onConfigSave: (config: LeaderboardConfig) => void;
  initialConfig?: LeaderboardConfig;
  competitions?: Array<{ id: string; name: string; }>;
}

const defaultConfig: LeaderboardConfig = {
  name: 'New Leaderboard',
  description: 'Custom leaderboard configuration',
  type: 'global',
  ranking_criteria: 'pnl',
  time_period: 'monthly',
  max_entries: 100,
  auto_refresh: true,
  refresh_interval: 5,
  display_settings: {
    show_rank_icons: true,
    show_user_avatar: true,
    show_join_date: true,
    show_balance: true,
    show_percentage_change: true,
    show_trade_count: true,
    color_scheme: 'default',
    animation_enabled: true,
    compact_mode: false,
  },
  filters: {
    exclude_inactive: true,
    verified_only: false,
  },
  rewards: {
    enabled: false,
    positions: [
      { rank: 1, reward_type: 'cash', reward_value: 1000 },
      { rank: 2, reward_type: 'cash', reward_value: 500 },
      { rank: 3, reward_type: 'cash', reward_value: 250 },
    ],
  },
  visibility: {
    public: true,
    featured: false,
    embed_enabled: true,
    api_access: true,
  },
};

const colorSchemes = {
  default: { positive: '#10b981', negative: '#ef4444', neutral: '#6b7280', background: '#1f2937', text: '#ffffff' },
  green_red: { positive: '#22c55e', negative: '#dc2626', neutral: '#94a3b8', background: '#0f172a', text: '#f8fafc' },
  blue_orange: { positive: '#3b82f6', negative: '#f97316', neutral: '#64748b', background: '#1e293b', text: '#f1f5f9' },
  purple_gold: { positive: '#a855f7', negative: '#f59e0b', neutral: '#71717a', background: '#18181b', text: '#fafafa' },
};

const rankingCriteriaLabels = {
  pnl: 'Profit & Loss',
  roi: 'Return on Investment',
  win_rate: 'Win Rate',
  total_trades: 'Total Trades',
  volume: 'Trading Volume',
  sharpe_ratio: 'Sharpe Ratio',
};

export default function LeaderboardConfigurator({ 
  onConfigSave, 
  initialConfig,
  competitions = []
}: LeaderboardConfiguratorProps) {
  const [config, setConfig] = useState<LeaderboardConfig>(initialConfig || defaultConfig);
  const [previewMode, setPreviewMode] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<LeaderboardConfig[]>([]);
  const [activeTab, setActiveTab] = useState('templates');
  const [showTemplates, setShowTemplates] = useState(true);

  useEffect(() => {
    loadSavedConfigs();
  }, []);

  const loadSavedConfigs = async () => {
    try {
      const response = await fetch('/api/creator/leaderboard-configs');
      if (response.ok) {
        const data = await response.json();
        setSavedConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Error loading saved configs:', error);
    }
  };

  const updateConfig = (updates: Partial<LeaderboardConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const updateDisplaySettings = (updates: Partial<LeaderboardConfig['display_settings']>) => {
    setConfig(prev => ({
      ...prev,
      display_settings: { ...prev.display_settings, ...updates }
    }));
  };

  const updateFilters = (updates: Partial<LeaderboardConfig['filters']>) => {
    setConfig(prev => ({
      ...prev,
      filters: { ...prev.filters, ...updates }
    }));
  };

  const updateRewards = (updates: Partial<LeaderboardConfig['rewards']>) => {
    setConfig(prev => ({
      ...prev,
      rewards: { ...prev.rewards, ...updates }
    }));
  };

  const updateVisibility = (updates: Partial<LeaderboardConfig['visibility']>) => {
    setConfig(prev => ({
      ...prev,
      visibility: { ...prev.visibility, ...updates }
    }));
  };

  const addRewardPosition = () => {
    const newRank = config.rewards.positions.length + 1;
    updateRewards({
      positions: [...config.rewards.positions, {
        rank: newRank,
        reward_type: 'cash',
        reward_value: 100,
      }]
    });
  };

  const removeRewardPosition = (index: number) => {
    const newPositions = config.rewards.positions.filter((_, i) => i !== index);
    updateRewards({ positions: newPositions });
  };

  const updateRewardPosition = (index: number, updates: Partial<typeof config.rewards.positions[0]>) => {
    const newPositions = config.rewards.positions.map((pos, i) => 
      i === index ? { ...pos, ...updates } : pos
    );
    updateRewards({ positions: newPositions });
  };

  const saveConfig = async () => {
    try {
      const response = await fetch('/api/creator/leaderboard-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const savedConfig = await response.json();
        onConfigSave(savedConfig.config);
        loadSavedConfigs();
      }
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const loadTemplate = (templateConfig: LeaderboardConfig) => {
    setConfig({ ...templateConfig, id: undefined, name: `${templateConfig.name} (Copy)` });
  };

  const handleTemplateSelect = (template: any) => {
    setConfig({ ...template.config, id: undefined });
    setShowTemplates(false);
    setActiveTab('basic');
  };

  const exportConfig = () => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leaderboard-config-${config.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    link.click();
  };

  const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedConfig = JSON.parse(e.target?.result as string);
          setConfig(importedConfig);
        } catch (error) {
          console.error('Error importing config:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  const resetToDefault = () => {
    setConfig({ ...defaultConfig });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center">
            <Settings className="h-6 w-6 mr-2" />
            Leaderboard Configurator
          </h2>
          <p className="text-gray-400">Create and customize leaderboards with advanced features</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setPreviewMode(!previewMode)}
            variant="outline"
            className="bg-gray-800 border-gray-600 text-gray-300"
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Edit' : 'Preview'}
          </Button>
          
          <Button onClick={resetToDefault} variant="outline" className="bg-gray-800 border-gray-600 text-gray-300">
            <Undo className="h-4 w-4 mr-2" />
            Reset
          </Button>
          
          <Button onClick={saveConfig} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              onClick={exportConfig} 
              variant="outline" 
              size="sm"
              className="bg-gray-800 border-gray-600 text-gray-300"
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
            
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={importConfig}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline" size="sm" className="bg-gray-800 border-gray-600 text-gray-300">
                <Upload className="h-4 w-4 mr-1" />
                Import
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {savedConfigs.length > 0 && (
              <Select onValueChange={(value) => {
                const template = savedConfigs.find(c => c.id === value);
                if (template) loadTemplate(template);
              }}>
                <SelectTrigger className="w-48 bg-gray-800 border-gray-600 text-white">
                  <SelectValue placeholder="Load Template" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-600">
                  {savedConfigs.map((savedConfig) => (
                    <SelectItem key={savedConfig.id} value={savedConfig.id!} className="text-white">
                      {savedConfig.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {!previewMode ? (
        showTemplates ? (
          /* Template Selection */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Choose a Template</h3>
              <Button 
                onClick={() => setShowTemplates(false)}
                variant="outline"
                className="bg-gray-800 border-gray-600 text-gray-300"
              >
                Start from Scratch
              </Button>
            </div>
            <LeaderboardTemplates onTemplateSelect={handleTemplateSelect} />
          </div>
        ) : (
          /* Configuration Tabs */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button 
                onClick={() => setShowTemplates(true)}
                variant="outline"
                className="bg-gray-800 border-gray-600 text-gray-300"
              >
                ← Browse Templates
              </Button>
            </div>
            
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-6 bg-gray-800">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="criteria">Criteria</TabsTrigger>
                <TabsTrigger value="display">Display</TabsTrigger>
                <TabsTrigger value="filters">Filters</TabsTrigger>
                <TabsTrigger value="rewards">Rewards</TabsTrigger>
                <TabsTrigger value="visibility">Visibility</TabsTrigger>
              </TabsList>

              {/* Basic Configuration */}
              <TabsContent value="basic">
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Basic Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name" className="text-white">Leaderboard Name</Label>
                        <Input
                          id="name"
                          value={config.name}
                          onChange={(e) => updateConfig({ name: e.target.value })}
                          className="bg-gray-800 border-gray-600 text-white"
                          placeholder="Enter leaderboard name"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="type" className="text-white">Type</Label>
                        <Select value={config.type} onValueChange={(value: any) => updateConfig({ type: value })}>
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="global" className="text-white">Global</SelectItem>
                            <SelectItem value="competition" className="text-white">Competition</SelectItem>
                            <SelectItem value="custom" className="text-white">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-white">Description</Label>
                      <Textarea
                        id="description"
                        value={config.description}
                        onChange={(e) => updateConfig({ description: e.target.value })}
                        className="bg-gray-800 border-gray-600 text-white"
                        placeholder="Describe this leaderboard..."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="max_entries" className="text-white">Maximum Entries</Label>
                        <Input
                          id="max_entries"
                          type="number"
                          value={config.max_entries}
                          onChange={(e) => updateConfig({ max_entries: parseInt(e.target.value) || 100 })}
                          className="bg-gray-800 border-gray-600 text-white"
                          min="10"
                          max="1000"
                        />
                      </div>

                      <div>
                        <Label htmlFor="refresh_interval" className="text-white">Auto Refresh (minutes)</Label>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={config.auto_refresh}
                            onCheckedChange={(checked) => updateConfig({ auto_refresh: checked })}
                          />
                          <Input
                            id="refresh_interval"
                            type="number"
                            value={config.refresh_interval}
                            onChange={(e) => updateConfig({ refresh_interval: parseInt(e.target.value) || 5 })}
                            className="bg-gray-800 border-gray-600 text-white"
                            disabled={!config.auto_refresh}
                            min="1"
                            max="60"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Ranking Criteria */}
              <TabsContent value="criteria">
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Ranking Criteria</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-white">Ranking Method</Label>
                        <Select 
                          value={config.ranking_criteria} 
                          onValueChange={(value: any) => updateConfig({ ranking_criteria: value })}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            {Object.entries(rankingCriteriaLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key} className="text-white">
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-white">Time Period</Label>
                        <Select 
                          value={config.time_period} 
                          onValueChange={(value: any) => updateConfig({ time_period: value })}
                        >
                          <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-600">
                            <SelectItem value="all_time" className="text-white">All Time</SelectItem>
                            <SelectItem value="yearly" className="text-white">This Year</SelectItem>
                            <SelectItem value="monthly" className="text-white">This Month</SelectItem>
                            <SelectItem value="weekly" className="text-white">This Week</SelectItem>
                            <SelectItem value="daily" className="text-white">Today</SelectItem>
                            <SelectItem value="custom" className="text-white">Custom Period</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {config.time_period === 'custom' && (
                      <div>
                        <Label htmlFor="custom_days" className="text-white">Custom Period (Days)</Label>
                        <Input
                          id="custom_days"
                          type="number"
                          value={config.custom_period_days || 30}
                          onChange={(e) => updateConfig({ custom_period_days: parseInt(e.target.value) || 30 })}
                          className="bg-gray-800 border-gray-600 text-white"
                          min="1"
                          max="365"
                        />
                      </div>
                    )}

                    <div className="p-4 bg-gray-800 rounded-lg">
                      <h4 className="text-white font-medium mb-2">Criteria Explanation</h4>
                      <p className="text-gray-400 text-sm">
                        {config.ranking_criteria === 'pnl' && 'Ranks users by total profit and loss'}
                        {config.ranking_criteria === 'roi' && 'Ranks users by return on investment percentage'}
                        {config.ranking_criteria === 'win_rate' && 'Ranks users by percentage of winning trades'}
                        {config.ranking_criteria === 'total_trades' && 'Ranks users by total number of trades executed'}
                        {config.ranking_criteria === 'volume' && 'Ranks users by total trading volume'}
                        {config.ranking_criteria === 'sharpe_ratio' && 'Ranks users by risk-adjusted returns (Sharpe ratio)'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Display Settings */}
              <TabsContent value="display">
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Display Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h4 className="text-white font-medium">Visibility Options</h4>
                        
                        {[
                          { key: 'show_rank_icons', label: 'Show Rank Icons', icon: Crown },
                          { key: 'show_user_avatar', label: 'Show User Avatars', icon: Users },
                          { key: 'show_join_date', label: 'Show Join Date', icon: Calendar },
                          { key: 'show_balance', label: 'Show Balance', icon: BarChart3 },
                          { key: 'show_percentage_change', label: 'Show % Change', icon: TrendingUp },
                          { key: 'show_trade_count', label: 'Show Trade Count', icon: Target },
                        ].map(({ key, label, icon: Icon }) => (
                          <div key={key} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Icon className="h-4 w-4 text-gray-400" />
                              <Label className="text-white">{label}</Label>
                            </div>
                            <Switch
                              checked={config.display_settings[key as keyof typeof config.display_settings] as boolean}
                              onCheckedChange={(checked) => updateDisplaySettings({ [key]: checked })}
                            />
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-white font-medium">Layout Options</h4>
                        
                        <div className="flex items-center justify-between">
                          <Label className="text-white">Animation Effects</Label>
                          <Switch
                            checked={config.display_settings.animation_enabled}
                            onCheckedChange={(checked) => updateDisplaySettings({ animation_enabled: checked })}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-white">Compact Mode</Label>
                          <Switch
                            checked={config.display_settings.compact_mode}
                            onCheckedChange={(checked) => updateDisplaySettings({ compact_mode: checked })}
                          />
                        </div>

                        <div>
                          <Label className="text-white">Color Scheme</Label>
                          <Select 
                            value={config.display_settings.color_scheme} 
                            onValueChange={(value: any) => updateDisplaySettings({ color_scheme: value })}
                          >
                            <SelectTrigger className="bg-gray-800 border-gray-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-800 border-gray-600">
                              <SelectItem value="default" className="text-white">Default</SelectItem>
                              <SelectItem value="green_red" className="text-white">Green/Red</SelectItem>
                              <SelectItem value="blue_orange" className="text-white">Blue/Orange</SelectItem>
                              <SelectItem value="purple_gold" className="text-white">Purple/Gold</SelectItem>
                              <SelectItem value="custom" className="text-white">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {config.display_settings.color_scheme === 'custom' && (
                          <div className="space-y-2">
                            <Label className="text-white">Custom Colors</Label>
                            <div className="grid grid-cols-2 gap-2">
                              {['positive', 'negative', 'neutral', 'background', 'text'].map((colorType) => (
                                <div key={colorType}>
                                  <Label className="text-xs text-gray-400 capitalize">{colorType}</Label>
                                  <Input
                                    type="color"
                                    value={config.display_settings.custom_colors?.[colorType as keyof typeof config.display_settings.custom_colors] || '#ffffff'}
                                    onChange={(e) => updateDisplaySettings({
                                      custom_colors: {
                                        positive: config.display_settings.custom_colors?.positive || '#10b981',
                                        negative: config.display_settings.custom_colors?.negative || '#ef4444',
                                        neutral: config.display_settings.custom_colors?.neutral || '#6b7280',
                                        background: config.display_settings.custom_colors?.background || '#1f2937',
                                        text: config.display_settings.custom_colors?.text || '#ffffff',
                                        [colorType]: e.target.value
                                      }
                                    })}
                                    className="w-full h-8 bg-gray-800 border-gray-600"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Color Scheme Preview */}
                    <div className="p-4 bg-gray-800 rounded-lg">
                      <h4 className="text-white font-medium mb-3">Color Preview</h4>
                      <div className="flex space-x-4">
                        {Object.entries(colorSchemes[config.display_settings.color_scheme as keyof typeof colorSchemes] || colorSchemes.default).map(([type, color]) => (
                          <div key={type} className="text-center">
                            <div 
                              className="w-8 h-8 rounded mx-auto mb-1 border border-gray-600"
                              style={{ backgroundColor: color }}
                            />
                            <p className="text-xs text-gray-400 capitalize">{type.replace('_', ' ')}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Filters */}
              <TabsContent value="filters">
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Entry Filters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="min_balance" className="text-white">Minimum Balance ($)</Label>
                        <Input
                          id="min_balance"
                          type="number"
                          value={config.filters.min_balance || ''}
                          onChange={(e) => updateFilters({ min_balance: parseFloat(e.target.value) || undefined })}
                          className="bg-gray-800 border-gray-600 text-white"
                          placeholder="No minimum"
                        />
                      </div>

                      <div>
                        <Label htmlFor="min_trades" className="text-white">Minimum Trades</Label>
                        <Input
                          id="min_trades"
                          type="number"
                          value={config.filters.min_trades || ''}
                          onChange={(e) => updateFilters({ min_trades: parseInt(e.target.value) || undefined })}
                          className="bg-gray-800 border-gray-600 text-white"
                          placeholder="No minimum"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="min_days_active" className="text-white">Minimum Days Active</Label>
                      <Input
                        id="min_days_active"
                        type="number"
                        value={config.filters.min_days_active || ''}
                        onChange={(e) => updateFilters({ min_days_active: parseInt(e.target.value) || undefined })}
                        className="bg-gray-800 border-gray-600 text-white"
                        placeholder="No minimum"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white">Exclude Inactive Users</Label>
                          <p className="text-sm text-gray-400">Hide users with no recent activity</p>
                        </div>
                        <Switch
                          checked={config.filters.exclude_inactive}
                          onCheckedChange={(checked) => updateFilters({ exclude_inactive: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white">Verified Users Only</Label>
                          <p className="text-sm text-gray-400">Only show verified/approved users</p>
                        </div>
                        <Switch
                          checked={config.filters.verified_only}
                          onCheckedChange={(checked) => updateFilters({ verified_only: checked })}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Rewards */}
              <TabsContent value="rewards">
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                      Reward System
                      <Switch
                        checked={config.rewards.enabled}
                        onCheckedChange={(checked) => updateRewards({ enabled: checked })}
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {config.rewards.enabled && (
                      <>
                        <div className="flex items-center justify-between">
                          <h4 className="text-white font-medium">Reward Positions</h4>
                          <Button
                            onClick={addRewardPosition}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Position
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {config.rewards.positions.map((position, index) => (
                            <div key={index} className="p-4 bg-gray-800 rounded-lg">
                              <div className="grid grid-cols-4 gap-3 items-center">
                                <div>
                                  <Label className="text-white text-sm">Rank</Label>
                                  <Input
                                    type="number"
                                    value={position.rank}
                                    onChange={(e) => updateRewardPosition(index, { rank: parseInt(e.target.value) || 1 })}
                                    className="bg-gray-700 border-gray-600 text-white"
                                    min="1"
                                  />
                                </div>

                                <div>
                                  <Label className="text-white text-sm">Type</Label>
                                  <Select 
                                    value={position.reward_type} 
                                    onValueChange={(value: any) => updateRewardPosition(index, { reward_type: value })}
                                  >
                                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-600">
                                      <SelectItem value="cash" className="text-white">Cash</SelectItem>
                                      <SelectItem value="points" className="text-white">Points</SelectItem>
                                      <SelectItem value="badge" className="text-white">Badge</SelectItem>
                                      <SelectItem value="custom" className="text-white">Custom</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div>
                                  <Label className="text-white text-sm">Value</Label>
                                  <Input
                                    type="number"
                                    value={position.reward_value}
                                    onChange={(e) => updateRewardPosition(index, { reward_value: parseFloat(e.target.value) || 0 })}
                                    className="bg-gray-700 border-gray-600 text-white"
                                    min="0"
                                  />
                                </div>

                                <div className="flex items-end">
                                  <Button
                                    onClick={() => removeRewardPosition(index)}
                                    variant="outline"
                                    size="sm"
                                    className="bg-red-600 border-red-500 text-white hover:bg-red-700"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {position.reward_type === 'custom' && (
                                <div className="mt-3">
                                  <Label className="text-white text-sm">Description</Label>
                                  <Input
                                    value={position.reward_description || ''}
                                    onChange={(e) => updateRewardPosition(index, { reward_description: e.target.value })}
                                    className="bg-gray-700 border-gray-600 text-white"
                                    placeholder="Describe the custom reward..."
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {!config.rewards.enabled && (
                      <div className="text-center py-8 text-gray-400">
                        <Award className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p>Enable rewards to motivate top performers</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Visibility */}
              <TabsContent value="visibility">
                <Card className="bg-gray-900 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white">Visibility & Access</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white">Public Access</Label>
                          <p className="text-sm text-gray-400">Allow public viewing of this leaderboard</p>
                        </div>
                        <Switch
                          checked={config.visibility.public}
                          onCheckedChange={(checked) => updateVisibility({ public: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white">Featured Leaderboard</Label>
                          <p className="text-sm text-gray-400">Highlight on main leaderboard page</p>
                        </div>
                        <Switch
                          checked={config.visibility.featured}
                          onCheckedChange={(checked) => updateVisibility({ featured: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white">Embed Support</Label>
                          <p className="text-sm text-gray-400">Allow embedding in external websites</p>
                        </div>
                        <Switch
                          checked={config.visibility.embed_enabled}
                          onCheckedChange={(checked) => updateVisibility({ embed_enabled: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-white">API Access</Label>
                          <p className="text-sm text-gray-400">Provide programmatic access via API</p>
                        </div>
                        <Switch
                          checked={config.visibility.api_access}
                          onCheckedChange={(checked) => updateVisibility({ api_access: checked })}
                        />
                      </div>
                    </div>

                    {config.visibility.embed_enabled && (
                      <div className="p-4 bg-gray-800 rounded-lg">
                        <Label className="text-white">Embed Code</Label>
                        <div className="mt-2 p-3 bg-gray-900 rounded border border-gray-600">
                          <code className="text-sm text-gray-300">
                            {`<iframe src="${process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/embed/leaderboard/${config.id || 'LEADERBOARD_ID'}" width="800" height="600" frameborder="0"></iframe>`}
                          </code>
                        </div>
                      </div>
                    )}

                    {config.visibility.api_access && (
                      <div className="p-4 bg-gray-800 rounded-lg">
                        <Label className="text-white">API Endpoint</Label>
                        <div className="mt-2 p-3 bg-gray-900 rounded border border-gray-600">
                          <code className="text-sm text-gray-300">
                            GET {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/leaderboard/{config.id || 'LEADERBOARD_ID'}
                          </code>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )
      ) : (
        /* Preview Mode */
        <LeaderboardPreview config={config} />
      )}
    </div>
  );
}

// Preview Component
function LeaderboardPreview({ config }: { config: LeaderboardConfig }) {
  const mockData = [
    { rank: 1, username: 'trader_pro', pnl: 12500, trades: 45, winRate: 85 },
    { rank: 2, username: 'market_master', pnl: 8750, trades: 32, winRate: 78 },
    { rank: 3, username: 'day_trader', pnl: 6200, trades: 28, winRate: 72 },
    { rank: 4, username: 'swing_king', pnl: 4100, trades: 15, winRate: 80 },
    { rank: 5, username: 'crypto_ace', pnl: 2800, trades: 22, winRate: 68 },
  ];

  const colors = colorSchemes[config.display_settings.color_scheme as keyof typeof colorSchemes] || colorSchemes.default;

  return (
    <Card className="bg-gray-900 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center">
          <Trophy className="h-5 w-5 mr-2" />
          {config.name} - Preview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockData.slice(0, Math.min(config.max_entries, mockData.length)).map((entry) => (
            <div
              key={entry.rank}
              className={`flex items-center justify-between p-4 rounded-lg border ${
                config.display_settings.compact_mode ? 'py-2' : 'py-4'
              } ${
                entry.rank <= 3 
                  ? 'bg-gradient-to-r from-gray-800 to-gray-700 border-gray-600' 
                  : 'bg-gray-800 border-gray-700'
              }`}
            >
              <div className="flex items-center space-x-4">
                {config.display_settings.show_rank_icons && (
                  <div className="w-8">
                    {entry.rank === 1 ? <Crown className="h-5 w-5 text-yellow-400" /> :
                     entry.rank === 2 ? <Medal className="h-5 w-5 text-gray-300" /> :
                     entry.rank === 3 ? <Award className="h-5 w-5 text-amber-600" /> :
                     <span className="font-bold text-gray-400">#{entry.rank}</span>}
                  </div>
                )}
                
                <div>
                  <div className="font-medium text-white">@{entry.username}</div>
                  {config.display_settings.show_trade_count && (
                    <div className="text-sm text-gray-400">{entry.trades} trades • {entry.winRate}% win rate</div>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div 
                  className="text-lg font-bold" 
                  style={{ color: entry.pnl >= 0 ? colors.positive : colors.negative }}
                >
                  +${entry.pnl.toLocaleString()}
                </div>
                {config.display_settings.show_percentage_change && (
                  <div className="text-sm text-gray-400">+{((entry.pnl / 10000) * 100).toFixed(1)}%</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}