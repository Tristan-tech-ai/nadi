// Gerbang keputusan cepat (model keputusan lewat AI Gateway, docs/research/jev.md). Murni kecuali panggilKeputusan.
// ID model tidak ditulis di sini: pemanggil memberinya dari konfigurasi (env NADI_MODEL_KEPUTUSAN).

export type Pertanyaan =
  | { type: "boolean"; instructions: string; criteria?: { true: string; false: string } }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

/** Bentuk jawaban yang sama untuk Jev dan fallback model ringan: pilihan, peluang tiap opsi, keyakinan. */
export type Keputusan = { pilihan: string; peluang: Record<string, number>; yakin: number } | { tolak: true };

export type HasilKeputusan = {
  model: string;
  jawaban: Record<string, Keputusan>;
  token: { masuk: number; keluar: number };
  biayaUsd: number | null;
  ms: number;
};

export const AMBANG = { langsung: 0.85, modelRingan: 0.5 } as const;

/** Tangga kecerdasan: yakin >= 0,85 dipakai langsung, 0,5 sampai 0,85 diteruskan ke model ringan, di bawahnya ke manusia. */
export function langkahBerikut(k: Keputusan): "langsung" | "model_ringan" | "manusia" {
  if ("tolak" in k) return "manusia";
  if (k.yakin >= AMBANG.langsung) return "langsung";
  return k.yakin >= AMBANG.modelRingan ? "model_ringan" : "manusia";
}

const angka = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
const terbesar = (p: Record<string, number>) => Object.entries(p).reduce((a, b) => (b[1] > a[1] ? b : a), ["", -1] as [string, number]);

/** Satu jawaban /v1/evaluate menjadi Keputusan. Bentuk yang tidak dikenal dianggap tolak (jatuh ke manusia). */
export function bentukKeputusan(j: unknown): Keputusan {
  const a = (j ?? {}) as { type?: string; probability?: unknown; choice?: unknown; probabilities?: unknown; confidence?: unknown };
  if (a.type === "boolean") {
    const p = angka(a.probability);
    if (p === null) return { tolak: true };
    return { pilihan: p >= 0.5 ? "ya" : "tidak", peluang: { ya: p, tidak: 1 - p }, yakin: Math.max(p, 1 - p) };
  }
  if (a.type === "choice" || a.type === "score") {
    const peluang: Record<string, number> = {};
    for (const [k, v] of Object.entries((a.probabilities ?? {}) as Record<string, unknown>)) {
      const n = angka(v);
      if (n !== null) peluang[k] = n;
    }
    const [atas, pAtas] = terbesar(peluang);
    if (pAtas < 0) return { tolak: true };
    const pilihan = a.type === "choice" && typeof a.choice === "string" ? a.choice : atas;
    return { pilihan, peluang, yakin: angka(a.confidence) ?? pAtas };
  }
  return { tolak: true };
}

/** POST <gateway>/v1/evaluate. Token OIDC deployment dipakai sebagai Bearer dan tidak pernah dicatat. */
export async function panggilKeputusan(
  o: { token: string; model: string; state: unknown; questions: Record<string, Pertanyaan>; dasar?: string },
  ambil: typeof fetch = fetch,
): Promise<HasilKeputusan> {
  const t0 = Date.now();
  const res = await ambil(`${o.dasar ?? "https://ai-gateway.vercel.sh"}/v1/evaluate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${o.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: o.model, state: o.state, questions: o.questions }),
    signal: AbortSignal.timeout(15_000),
  });
  const ms = Date.now() - t0;
  const body = (await res.json().catch(() => null)) as {
    model?: string;
    answers?: Record<string, unknown>;
    usage?: { inputTokens?: number; outputTokens?: number };
    providerMetadata?: { gateway?: { cost?: string } };
    error?: { message?: string; type?: string } | string;
  } | null;
  if (!res.ok || !body?.answers) {
    const e = body?.error;
    const pesan = typeof e === "string" ? e : (e?.message ?? `status ${res.status}`);
    throw new GalatKeputusan(res.status, pesan.slice(0, 300), ms);
  }
  const jawaban: Record<string, Keputusan> = {};
  for (const k of Object.keys(o.questions)) jawaban[k] = bentukKeputusan(body.answers[k]);
  const biaya = Number(body.providerMetadata?.gateway?.cost);
  return {
    model: body.model ?? o.model,
    jawaban,
    token: { masuk: body.usage?.inputTokens ?? 0, keluar: body.usage?.outputTokens ?? 0 },
    biayaUsd: Number.isFinite(biaya) ? biaya : null,
    ms,
  };
}

export class GalatKeputusan extends Error {
  constructor(readonly status: number, pesan: string, readonly ms: number) {
    super(pesan);
  }
}
