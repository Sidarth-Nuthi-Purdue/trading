import { createClient } from './server';

// This function verifies the user is authenticated on the server
export async function getUser() {
  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      throw error;
    }
    
    return { user: data.user, error: null };
  } catch (error: any) {
    console.error('Auth error:', error);
    return { user: null, error };
  }
}

// This function logs the user in with email and password
export async function loginWithPassword(email: string, password: string) {
  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw error;
    }
    
    return { session: data.session, error: null };
  } catch (error: any) {
    console.error('Login error:', error);
    return { session: null, error };
  }
}

// This function signs the user up with email and password
export async function signUp(email: string, password: string) {
  const supabase = await createClient();
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) {
      throw error;
    }
    
    return { user: data.user, error: null };
  } catch (error: any) {
    console.error('Signup error:', error);
    return { user: null, error };
  }
}

// This function signs the user out
export async function signOut() {
  const supabase = await createClient();
  
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      throw error;
    }
    
    return { error: null };
  } catch (error: any) {
    console.error('Signout error:', error);
    return { error };
  }
} 