import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Get the cookie header
  const cookieHeader = request.headers.get('Cookie') || '';
  
  // Extract the whop token from cookies
  const whopAccessToken = getCookieValue(cookieHeader, 'whop_access_token');
  const whopDevUserToken = getCookieValue(cookieHeader, 'whop_dev_user_token');
  
  console.log('API route tokens:', { 
    hasAccessToken: !!whopAccessToken, 
    hasDevToken: !!whopDevUserToken,
    cookieHeader: cookieHeader.substring(0, 50) + '...'  // Don't log full cookie for security
  });
  
  // If no token is found, return unauthorized
  if (!whopAccessToken && !whopDevUserToken) {
    return NextResponse.json(
      { error: 'Not authenticated via Whop' },
      { status: 401 }
    );
  }
  
  try {
    let userData;
    let experienceData = null;
    let accessLevel = 'member';
    
    // If we have a dev user token, use it to get user data
    if (whopDevUserToken) {
      // For dev user token from Whop iframe, extract info from token if possible
      try {
        // The dev token might be a JWT - try to decode payload part
        const tokenParts = whopDevUserToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          const userId = payload.sub || 'dev-user';
          
          userData = {
            id: userId,
            name: 'Whop Dev User',
            email: `${userId.replace('user_', '')}@whop.dev`,
            username: userId.replace('user_', 'whopdev_'),
            profilePicture: null
          };
          
          // Check if there's experience info in the token
          if (payload.exp_id) {
            experienceData = {
              id: payload.exp_id,
              name: payload.exp_name || 'PaperTrader',
              description: 'Paper trading platform for Whop users',
              logo: {
                sourceUrl: 'https://pub-a1dc6f8107c2492a8769db1059666e2f.r2.dev/custom-perk-icon.svg'
              },
              app: {
                id: payload.app_id || 'app_bPQ2OhdUYFDmQh',
                name: 'PaperTrader'
              }
            };
            
            // Set access level if available
            if (payload.access_level) {
              accessLevel = payload.access_level;
            }
          }
        } else {
          // Fallback for non-JWT tokens
          userData = {
            id: 'dev-user',
            name: 'Whop Dev User',
            email: 'dev@whop.com',
            username: 'whopdev',
            profilePicture: null
          };
          
          // Create mock experience data
          experienceData = {
            id: 'exp_0nzaoQGLShrbRK',
            name: 'PaperTrader',
            description: 'Paper trading platform for Whop users',
            logo: {
              sourceUrl: 'https://pub-a1dc6f8107c2492a8769db1059666e2f.r2.dev/custom-perk-icon.svg'
            },
            app: {
              id: 'app_bPQ2OhdUYFDmQh',
              name: 'PaperTrader'
            }
          };
        }
      } catch (err) {
        console.error('Error parsing dev token:', err);
        // Fallback data
        userData = {
          id: 'dev-user',
          name: 'Whop Dev User',
          email: 'dev@whop.com',
          username: 'whopdev',
          profilePicture: null
        };
      }
    } 
    // If we have an access token, fetch user data from Whop
    else if (whopAccessToken) {
      const userResponse = await fetch('https://api.whop.com/v5/me', {
        headers: {
          'Authorization': `Bearer ${whopAccessToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!userResponse.ok) {
        console.error('Error fetching user from Whop API:', await userResponse.text());
        // If the token is invalid, return unauthorized
        return NextResponse.json(
          { error: 'Invalid or expired Whop token' },
          { status: 401 }
        );
      }
      
      const userData = await userResponse.json();
      
      // Try to get experience data if available
      try {
        const experienceResponse = await fetch('https://api.whop.com/v5/me/experiences/current', {
          headers: {
            'Authorization': `Bearer ${whopAccessToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (experienceResponse.ok) {
          experienceData = await experienceResponse.json();
          
          // Get access level if available
          if (experienceData && experienceData.id) {
            const accessResponse = await fetch(`https://api.whop.com/v5/experiences/${experienceData.id}/access_level`, {
              headers: {
                'Authorization': `Bearer ${whopAccessToken}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (accessResponse.ok) {
              const accessData = await accessResponse.json();
              accessLevel = accessData.access_level || 'member';
            }
          }
        }
      } catch (error) {
        console.error('Error fetching experience data:', error);
        // Continue without experience data
      }
    }
    
    console.log('Returning user data:', userData);
    
    // Auto-sync Whop user to Supabase (fire and forget)
    if (userData && userData.id) {
      syncWhopUserToSupabase(userData).catch(error => {
        console.error('Background Whop sync failed:', error);
        // Don't fail the request if sync fails
      });
    }
    
    // Return combined data
    return NextResponse.json({
      ...userData,
      experience: experienceData,
      accessLevel
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store', // Prevent caching to ensure fresh data
      },
    });
  } catch (error) {
    console.error('Error fetching user data from Whop:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch user data' },
      { status: 500 }
    );
  }
}

// Helper function to get cookie value
function getCookieValue(cookies: string, name: string): string | null {
  const match = cookies.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? match[2] : null;
}

// Auto-sync Whop user to Supabase
async function syncWhopUserToSupabase(whopUserData: any): Promise<void> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/auth/whop-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(whopUserData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log('Whop user synced to Supabase:', result.message);
    } else {
      const error = await response.json();
      console.error('Failed to sync Whop user to Supabase:', error);
    }
  } catch (error) {
    console.error('Error calling Whop sync API:', error);
  }
} 