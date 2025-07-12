import { NextRequest, NextResponse } from 'next/server';
import { whopLeaderboard } from '@/lib/whop-leaderboard';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST - Handle Whop webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Verify webhook signature if configured
    const signature = request.headers.get('whop-signature');
    if (process.env.WHOP_WEBHOOK_SECRET && signature) {
      // In production, you should verify the webhook signature
      // const isValid = verifyWhopSignature(body, signature, process.env.WHOP_WEBHOOK_SECRET);
      // if (!isValid) {
      //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      // }
    }
    
    console.log('Received Whop webhook:', body);
    
    // Handle the webhook event
    await handleWhopWebhookEvent(body);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Whop webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleWhopWebhookEvent(event: any) {
  const { type, data } = event;
  
  switch (type) {
    case 'user_joined':
    case 'membership_created':
      await handleUserJoined(data);
      break;
    case 'user_left':
    case 'membership_deleted':
      await handleUserLeft(data);
      break;
    case 'payment_completed':
      await handlePaymentCompleted(data);
      break;
    default:
      console.log('Unhandled webhook event type:', type);
  }
}

async function handleUserJoined(data: any) {
  try {
    const { user } = data;
    
    // Create or update user profile in our database
    const { error: upsertError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        whop_user_id: user.id,
        email: user.email,
        username: user.username || user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: 'user',
        is_active: true,
        updated_at: new Date().toISOString()
      });
    
    if (upsertError) {
      console.error('Error upserting user profile:', upsertError);
    }
    
    // Initialize user balance
    const { error: balanceError } = await supabase
      .from('user_balances')
      .upsert({
        user_id: user.id,
        balance: 100000, // Default starting balance
        available_balance: 100000,
        total_pnl: 0,
        daily_pnl: 0,
        weekly_pnl: 0,
        monthly_pnl: 0,
        updated_at: new Date().toISOString()
      });
    
    if (balanceError) {
      console.error('Error initializing user balance:', balanceError);
    }
    
    // Update leaderboard
    await whopLeaderboard.handleWhopWebhook(event);
    
    console.log(`User ${user.id} joined and initialized`);
  } catch (error) {
    console.error('Error handling user joined event:', error);
  }
}

async function handleUserLeft(data: any) {
  try {
    const { user } = data;
    
    // Deactivate user in our database
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('whop_user_id', user.id);
    
    if (updateError) {
      console.error('Error deactivating user:', updateError);
    }
    
    // Update leaderboard
    await whopLeaderboard.handleWhopWebhook(event);
    
    console.log(`User ${user.id} left and deactivated`);
  } catch (error) {
    console.error('Error handling user left event:', error);
  }
}

async function handlePaymentCompleted(data: any) {
  try {
    const { user, payment } = data;
    
    // Log payment for potential premium features
    console.log(`Payment completed for user ${user.id}:`, payment);
    
    // You could add premium leaderboard features here
    // based on payment tiers
    
  } catch (error) {
    console.error('Error handling payment completed event:', error);
  }
}

/**
 * GET - Health check for webhook endpoint
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    endpoint: 'Whop webhook handler',
    timestamp: new Date().toISOString()
  });
}