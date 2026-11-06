/* Babak F (tagihan QRIS), G (gaji), H (jalan sendiri, tanya). STORY.md.
 * BEAT SHEET
 *  91,0 F  "Tagih lewat tautan. Pelanggan bayar pakai QRIS."                       (musik)
 *  93,2 F  tagihan publik Toko Bu Sari -> Hotel Segara Rp1.448.000, QRIS           whoosh
 *  97,4 F  koin masuk ke QRIS; 98,4 cocok dengan mutasi; cap LUNAS                  koin, impact
 * 104,0 G  "Gaji dihitung sendiri, lengkap PPh 21 dan BPJS."                       (musik)
 * 106,4 G  draf gaji: 2 ditahan Gerbang Gaji; Dodi Pratama, alasan; rincian BPJS PPh tick
 * 114,0 G  "Yang janggal ditahan dulu sampai kamu cek."                            (musik)
 * 116,6 H  alur: nama, Ketika Invoice lunas, kerja Kirim pesanan {nomor}, Buat alur  ketik, click
 * 123,6 H  tiga invoice lunas -> tiga kerja Kirim pesanan di daftar gudang          koin, pop
 * 131,0 H  "Tanya angkanya. Nadi tunjukkan sumbernya." lalu Laba bulan ini berapa?  ketik, pop
 */
DUR = 139.0;

/** Isian (input) pertama setelah label berteks `teks`, untuk diketik per huruf. */
function isianSetelah(f, teks) {
  const semua = [...f.querySelectorAll("*")];
  const i = semua.findIndex((e) => (e.textContent || "").trim().startsWith(teks) && e.children.length === 0);
  return semua.slice(i).find((e) => e.tagName === "INPUT" || e.tagName === "TEXTAREA");
}
const kotakDari = (f, e) => { const fr = f.getBoundingClientRect(), r = e.getBoundingClientRect(); return { x: r.left - fr.left, y: r.top - fr.top, w: r.width, h: r.height }; };
function koinKecil(induk, d) { const c = el("canvas", "titik", induk); c.width = c.height = 520; gambarKoin(c); c.style.width = c.style.height = d + "px"; return c; }

// =====================================================================================================
// F: tagihan QRIS (91 - 104)
// =====================================================================================================
adeganKalimat(91.0, 93.2, ["Tagih lewat tautan.", "Pelanggan bayar pakai QRIS."], [[1, 3, 3]]);
const F2 = lapisUI(93.2, 104.0, "#EFE9DD");
const fInv = pasang("invoice-publik", F2.cam); fInv.style.visibility = "inherit";
const RI = { status: cariTeks(fInv, "Belum dibayar"), total: cariTeks(fInv, "Rp1.448.000", 0), qris: cariTeks(fInv, "Cara bayar"), nominal: cariTeks(fInv, "Pindai, lalu ketik nominal") };
const UI_ = UKUR["invoice-publik"];
const sorotTotal = stabilo(fInv, RI.total, 4);
const capLunas = cap(F2.L, "LUNAS", "#23704A");
const tutupStatus = el("div", "", fInv); tutupStatus.style.cssText = `position:absolute;left:${RI.status.x - 6}px;top:${RI.status.y - 4}px;width:${RI.status.w + 12}px;height:${RI.status.h + 8}px;background:#FFFDF8;z-index:26;border-radius:6px`;
const koinF = koinKecil(F2.L, 120);
const cocok = el("div", "titik nowrap", F2.L, "Cocok dengan mutasi rekening: Rp1.448.000 dari Hotel Segara");
cocok.style.cssText += ";background:#1C1B18;color:#F6F2EA;font-size:28px;font-weight:600;padding:20px 30px;border-radius:16px";
let petaF = (x, y) => [x, y];
babak(93.2, 104.0, F2.L, (t) => {
  F2.larut(t);
  const [qx, qy] = tengah(UI_.qris), [sx, sy] = tengah(RI.status);
  const a = ease(seg(t, 94.6, 96.2)), b = ease(seg(t, 98.0, 99.2));
  const px = lerp(lerp(256, qx, a), 256, b), py = lerp(lerp(sy + 120, qy, a), 480, b), s = lerp(lerp(1.9, 2.1, a), 1.4, b);
  petaF = bidik(fInv, px, py, s);
  sorotTotal(seg(t, 95.0, 95.4));
  // koin terbang masuk ke kode QR (pelanggan membayar), menyusut seperti dipindai
  const [kx, ky] = petaF(qx, qy), u = seg(t, 96.4, 97.4), masukQR = seg(t, 97.4, 97.8);
  pos(koinF, lerp(1700, kx, keluar(u)), lerp(160, ky, ease(u)) - Math.sin(u * Math.PI) * 120, lerp(1.4, 1, u) * (1 - masukQR), u * 540, u > 0 ? 1 - masukQR : 0);
  tutupStatus.style.opacity = seg(t, 98.9, 99.0);
  const [cx, cy] = petaF(RI.status.x + RI.status.w / 2, RI.status.y + RI.status.h / 2);
  capLunas(cx - 10, cy + 6, seg(t, 99.0, 99.25), -6);
  const pc = keluar(seg(t, 98.3, 98.7));
  pos(cocok, 960, lerp(1130, 1032, pc), 1, 0, pc * (1 - seg(t, 103.2, 103.6)));
});

