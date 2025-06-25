/**
 * Cookie utilities for client-side use
 */

/**
 * Set a cookie with the specified options
 */
export function setCookie(
  name: string,
  value: string,
  options: {
    path?: string;
    maxAge?: number;
    domain?: string;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  } = {}
) {
  if (typeof document === 'undefined') return;
  
  // Check if we're in an iframe context
  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    // If we can't access window.top due to security restrictions,
    // we're definitely in an iframe from another domain
    isInIframe = true;
  }
  
  const {
    path = '/',
    maxAge = 60 * 60 * 24 * 7, // 7 days default
    domain = '',
    // If in iframe, always use secure=true
    secure = isInIframe || process.env.NODE_ENV === 'production' || window.location.protocol === 'https:',
    // If in iframe, always use SameSite=none
    sameSite = isInIframe ? 'none' : 'lax',
  } = options;

  let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=${path}; max-age=${maxAge}`;
  
  // Add SameSite attribute
  cookie += `; SameSite=${sameSite}`;
  
  // For SameSite=None, Secure must be true
  const finalSecure = sameSite === 'none' ? true : secure;
  
  if (domain) {
    cookie += `; domain=${domain}`;
  }
  
  if (finalSecure) {
    cookie += '; Secure';
  }
  
  document.cookie = cookie;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | undefined | null {
  if (typeof document === 'undefined') return undefined;
  
  // First try the parts method
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${encodeURIComponent(name)}=`);
  
  if (parts.length === 2) {
    return decodeURIComponent(parts.pop()?.split(';').shift() || '');
  }
  
  // Fallback to the loop method
  const cookies = document.cookie.split(';');
  
  for (let cookie of cookies) {
    const [cookieName, cookieValue] = cookie.trim().split('=');
    
    if (cookieName === encodeURIComponent(name)) {
      return decodeURIComponent(cookieValue);
    }
  }
  
  return null;
}

/**
 * Delete a cookie by name
 */
export function deleteCookie(name: string, path = '/') {
  if (typeof document === 'undefined') return;
  
  // Check if we're in an iframe context
  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }
  
  // For cross-site contexts, need to use SameSite=None; Secure
  if (isInIframe) {
    document.cookie = `${encodeURIComponent(name)}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure`;
  } else {
    document.cookie = `${encodeURIComponent(name)}=; path=${path}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }
}

/**
 * Check if a cookie exists
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null && getCookie(name) !== undefined;
}

/**
 * Get all cookies as an object
 */
export function getAllCookies(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  
  const cookies: Record<string, string> = {};
  const cookiesList = document.cookie.split(';');
  
  for (let cookie of cookiesList) {
    if (cookie.trim()) {
      const [name, value] = cookie.trim().split('=');
      if (name) cookies[decodeURIComponent(name)] = decodeURIComponent(value || '');
    }
  }
  
  return cookies;
}

/**
 * Checks if any Whop authentication token exists
 */
export function hasWhopAuthToken(): boolean {
  return hasCookie('whop_access_token') || hasCookie('whop_dev_user_token');
}

/**
 * Clear all authentication cookies to fix issues with Supabase
 */
export function clearAuthCookies() {
  if (typeof document === 'undefined') return;

  // List of potential Supabase auth cookie patterns
  const cookiePatterns = [
    'sb-',          // Matches all Supabase cookies
    'supabase-auth' // Legacy cookie name
  ];

  // Get all cookies
  const cookies = document.cookie.split(';');

  // Loop through all cookies
  cookies.forEach(cookie => {
    const [name] = cookie.trim().split('=');
    
    // Check if this cookie matches any of our patterns
    if (name && cookiePatterns.some(pattern => name.includes(pattern))) {
      // Clear the cookie by setting expiration in the past
      deleteCookie(name);
      console.log(`Cleared auth cookie: ${name}`);
    }
  });
}

/**
 * Log all cookies (for debugging)
 */
export function logAllCookies() {
  if (typeof document === 'undefined') {
    console.log('No cookies available (server-side)');
    return {};
  }
  
  const cookies = getAllCookies();
  console.log('All cookies: ', cookies);
  return cookies;
}

/**
 * Fix all Supabase cookie issues
 */
export function fixSupabaseAuthCookies() {
  // First log the current cookies
  console.log('Before cleanup:');
  logAllCookies();
  
  // Clear all problematic cookies
  clearAuthCookies();
  
  // Log the cookies after cleanup
  console.log('After cleanup:');
  logAllCookies();
  
  // Force a page refresh to apply cookie changes
  if (typeof window !== 'undefined') {
    console.log('Refreshing page to apply cookie changes...');
    window.location.reload();
  }
} 