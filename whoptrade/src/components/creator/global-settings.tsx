'use client';

import React, { useState, useEffect } from 'react';
import { Save, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GlobalSettingsState {
  competition_settings: {
    max_duration_days: number;
    min_prize_amount: number;
    platform_fee_percentage: number;
    auto_close_expired: boolean;
  };
}

const defaultSettings: GlobalSettingsState = {
  competition_settings: {
    max_duration_days: 90,
    min_prize_amount: 100,
    platform_fee_percentage: 0,
    auto_close_expired: true
  }
};

export default function GlobalSettings() {
  const [settings, setSettings] = useState<GlobalSettingsState>(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch from /api/paper-trading/settings
      // For now, we'll use the default settings
      console.log('Loading global settings...');
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Settings would come from the database
      setSettings(defaultSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      // In a real implementation, this would save to /api/paper-trading/settings
      console.log('Saving settings:', settings);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (path: string, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev };
      const keys = path.split('.');
      let current = newSettings as any;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newSettings;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <Card className="bg-gray-900 border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Messages */}
      {message && (
        <Alert className={`${
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


      {/* Competition Settings */}
      <Card className="bg-gray-900 border-gray-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <TrendingUp className="h-5 w-5" />
            <span>Competition Settings</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxDuration" className="text-gray-300">
                Max Duration (Days)
              </Label>
              <Input
                id="maxDuration"
                type="number"
                value={settings.competition_settings.max_duration_days}
                onChange={(e) => updateSetting('competition_settings.max_duration_days', parseInt(e.target.value))}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minPrize" className="text-gray-300">
                Min Prize Amount
              </Label>
              <Input
                id="minPrize"
                type="number"
                value={settings.competition_settings.min_prize_amount}
                onChange={(e) => updateSetting('competition_settings.min_prize_amount', parseFloat(e.target.value))}
                className="bg-gray-800 border-gray-600 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="platformFee" className="text-gray-300">
              Platform Fee (%)
            </Label>
            <Input
              id="platformFee"
              type="number"
              min="0"
              max="50"
              step="0.1"
              value={settings.competition_settings.platform_fee_percentage}
              onChange={(e) => updateSetting('competition_settings.platform_fee_percentage', parseFloat(e.target.value))}
              className="bg-gray-800 border-gray-600 text-white w-32"
            />
            <p className="text-xs text-gray-400">
              {settings.competition_settings.platform_fee_percentage}% fee on prize pools
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <Switch
              checked={settings.competition_settings.auto_close_expired}
              onCheckedChange={(checked) => updateSetting('competition_settings.auto_close_expired', checked)}
            />
            <Label className="text-gray-300">Auto-close expired competitions</Label>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={saveSettings}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}