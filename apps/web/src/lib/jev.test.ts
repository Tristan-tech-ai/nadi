import { describe, expect, it } from "vitest";
import { bentukKeputusan, GalatKeputusan, langkahBerikut, panggilKeputusan } from "./jev";

describe("bentuk keputusan", () => {
  it("boolean menjadi ya/tidak dengan keyakinan sisi terbesar", () => {
    expect(bentukKeputusan({ type: "boolean", probability: 0.98 })).toEqual({ pilihan: "ya", peluang: { ya: 0.98, tidak: 1 - 0.98 }, yakin: 0.98 });
    expect(bentukKeputusan({ type: "boolean", probability: 0.1 })).toMatchObject({ pilihan: "tidak", yakin: 0.9 });
  });
  it("choice memakai choice dan confidence dari model, atau peluang terbesar bila tidak ada", () => {
    expect(bentukKeputusan({ type: "choice", choice: "admin", probabilities: { pemilik: 0.2, admin: 0.8 }, confidence: 0.7 }))
      .toEqual({ pilihan: "admin", peluang: { pemilik: 0.2, admin: 0.8 }, yakin: 0.7 });
    expect(bentukKeputusan({ type: "choice", probabilities: { pemilik: 0.9, admin: 0.1 } })).toMatchObject({ pilihan: "pemilik", yakin: 0.9 });
  });
  it("score memilih anak tangga dengan peluang terbesar", () => {
    expect(bentukKeputusan({ type: "score", score: 2.97, probabilities: { "0": 0, "1": 0, "2": 0.02, "3": 0.98 } })).toMatchObject({ pilihan: "3", yakin: 0.98 });
  });
  it("refusal atau bentuk asing jatuh ke manusia", () => {
    expect(bentukKeputusan({ type: "refusal" })).toEqual({ tolak: true });
    expect(bentukKeputusan({ type: "boolean" })).toEqual({ tolak: true });
    expect(bentukKeputusan(null)).toEqual({ tolak: true });
    expect(langkahBerikut({ tolak: true })).toBe("manusia");
  });
  it("tangga: 0,85 langsung, 0,5 model ringan, di bawahnya manusia", () => {
    const k = (yakin: number) => ({ pilihan: "ya", peluang: {}, yakin });
    expect(langkahBerikut(k(0.85))).toBe("langsung");
    expect(langkahBerikut(k(0.84))).toBe("model_ringan");
    expect(langkahBerikut(k(0.5))).toBe("model_ringan");
    expect(langkahBerikut(k(0.49))).toBe("manusia");
  });
});

describe("panggil keputusan", () => {
  const tanya = { cocok: { type: "boolean" as const, instructions: "Sesuai kebijakan?" } };
  it("mengirim Bearer + model + state + questions dan membaca usage serta biaya", async () => {
    let dikirim: { url: string; init: RequestInit } | null = null;
    const palsu = (async (url: string, init: RequestInit) => {
      dikirim = { url, init };
      return Response.json({ model: "m-uji", answers: { cocok: { type: "boolean", probability: 0.93 } }, usage: { inputTokens: 120, outputTokens: 4 }, providerMetadata: { gateway: { cost: "0.00000504" } } });
    }) as unknown as typeof fetch;
    const h = await panggilKeputusan({ token: "tkn", model: "m-uji", state: "Sakit 1 hari, ada surat.", questions: tanya }, palsu);
    expect(dikirim!.url).toBe("https://ai-gateway.vercel.sh/v1/evaluate");
    expect((dikirim!.init.headers as Record<string, string>).Authorization).toBe("Bearer tkn");
    expect(JSON.parse(String(dikirim!.init.body))).toEqual({ model: "m-uji", state: "Sakit 1 hari, ada surat.", questions: tanya });
    expect(h).toMatchObject({ model: "m-uji", jawaban: { cocok: { pilihan: "ya", yakin: 0.93 } }, token: { masuk: 120, keluar: 4 }, biayaUsd: 0.00000504 });
  });
  it("galat gateway (kredit, akses) dilempar dengan status dan pesan", async () => {
    const palsu = (async () => Response.json({ error: { message: "Insufficient credits", type: "insufficient_funds" } }, { status: 402 })) as unknown as typeof fetch;
    await expect(panggilKeputusan({ token: "t", model: "m", state: "x", questions: tanya }, palsu)).rejects.toMatchObject({ status: 402, message: "Insufficient credits" });
    await expect(panggilKeputusan({ token: "t", model: "m", state: "x", questions: tanya }, palsu)).rejects.toBeInstanceOf(GalatKeputusan);
  });
});
