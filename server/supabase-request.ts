import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

type AuthenticatedSupabaseRequest = {
  supabase: SupabaseClient;
  user: User;
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.EXPO_PUBLIC_SUPABASE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase server credentials are not configured.");
  }

  return { publishableKey, url };
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export async function getAuthenticatedSupabaseRequest(
  request: Request,
): Promise<AuthenticatedSupabaseRequest | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const { publishableKey, url } = getSupabaseConfig();
  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return { supabase, user };
}