// =====================================================================================================
// G: gaji (104 - 116,6)
// =====================================================================================================
adeganKalimat(104.0, 106.4, ["Gaji dihitung sendiri,", "lengkap PPh 21 dan BPJS."], [[1, 1, 4]]);
const G2 = lapisUI(106.4, 114.0);
const fGaji = pasang("gaji-draf", G2.cam); fGaji.style.visibility = "inherit";
tutupSisi(fGaji, 340);
// rincian gaji Dodi dibuka dulu (tertutup saat ditangkap), lalu kotak BPJS dan PPh 21 diukur di dalamnya
const rinciDodi = [...fGaji.querySelectorAll("details")].find((d) => (d.textContent || "").includes("Gaji pokok")); if (rinciDodi) rinciDodi.open = true;
const RG = { pesan: cariTeks(fGaji, "Draf gaji siap"), dodi: cariTeks(fGaji, "Dodi Pratama"), alasan: cariTeks(fGaji, "Belum ada absen atau izin sejak 31 Okt"),
  bpjs: rinciDodi ? cariTeks(fGaji, "BPJS Kesehatan", 0, rinciDodi) : { x: 0, y: 0, w: 0, h: 0 }, pph: rinciDodi ? cariTeks(fGaji, "PPh 21", 0, rinciDodi) : { x: 0, y: 0, w: 0, h: 0 } };
const sorotPesan = stabilo(fGaji, RG.pesan, 4), sorotAlasan = stabilo(fGaji, RG.alasan, 4), sorotBpjs = stabilo(fGaji, { ...RG.bpjs, x: RG.bpjs.x - 62, w: 540 }, 4), sorotPph = stabilo(fGaji, { ...RG.pph, x: RG.pph.x - 62, w: 540 }, 4);
babak(106.4, 114.0, G2.L, (t) => {
  G2.larut(t);
  const a = ease(seg(t, 107.6, 108.6)), b = ease(seg(t, 110.0, 111.0));
  const py = lerp(lerp(RG.pesan.y + 60, RG.alasan.y, a), RG.pph.y - 60, b);
  bidik(fGaji, lerp(820, 780, a), py, lerp(1.7, 1.85, a));
  sorotPesan(seg(t, 106.9, 107.3)); sorotAlasan(seg(t, 108.7, 109.2)); sorotBpjs(seg(t, 111.2, 111.6)); sorotPph(seg(t, 111.9, 112.3));
});
adeganKalimat(114.0, 116.6, ["Yang janggal ditahan dulu,", "sampai kamu cek."], [[0, 1, 3]]);

