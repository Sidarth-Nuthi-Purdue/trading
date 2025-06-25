import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { toast } from '@/components/ui/use-toast';

// Create a Supabase client for use in browser components
export const supabaseClient = createClientComponentClient();

// Enhanced registration function with better error handling
export async function registerUser(email: string, password: string, firstName: string, lastName: string) {
  try {
    // First check if the user already exists
    const { data: existingUsers } = await supabaseClient
      .from('users')
      .select('email')
      .eq('email', email)
      .limit(1);
      
    if (existingUsers && existingUsers.length > 0) {
      return { error: { message: 'User with this email already exists' } };
    }
    
    // Register the user
    const { data: authData, error: authError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    
    if (authError) {
      console.error('Registration error:', authError);
      
      // Provide more user-friendly error messages
      if (authError.message.includes('duplicate key value')) {
        return { error: { message: 'This email is already registered. Please log in instead.' } };
      }
      
      return { error: authError };
    }
    
    // Successfully registered
    return { data: authData };
  } catch (error: any) {
    console.error('Unexpected registration error:', error);
    return { error: { message: 'An unexpected error occurred during registration. Please try again.' } };
  }
}

// Enhanced login function with better error handling
export async function loginUser(email: string, password: string) {
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Login error:', error);
      
      // Provide more user-friendly error messages
      if (error.message.includes('Invalid login credentials')) {
        return { error: { message: 'Invalid email or password. Please try again.' } };
      }
      
      return { error };
    }
    
    return { data };
  } catch (error: any) {
    console.error('Unexpected login error:', error);
    return { error: { message: 'An unexpected error occurred during login. Please try again.' } };
  }
}

// Logout function
export async function logoutUser() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
      return { error };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Unexpected logout error:', error);
    return { error: { message: 'An unexpected error occurred during logout. Please try again.' } };
  }
}

// Function to check if user is logged in
export async function checkUserSession() {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error) {
      console.error('Session check error:', error);
      return { error };
    }
    
    return { session };
  } catch (error: any) {
    console.error('Unexpected session check error:', error);
    return { error: { message: 'An unexpected error occurred checking your session.' } };
  }
}

// Function to display toast notifications for auth operations
export function showAuthToast(type: 'success' | 'error', message: string) {
  toast({
    title: type === 'success' ? 'Success' : 'Error',
    description: message,
    variant: type === 'success' ? 'default' : 'destructive',
  });
} 