import { describe, expect, it } from "vitest";
import { formatDurasi, mimeDasar, pilihMime } from "./rekam";

describe("pilihMime", () => {
  it("memilih kandidat pertama yang didukung (Chromium: webm opus, Safari: mp4)", () => {
    expect(pilihMime(() => true)).toBe("audio/webm;codecs=opus");
    expect(pilihMime((m) => m === "audio/mp4")).toBe("audio/mp4");
    expect(pilihMime((m) => m.startsWith("audio/ogg"))).toBe("audio/ogg;codecs=opus");
  });
  it("null bila tidak ada format yang didukung", () => {
    expect(pilihMime(() => false)).toBeNull();
  });
});

describe("mimeDasar dan formatDurasi", () => {
  it("parameter codecs dibuang untuk unggahan", () => {
    expect(mimeDasar("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(mimeDasar("Audio/MP4")).toBe("audio/mp4");
  });
  it("detik menjadi m:ss", () => {
    expect(formatDurasi(0)).toBe("0:00");
    expect(formatDurasi(42.7)).toBe("0:42");
    expect(formatDurasi(90)).toBe("1:30");
  });
});