// =====================================================================================================
// H: jalan sendiri (116,6 - 131) dan tanya (131 - 139)
// =====================================================================================================
const H1 = lapisUI(116.6, 123.6);
const fAlur = pasang("alur", H1.cam); fAlur.style.visibility = "inherit";
tutupSisi(fAlur, 340);
const inNama = isianSetelah(fAlur, "Nama alur"), inKerja = isianSetelah(fAlur, "Judul kerja baru");
const pilihKetika = [...fAlur.querySelectorAll("select")].find((e) => [...e.options].some((o) => o.text === "Invoice lunas"));
const RA = { nama: kotakDari(fAlur, inNama), kerja: kotakDari(fAlur, inKerja), ketika: kotakDari(fAlur, pilihKetika), buat: cariTeks(fAlur, "Buat alur") };
const sorotKetika = stabilo(fAlur, RA.ketika, 6);
const toastAlur = el("div", "titik nowrap", H1.L, "Alur dibuat dan langsung aktif.");
toastAlur.style.cssText += ";background:#1C1B18;color:#F6F2EA;font-size:30px;font-weight:600;padding:22px 34px;border-radius:16px";
let petaH = (x, y) => [x, y];
const ketik = (teks, t, t0, cps = 25) => teks.slice(0, Math.max(0, Math.floor((t - t0) * cps)));
babak(116.6, 123.6, H1.L, (t) => {
  H1.larut(t);
  const a = ease(seg(t, 118.2, 119.0)), b = ease(seg(t, 119.9, 120.7)), c = ease(seg(t, 121.4, 122.0));
  const py = lerp(lerp(lerp(RA.nama.y + 20, RA.ketika.y + 40, a), RA.kerja.y, b), RA.buat.y - 60, c);
  petaH = bidik(fAlur, lerp(RA.nama.x + 300, RA.buat.x + 300, c), py, lerp(1.75, 1.6, c));
  inNama.value = ketik("Kirim pesanan setelah lunas", t, 117.0); inNama.setAttribute("value", inNama.value);
  inKerja.value = ketik("Kirim pesanan {nomor}", t, 120.3); inKerja.setAttribute("value", inKerja.value);
  sorotKetika(seg(t, 118.9, 119.3));
  const pt = keluar(seg(t, 122.4, 122.8));
  pos(toastAlur, 960, lerp(1100, 940, pt), 1, 0, pt);
});
KLIK.push([121.2, 123.0, (t) => { const [x, y] = petaH(RA.buat.x + 40, RA.buat.y + RA.buat.h / 2); return lengkung([x + 480, y - 180], [x, y], 121.2, 121.9)(t); }, [122.05]]);

// H2: diagram konkret, tiga kali terjadi
const H2 = lapis("#F6F2EA", 8), camH2 = el("div", "dunia", H2);
const judulH2 = kalimat(camH2, "Tiap invoice lunas, pesanan langsung masuk daftar kerja gudang.", 40, "#1C1B18", 650);
const INV = [["001/INV/XI/2026", "Hotel Segara", "Rp1.448.000"], ["002/INV/XI/2026", "Kafe Senja Sanur", "Rp612.000"], ["003/INV/XI/2026", "Warung Pak Made", "Rp385.000"]];
const kartuInvH = INV.map(([no, untuk, rp]) => {
  const e = el("div", "titik", camH2, `<div style="font-size:20px;color:#5B574F;font-weight:600">Invoice ${no}</div><div style="font-size:30px;font-weight:700;margin-top:6px">${untuk}</div><div style="font-size:34px;font-weight:800;margin-top:10px">${rp}</div>`);
  e.style.cssText += ";width:460px;padding:26px 30px;border-radius:16px;background:#FFFDF8;box-shadow:0 1px 0 #DDD5C6,0 16px 40px rgba(28,27,24,.08)"; return e;
});
const capH = INV.map(() => cap(camH2, "LUNAS", "#23704A"));
const koinH = INV.map(() => koinKecil(camH2, 90));
const gudang = el("div", "titik", camH2, `<div style="font-size:24px;font-weight:700;color:#5B574F;margin-bottom:18px">Kerja · Gudang</div>`);
gudang.style.cssText += ";width:560px;height:520px;padding:26px 30px;border-radius:20px;background:#EFE9DD";
const kerjaH = INV.map(([no]) => { const e = el("div", "", gudang, `<span style="width:22px;height:22px;border-radius:6px;border:3px solid #5B574F;display:inline-block;margin-right:16px;vertical-align:-4px"></span>Kirim pesanan ${no}`); e.style.cssText = "font-size:26px;font-weight:600;background:#FFFDF8;border-radius:12px;padding:18px 20px;margin-bottom:14px"; return e; });
const panahH = el("canvas", "", camH2); panahH.width = W; panahH.height = H; panahH.style.cssText = "position:absolute;left:0;top:0";
babak(123.6, 131.0, H2, (t) => {
  const o = Math.min(seg(t, 123.6, 123.95), 1 - seg(t, 130.62, 131.0)); H2.style.opacity = o; camH2.style.filter = o < 1 ? `blur(${(1 - o) * 12}px)` : "none";
  munculKata(judulH2, t, 123.8, 0.05); pos(judulH2.e, 960, 150);
  const g = panahH.getContext("2d"); g.clearRect(0, 0, W, H);
  INV.forEach((_, i) => {
    const y = 330 + i * 210, t0 = 124.6 + i * 1.7;
    pos(kartuInvH[i], 560, y, 1, 0, keluar(seg(t, 123.9 + i * 0.12, 124.3 + i * 0.12)));
    const u = seg(t, t0, t0 + 0.55), hilang = seg(t, t0 + 0.55, t0 + 0.75);
    pos(koinH[i], 560 + 180, lerp(-80, y, masuk(u)), 1 - 0.6 * hilang, u * 400, u > 0 ? 1 - hilang : 0);
    capH[i](560 + 150, y - 10, seg(t, t0 + 0.55, t0 + 0.8), -8);
    // panah dari invoice ke daftar kerja, lalu kartu kerja muncul
    const pa = seg(t, t0 + 0.8, t0 + 1.25);
    if (pa > 0) {
      g.strokeStyle = "#E9A825"; g.lineWidth = 5; g.lineCap = "round"; g.beginPath();
      const x0 = 800, x1 = lerp(800, 1150, keluar(pa)), y1 = lerp(y, 345 + i * 86, keluar(pa));
      g.moveTo(x0, y); g.quadraticCurveTo((x0 + 1150) / 2, y, x1, y1); g.stroke();
    }
    const pk = keluar(seg(t, t0 + 1.15, t0 + 1.5));
    kerjaH[i].style.opacity = pk; kerjaH[i].style.transform = `translateX(${(1 - pk) * 40}px)`;
  });
  pos(gudang, 1450, 560, 1, 0, keluar(seg(t, 124.0, 124.4)));
});

