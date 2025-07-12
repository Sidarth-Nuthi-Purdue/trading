import { verifyUserToken } from '@whop/api';
import { headers } from 'next/headers';
import DashboardClient from './dashboard-client';

export default async function DashboardWhopPage() {
  try {
    // Check authentication using Whop SDK - exactly like whop-ai-support
    const headersList = await headers();
    console.log('Verifying Whop user token...');
    
    const { userId } = await verifyUserToken(headersList);
    
    if (!userId) {
      console.log('No Whop userId found');
      return <DashboardClient userId={null} showAuth={true} />;
    }

    console.log('Whop authentication successful, userId:', userId);
    return <DashboardClient userId={userId} showAuth={false} />;
    
  } catch (error) {
    console.error('Whop authentication error:', error);
    return <DashboardClient userId={null} showAuth={true} authError={error?.message || 'Authentication failed'} />;
  }
}