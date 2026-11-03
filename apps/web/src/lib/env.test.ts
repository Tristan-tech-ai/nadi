import { describe, expect, it } from "vitest";
import { readPublicEnv } from "./env";

describe("readPublicEnv", () => {
  it("mengembalikan env publik bila lengkap", () => {
    expect(
      readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" }),
    ).toEqual({ supabaseUrl: "https://x.supabase.co", supabasePublishableKey: "sb_publishable_x" });
  });

  it("membuang spasi dan CRLF di ujung nilai (env Vercel pernah tersimpan dengan CRLF; URL WebSocket Realtime menolaknya)", () => {
    expect(
      readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: " https://x.supabase.co\r\n", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x\r\n" }),
    ).toEqual({ supabaseUrl: "https://x.supabase.co", supabasePublishableKey: "sb_publishable_x" });
    expect(() => readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "\r\n", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x" })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("menyebut semua nama env yang kurang", () => {
    expect(() => readPublicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });
});
