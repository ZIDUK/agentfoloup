import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

/**
 * Lazy initialization of Supabase client to avoid build-time errors
 * when environment variables are not available during Docker builds
 */
export const getSupabaseClient = () => {
  // Check if Supabase is configured
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // Validate that both URL and key exist and are not empty strings
  // Also check if URL looks like a valid URL (starts with http) to avoid JWT tokens
  const isValidUrl = supabaseUrl && 
    typeof supabaseUrl === 'string' && 
    supabaseUrl.trim().length > 0 &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'));
  
  const isValidKey = supabaseKey && 
    typeof supabaseKey === 'string' && 
    supabaseKey.trim().length > 0;
  
  if (!isValidUrl || !isValidKey) {
    // During build time, we need to handle this gracefully
    // Return a mock client that will fail gracefully at runtime
    // but won't break the build
    const mockQuery = {
      select: () => mockQuery,
      insert: () => mockQuery,
      update: () => mockQuery,
      delete: () => mockQuery,
      eq: () => mockQuery,
      filter: () => mockQuery,
      or: () => mockQuery,
      order: () => mockQuery,
      single: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: any) => resolve({ data: null, error: null }),
    };
    
    return {
      from: () => mockQuery,
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    } as any;
  }
  
  return createClientComponentClient();
};