adeganKalimat(131.0, 133.4, ["Tanya angkanya.", "Nadi tunjukkan sumbernya."], [[1, 2, 2]]);
const H3 = lapisUI(133.4, 139.0);
const fTanya = pasang("tanya", H3.cam); fTanya.style.visibility = "inherit";
tutupSisi(fTanya, 340);
const inTanya = isianSetelah(fTanya, "Pertanyaanmu");
const RT = { tanya: kotakDari(fTanya, inTanya), jawab: cariTeks(fTanya, "Laba 1 Nov 2026"), rp: cariTeks(fTanya, "Rp1.448.000"), sumber: cariTeks(fTanya, "Lihat sumbernya"), tombol: cariTeks(fTanya, "Tanya", 2) };
const tutupJawab = el("div", "", fTanya); tutupJawab.style.cssText = `position:absolute;left:${RT.jawab.x - 10}px;top:${RT.jawab.y - 10}px;width:900px;height:${RT.sumber.y + RT.sumber.h - RT.jawab.y + 60}px;background:#F6F2EA;z-index:26`;
const sorotRp = stabilo(fTanya, RT.rp, 4), sorotSumber = stabilo(fTanya, RT.sumber, 4);
let petaT = (x, y) => [x, y];
babak(133.4, 139.0, H3.L, (t) => {
  H3.larut(t);
  const a = ease(seg(t, 135.5, 136.3));
  petaT = bidik(fTanya, RT.tanya.x + 380, lerp(RT.tanya.y + 30, RT.jawab.y + 30, a), lerp(1.9, 1.95, a));
  inTanya.value = ketik("Laba bulan ini berapa?", t, 133.8); inTanya.setAttribute("value", inTanya.value);
  tutupJawab.style.opacity = 1 - seg(t, 135.2, 135.5);
  sorotRp(seg(t, 136.4, 136.8)); sorotSumber(seg(t, 137.3, 137.7));
});
KLIK.push([134.3, 135.6, (t) => { const r = RT.tombol.w ? RT.tombol : { x: RT.tanya.x + RT.tanya.w + 20, y: RT.tanya.y, w: 80, h: RT.tanya.h }; const [x, y] = petaT(r.x + r.w / 2, r.y + r.h / 2); return lengkung([x + 300, y + 200], [x, y], 134.3, 134.9)(t); }, [135.05]]);
