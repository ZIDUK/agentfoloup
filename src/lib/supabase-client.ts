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
  
  // Create mock query builder
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
  
  // Create mock client
  const mockClient = {
    from: () => mockQuery,
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  };
  
  if (!isValidUrl || !isValidKey) {
    // During build time, return mock client to prevent build errors
    return mockClient as any;
  }
  
  // Only import and use createClientComponentClient if we have valid credentials
  // This prevents the error from being thrown during build
  try {
    // Dynamic import to avoid evaluation during build if not needed
    const { createClientComponentClient } = require("@supabase/auth-helpers-nextjs");
    return createClientComponentClient();
  } catch (error) {
    // If import fails (shouldn't happen, but just in case), return mock
    console.warn("Failed to create Supabase client, using mock:", error);
    return mockClient as any;
  }
};

