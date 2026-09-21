/**
 * Central place to read environment variables so a missing key produces one
 * clear error instead of an obscure runtime failure.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function hasEnv(name: string): boolean {
  return Boolean(process.env[name]);
}

/** True when the Supabase server-side client can be constructed. */
export function supabaseConfigured(): boolean {
  return hasEnv("NEXT_PUBLIC_SUPABASE_URL") && hasEnv("SUPABASE_SERVICE_ROLE_KEY");
}
