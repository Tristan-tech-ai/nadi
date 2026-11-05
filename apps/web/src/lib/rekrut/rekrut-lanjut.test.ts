import { describe, expect, test } from "vitest";
import { buatIcs, escapeTeks, lipat, waktuUtc } from "./ics";
import { jobPosting, periksaJobPosting, type LowonganPublik } from "./job-posting";

describe("ics", () => {
  test("struktur RFC 5545: CRLF, wajib ada, waktu UTC", () => {
    const t = buatIcs({ uid: "abc@nadi", mulai: new Date("2026-11-10T02:00:00Z"), selesai: new Date("2026-11-10T02:45:00Z"), judul: "Wawancara Pelayan, Warung Bu Sari",
      lokasi: "Jl. Uji 1; Denpasar", keterangan: "Bawa KTP\nDatang 10 menit lebih awal", dibuat: new Date("2026-11-06T00:00:00Z") });
    const baris = t.split("\r\n");
    expect(t.endsWith("\r\n")).toBe(true);
    expect(t.replace(/\r\n/g, "")).not.toMatch(/\n/);
    for (const k of ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nadi//Rekrutmen//ID", "UID:abc@nadi", "DTSTAMP:20261106T000000Z", "DTSTART:20261110T020000Z", "DTEND:20261110T024500Z", "END:VCALENDAR"])
      expect(baris).toContain(k);
    expect(t).toContain("SUMMARY:Wawancara Pelayan\\, Warung Bu Sari");
    expect(t).toContain("LOCATION:Jl. Uji 1\\; Denpasar");
    expect(t).toContain("DESCRIPTION:Bawa KTP\\nDatang 10 menit lebih awal");
    expect(t).not.toMatch(/METHOD:/);
  });
  test("lipat <= 75 oktet tanpa memotong huruf multibita, buka lipatan = asal", () => {
    const panjang = "DESCRIPTION:" + "Wawancara di kedai kopi Ñusa ✓ ".repeat(8);
    const l = lipat(panjang);
    for (const b of l.split("\r\n")) expect(new TextEncoder().encode(b).length).toBeLessThanOrEqual(75);
    expect(l.replace(/\r\n /g, "")).toBe(panjang);
  });
  test("escape dan waktu", () => {
    expect(escapeTeks("a\\b;c,d")).toBe("a\\\\b\\;c\\,d");
    expect(waktuUtc(new Date("2026-01-02T03:04:05.678Z"))).toBe("20260102T030405Z");
  });
});

describe("JobPosting", () => {
  const l: LowonganPublik = { judul: "Pelayan shift malam", ringkasan: "Melayani tamu.\n\nJam 17.00-23.00.", usaha: "Warung Bu Sari", buka: true, dibuat_at: "2026-11-01T03:00:00Z",
    kota: "Denpasar", wilayah: "Bali", jenis: "PART_TIME", gaji_min: 2500000, gaji_max: 3000000, gaji_satuan: "MONTH", berlaku_sampai: "2026-12-31", terindeks: true };
  test("lowongan terindeks: properti wajib Google lengkap", () => {
    const d = jobPosting(l, "ABCDEFGH", "https://nadi-swart.vercel.app/lamar/ABCDEFGH", "2026-11-06")!;
    expect(periksaJobPosting(d)).toEqual([]);
    expect(d).toMatchObject({ title: "Pelayan shift malam", datePosted: "2026-11-01", employmentType: "PART_TIME", validThrough: "2026-12-31T23:59:59+07:00",
      jobLocation: { address: { addressLocality: "Denpasar", addressRegion: "Bali", addressCountry: "ID" } },
      baseSalary: { currency: "IDR", value: { minValue: 2500000, maxValue: 3000000, unitText: "MONTH" } } });
    expect(d.description).toBe("<p>Melayani tamu.</p><p>Jam 17.00-23.00.</p>");
  });
  test("tanpa data bila tertutup, tidak terindeks, kedaluwarsa, atau tanpa kota", () => {
    expect(jobPosting({ ...l, buka: false }, "K", "u", "2026-11-06")).toBeNull();
    expect(jobPosting({ ...l, terindeks: false }, "K", "u", "2026-11-06")).toBeNull();
    expect(jobPosting(l, "K", "u", "2027-01-01")).toBeNull();
    expect(jobPosting({ ...l, kota: null }, "K", "u", "2026-11-06")).toBeNull();
  });
  test("uji struktur menangkap data rusak", () => {
    expect(periksaJobPosting({ "@type": "JobPosting", title: "X", description: "X", datePosted: "kemarin", employmentType: "FREELANCE" }))
      .toEqual(["description", "datePosted", "hiringOrganization.name", "jobLocation.address.addressCountry", "employmentType"]);
  });
});

describe("waktu zona usaha", () => {
  test("jam dinding WITA/WIB/WIT ke UTC", async () => {
    const { waktuZona } = await import("./ics");
    expect(waktuZona("2026-11-10T09:30", "Asia/Makassar")?.toISOString()).toBe("2026-11-10T01:30:00.000Z");
    expect(waktuZona("2026-11-10T09:30", "Asia/Jakarta")?.toISOString()).toBe("2026-11-10T02:30:00.000Z");
    expect(waktuZona("2026-11-10T00:30", "Asia/Jayapura")?.toISOString()).toBe("2026-11-09T15:30:00.000Z");
    expect(waktuZona("10/11/2026 09.30", "Asia/Jakarta")).toBeNull();
  });
});
