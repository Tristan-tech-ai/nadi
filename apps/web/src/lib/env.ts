// Validasi env publik. Rahasia server tidak pernah dibaca di sini.
export type PublicEnv = {
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export function readPublicEnv(
  source: Record<string, string | undefined> = process.env,
): PublicEnv {
  const supabaseUrl = source.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !supabasePublishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Env wajib belum diatur: ${missing.join(", ")}`);
  }
  return {
    supabaseUrl: supabaseUrl as string,
    supabasePublishableKey: supabasePublishableKey as string,
  };
}
