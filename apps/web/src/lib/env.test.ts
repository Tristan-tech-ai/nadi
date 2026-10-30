import { describe, expect, it } from "vitest";
import { readPublicEnv } from "./env";

describe("readPublicEnv", () => {
  it("mengembalikan env publik bila lengkap", () => {
    expect(
      readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" }),
    ).toEqual({ supabaseUrl: "https://x.supabase.co", supabasePublishableKey: "sb_publishable_x" });
  });

  it("menyebut semua nama env yang kurang", () => {
    expect(() => readPublicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });
});
