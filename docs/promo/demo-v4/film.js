/* Film demo Nadi v4. Cerita: STORY.md (babak A-E dari Tristan, F-L lanjutan). Cara: CARA.md (skill Barty-Bart/motion-graphics).
 * BEAT SHEET (detik, apa, bunyi):
 *  0,0  A  berkas menumpuk di satu titik, dekat                         ruang, kertas
 *  2,5  A  berkas merenggang sambil berputar; "Masih mengurus ... manual?" whoosh pelan
 *  5,0  A  "tiap malam?" / 6,2 "tiap hari?" / 7,4 "tiap bulan?"          tick per kata
 *  8,5  A  "Atau bayar aplikasi mahal ..."                                riser
 * 11,4  A  kalimat menerobos kamera                                       whoosh
 * 12,0  B  terowongan kartu harga resmi, makin cepat                      whoosh panjang
 * 17,8  B  keluar ke lapangan kunyit: Nadi, Mulai Rp0, Rp149.000          impact
 * 22,2  C  tarik mundur: semuanya di muka koin                            whoosh
 * 24,4  C  koin dilempar, berputar                                        koin
 * 28,6  C  koin jatuh ke kotak Lempar, riak; berkas menyusul               percik, pop
 */
"use strict";
const W = 1920, H = 1080;
let DUR = 34.0; // diperpanjang tiap berkas babak (film-d.js dst.)
window.VIDEO = { w: W, h: H, duration: DUR };
const RENDER = location.search.includes("render");

// ---- helper skill (explainer-engaging/default), apa adanya ----
function spring(t, w = 14, z = 0.82) {
  if (t <= 0) return 0;
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
const track = (v0, keys) => t => { let v = v0, p = v0; for (const [tk, val, w, z] of keys) { v += (val - p) * spring(t - tk, w, z); p = val; } return v; };
const kf = keys => t => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) { const [a, va] = keys[i - 1], [b, vb, e = ease] = keys[i]; if (t <= b) return lerp(va, vb, e((t - a) / (b - a))); } return keys[keys.length - 1][1]; };
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = x => (x = clamp(x), x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const rng = s => () => (s = (s + 0x6D2B79F5) | 0, s = Math.imul(s ^ (s >>> 15), 1 | s), s ^= s + Math.imul(s ^ (s >>> 7), 61 | s), ((s ^ (s >>> 14)) >>> 0) / 4294967296);
// kurva tambahan
const keluar = x => 1 - Math.pow(1 - clamp(x), 3);
const keluar5 = x => 1 - Math.pow(1 - clamp(x), 5);
const masuk = x => Math.pow(clamp(x), 3);
const linier = x => clamp(x);

// ---- panggung ----
const P = document.getElementById("panggung");
const el = (tag, cls, induk, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; (induk || P).appendChild(e); return e; };
const lapis = (bg, z) => { const e = el("div", "lapis"); e.style.background = bg || "transparent"; e.style.zIndex = z || 1; return e; };
const pos = (e, x, y, s = 1, r = 0, o = 1, extra = "") => { e.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${s}) rotate(${r}deg) ${extra}`; e.style.opacity = o; };
const BABAK = [];
const babak = (t0, t1, e, fn) => BABAK.push({ t0, t1, e, fn });

/** Kalimat dari kata-kata: tiap kata muncul naik 18 px berurutan. Kembalikan {e, kata, lebar}. */
function kalimat(induk, teks, ukuran, warna, berat = 600) {
  const e = el("div", "kalimat", induk);
  e.style.fontSize = ukuran + "px"; e.style.color = warna; e.style.fontWeight = berat;
  const kata = teks.split(" ").map((w, i, a) => el("span", "kata", e, w + (i < a.length - 1 ? "&nbsp;" : "")));
  return { e, kata };
}
function munculKata(k, t, t0, jeda = 0.085, lama = 0.42, naik = 18) {
  k.kata.forEach((w, i) => { const p = keluar(seg(t, t0 + i * jeda, t0 + i * jeda + lama)); w.style.opacity = p; w.style.transform = `translateY(${(1 - p) * naik}px)`; });
}

// ---- koin: digambar sekali ke kanvas (skill: gradien dan kilau dipanggang saat dimuat) ----
const LOGO = new Path2D("M5 27.5L6.75 26 8.5 27.5 10.25 26 12 27.5V15a4 4 0 0 1 8 0V27.5L21.75 26 23.5 27.5 25.25 26 27 27.5V15A11 11 0 0 0 5 15Z");
function gambarKoin(c, wajah = true) {
  const g = c.getContext("2d"), r = c.width / 2;
  const tepi = g.createRadialGradient(r * 0.7, r * 0.55, r * 0.1, r, r, r);
  tepi.addColorStop(0, "#FFE08A"); tepi.addColorStop(0.55, "#E9A825"); tepi.addColorStop(1, "#A86F0E");
  g.fillStyle = tepi; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(120,74,6,.55)"; g.lineWidth = r * 0.035; g.beginPath(); g.arc(r, r, r * 0.86, 0, Math.PI * 2); g.stroke();
  // gerigi tepi
  g.strokeStyle = "rgba(255,240,190,.35)"; g.lineWidth = r * 0.012;
  for (let i = 0; i < 120; i++) { const a = i / 120 * Math.PI * 2; g.beginPath(); g.moveTo(r + Math.cos(a) * r * 0.9, r + Math.sin(a) * r * 0.9); g.lineTo(r + Math.cos(a) * r * 0.985, r + Math.sin(a) * r * 0.985); g.stroke(); }
  const dalam = g.createRadialGradient(r * 0.8, r * 0.7, r * 0.05, r, r, r * 0.84);
  dalam.addColorStop(0, "#F7C552"); dalam.addColorStop(1, "#D9961A");
  g.fillStyle = dalam; g.beginPath(); g.arc(r, r, r * 0.84, 0, Math.PI * 2); g.fill();
  if (wajah) {
    g.save(); const s = r * 0.042; g.translate(r - 16 * s, r - 15.5 * s); g.scale(s, s);
    g.fillStyle = "rgba(255,236,170,.55)"; g.translate(0.35, 0.35); g.fill(LOGO); g.translate(-0.7, -0.7);
    g.fillStyle = "#5C3A06"; g.fill(LOGO);
    g.beginPath(); g.arc(27.5, 4.5, 3, 0, Math.PI * 2); g.fillStyle = "#FFF4D6"; g.fill();
    g.restore();
  }
  // kilau
  const kilau = g.createLinearGradient(0, 0, c.width, c.height);
  kilau.addColorStop(0.25, "rgba(255,255,255,0)"); kilau.addColorStop(0.42, "rgba(255,255,255,.22)"); kilau.addColorStop(0.5, "rgba(255,255,255,0)");
  g.fillStyle = kilau; g.beginPath(); g.arc(r, r, r, 0, Math.PI * 2); g.fill();
}

// =====================================================================================================
// BABAK A: berkas berserakan (0 - 12,6)
// =====================================================================================================
const A = lapis("#121110", 2);
A.style.perspective = "1600px";
const duniaA = el("div", "dunia", A);
const JENIS = { XLSX: "#1E7145", PDF: "#C8372D", DOCX: "#2B579A", CSV: "#6B655C", JPG: "#B5651D", PNG: "#B5651D" };
const BERKAS = [
  ["JPG", "nota-pemasok.jpg", "img", "assets/berkas/nota.png"], ["XLSX", "karyawan.xlsx", "grid"], ["PDF", "invoice-0007.pdf", "img", "assets/berkas/invoice.png"],
  ["DOCX", "surat-izin.docx", "baris"], ["CSV", "mutasi-oktober.csv", "baris"], ["XLSX", "absen-oktober.xlsx", "img", "assets/berkas/absen.png"],
  ["PDF", "slip-gaji.pdf", "img", "assets/berkas/slip.png"], ["JPG", "struk-spbu.jpg", "struk"], ["PNG", "chat-pesanan.png", "chat"],
  ["XLSX", "harga-menu.xlsx", "grid"], ["PDF", "faktur-pajak.pdf", "baris"], ["DOCX", "kontrak-sewa.docx", "baris"],
];
function ubinBerkas(induk, [ext, nama, isi, src], i) {
  const b = el("div", "berkas", induk);
  const pra = el("div", "pra", b);
  if (isi === "img") el("img", "", pra).src = src;
  else if (isi === "grid") { const g = el("div", "isi-grid", pra); for (let k = 0; k < 28; k++) el("i", k < 4 || k % 4 === 0 ? "k" : "", g); }
  else if (isi === "baris") { const g = el("div", "isi-baris", pra); for (let k = 0; k < 9; k++) { const x = el("i", "", g); x.style.width = `${55 + ((i * 7 + k * 13) % 40)}%`; } }
  else if (isi === "chat") { const g = el("div", "isi-chat", pra); for (let k = 0; k < 6; k++) el("i", k % 2 ? "kanan" : "", g); }
  else if (isi === "struk") { const g = el("div", "isi-struk", pra); for (let k = 0; k < 12; k++) { const x = el("i", "", g); x.style.width = `${40 + ((k * 17) % 55)}%`; } }
  el("div", "lipat", b);
  const kaki = el("div", "kaki", b);
  const l = el("span", "lencana", kaki, ext); l.style.background = JENIS[ext];
  el("span", "nama", kaki, nama);
  return b;
}
const r1 = rng(7);
const ubinA = BERKAS.map((d, i) => {
  const b = ubinBerkas(duniaA, d, i);
  const a = i / BERKAS.length * Math.PI * 2 + (r1() - 0.5) * 0.4;
  return {
    b, x0: 960 + (r1() - 0.5) * 70, y0: 540 + (r1() - 0.5) * 50, rz0: (r1() - 0.5) * 30,
    x1: 960 + Math.cos(a) * (600 + r1() * 260), y1: 540 + Math.sin(a) * (330 + r1() * 150), z1: -260 + r1() * 520,
    sp: (r1() - 0.5) * 26, f: r1() * 6,
  };
});
const AT = lapis("transparent", 6); // kalimat babak A di lapisan sendiri: selalu di atas berkas 3D
babak(0, 12.6, AT, () => {});
const tanya = el("div", "dunia", AT); tanya.style.transformStyle = "flat";
const L1 = kalimat(tanya, "Masih mengurus semua berkas ini manual?", 46, "#F6F2EA");
const KATA2 = ["tiap malam?", "tiap hari?", "tiap bulan?"].map((w) => kalimat(tanya, w, 46, "#F0B53D", 700));
const L3 = kalimat(tanya, "Atau bayar aplikasi mahal", 46, "#F6F2EA");
const L4 = kalimat(tanya, "untuk otomatisasi yang begitu-begitu saja?", 46, "#F6F2EA");
const sorotA = el("span", "sorot", L3.e);
const camA = kf([[0, 1.5], [2.0, 1.45], [6.5, 1.04], [11.4, 0.94], [12.6, 1.5, masuk]]);
babak(0, 12.6, A, (t) => {
  const cs = camA(t), roty = lerp(-5, 7, ease(seg(t, 0, 12)));
  const p = t < 1.4 ? 0 : 1 - Math.exp(-(t - 1.4) / 2.6);
  const tembus = masuk(seg(t, 11.3, 12.6));
  duniaA.style.transform = `translate(960px,540px) scale(${cs}) rotateY(${roty}deg) translate(-960px,-540px)`;
  ubinA.forEach((u, i) => {
    const x = lerp(u.x0, u.x1, p), y = lerp(u.y0, u.y1, p), z = lerp(i * 3, u.z1, p) + tembus * 1500;
    const rz = u.rz0 + t * u.sp * Math.min(1, p * 2), ry = Math.sin(t * 0.7 + u.f) * 30 * p, rx = Math.cos(t * 0.55 + u.f) * 16 * p;
    const keluarX = (x - 960) * tembus * 0.8, keluarY = (y - 540) * tembus * 0.8;
    u.b.style.transform = `translate3d(${x + keluarX - 115}px,${y + keluarY - 145}px,${z}px) rotateZ(${rz}deg) rotateY(${ry}deg) rotateX(${rx}deg)`;
  });
  // kalimat: pusat panggung, dorong masuk pelan, lalu menerobos kamera
  const ts = lerp(1, 1.12, ease(seg(t, 8.6, 11.4))) * lerp(1, 7, masuk(seg(t, 11.4, 12.4)));
  tanya.style.transform = `translate(960px,540px) scale(${ts}) translate(-960px,-540px)`;
  tanya.style.opacity = 1 - seg(t, 11.9, 12.4);
  const pergi1 = keluar(seg(t, 8.25, 8.6));
  munculKata(L1, t, 2.5);
  pos(L1.e, 960, 505 - pergi1 * 30, 1, 0, 1 - pergi1);
  KATA2.forEach((k, i) => {
    const a = 5.0 + i * 1.2, b = i < 2 ? a + 1.2 : 8.25;
    const pin = keluar(seg(t, a, a + 0.32)), pout = seg(t, b - 0.05, b + 0.25);
    pos(k.e, 960, 575 + (1 - pin) * 26 - pout * 26, 1, 0, Math.min(pin, 1 - pout));
    k.kata.forEach((w) => { w.style.opacity = 1; w.style.transform = "none"; });
  });
  munculKata(L3, t, 8.6); munculKata(L4, t, 9.15);
  pos(L3.e, 960, 500, 1, 0, t < 8.5 ? 0 : 1); pos(L4.e, 960, 568, 1, 0, t < 9.0 ? 0 : 1);
  // sorot di belakang "aplikasi mahal"
  const k0 = L3.kata[2], k1 = L3.kata[3];
  sorotA.style.left = (k0.offsetLeft - 6) + "px"; sorotA.style.top = (k0.offsetTop + 6) + "px";
  sorotA.style.width = (k1.offsetLeft + k1.offsetWidth - k0.offsetLeft + 4) + "px"; sorotA.style.height = (k0.offsetHeight - 8) + "px";
  sorotA.style.transform = `scaleX(${keluar(seg(t, 9.7, 10.15))})`; sorotA.style.opacity = 0.9;
  [k0, k1].forEach((k) => { k.style.color = t > 9.9 ? "#1C1B18" : ""; });
});

// =====================================================================================================
// BABAK B: terowongan harga resmi (12,0 - 22,2)
// =====================================================================================================
const B = lapis("#121110", 3);
B.style.perspective = "800px";
const duniaB = el("div", "terowongan", B);
const HARGA = [
  ["Kasir dan operasional", "Rp999.000", "per outlet per bulan"], ["Modul asisten AI", "+Rp499.000", "per outlet per bulan"],
  ["Akuntansi", "Rp674.250", "per bulan"], ["Gaji dan HR", "Rp20.000", "per karyawan per bulan"], ["Pajak", "mulai Rp250.000", "per bulan"],
  ["Kasir", "Rp799.000", "per outlet per bulan"], ["Modul keuangan", "+Rp499.000", "per outlet per bulan"], ["Akuntansi", "Rp399.900", "per bulan"],
  ["Gaji dan HR", "Rp12.500", "per karyawan per bulan"], ["Kasir dan operasional", "Rp499.000", "per outlet per bulan"],
];
const JARAK = 640, N = 20;
const sisi = [["kiri", -700, 0, "rotateY(68deg)"], ["kanan", 700, 0, "rotateY(-68deg)"], ["atas", 0, -430, "rotateX(-60deg)"], ["bawah", 0, 430, "rotateX(60deg)"]];
const r2 = rng(11);
const kartuB = Array.from({ length: N }, (_, k) => {
  const [jenis, rp, satuan] = HARGA[k % HARGA.length];
  const e = el("div", "harga", duniaB, `<span class="jenis">${jenis}</span><span class="rp">${rp}</span><span class="satuan">${satuan}</span>`);
  const s = sisi[k % 4];
  return { e, z: -700 - k * JARAK, x: s[1] + (s[0] === "atas" || s[0] === "bawah" ? (r2() - 0.5) * 700 : 0), y: s[2] + (s[0] === "kiri" || s[0] === "kanan" ? (r2() - 0.5) * 360 : 0), rot: s[3] };
});
const cincinB = Array.from({ length: N + 2 }, (_, k) => ({ e: el("div", "cincin", duniaB), z: -400 - k * JARAK }));
const ujung = el("div", "lapangan", duniaB); ujung.style.cssText += ";position:absolute;left:0;top:0;width:2400px;height:1500px;inset:auto";
const Z_UJUNG = -700 - N * JARAK - 500;
const garis = el("canvas", "", B); garis.width = W; garis.height = H; garis.style.cssText = "position:absolute;left:0;top:0";
const gg = garis.getContext("2d");
const sumber = el("div", "kecil-sumber", B, "Harga resmi di situs penyedia, dilihat 3 Nov 2026");
// B2: lapangan kunyit, harga Nadi (juga muka koin di babak C)
const wajah = el("div", "lapis", B); wajah.style.cssText += ";visibility:inherit;background:#E9A825";
const isiWajah = el("div", "dunia", wajah);
const logoB = el("div", "titik", isiWajah, `<svg width="150" height="150" viewBox="0 0 32 32"><path d="M5 27.5L6.75 26 8.5 27.5 10.25 26 12 27.5V15a4 4 0 0 1 8 0V27.5L21.75 26 23.5 27.5 25.25 26 27 27.5V15A11 11 0 0 0 5 15Z" fill="#1C1B18"/><circle cx="27.5" cy="4.5" r="3" fill="#FFFDF8"/></svg>`);
const nadiB = kalimat(isiWajah, "Nadi", 120, "#1C1B18", 800);
const nolB = kalimat(isiWajah, "Mulai Rp0.", 64, "#1C1B18", 800);
const usahaB = kalimat(isiWajah, "Rp149.000 per bulan untuk 15 orang.", 40, "#1C1B18", 600);
const camZ = (t) => { const u = seg(t, 12.0, 18.0); return (-Z_UJUNG + 200) * (0.22 * u + 0.38 * u * u + 0.4 * Math.pow(u, 3.2)); };
babak(12.0, 25.4, B, (t) => {
  B.style.transform = ""; // C menimpa saat menunduk
  const z = camZ(t), v = (camZ(t + 1 / 60) - camZ(t - 1 / 60)) * 30;
  duniaB.style.transform = `rotateZ(${Math.sin(t * 0.9) * 2.5}deg)`;
  kartuB.forEach((k) => {
    const zz = k.z + z; k.e.style.visibility = zz > 640 || zz < -9000 ? "hidden" : "inherit";
    k.e.style.transform = `translate3d(${k.x - 360}px,${k.y - 200}px,${zz}px) ${k.rot}`;
    k.e.style.opacity = clamp((zz + 9000) / 2500) * (t < 12.0 ? 0 : 1);
  });
  cincinB.forEach((c) => { const zz = c.z + z; c.e.style.visibility = zz > 700 || zz < -9000 ? "hidden" : "inherit"; c.e.style.transform = `translate3d(-750px,-450px,${zz}px)`; });
  const zu = Z_UJUNG + z; ujung.style.transform = `translate3d(-1200px,-750px,${Math.min(zu, 790)}px)`;
  duniaB.style.visibility = t >= 18.0 ? "hidden" : "inherit";
  // garis kecepatan: makin cepat makin panjang (acak berbenih, fungsi murni dari z)
  gg.clearRect(0, 0, W, H);
  const cepat = clamp(v / 9000), r3 = rng(5);
  if (t < 18.0 && cepat > 0.03) {
    gg.strokeStyle = `rgba(246,242,234,${0.10 + cepat * 0.3})`; gg.lineWidth = 2;
    for (let i = 0; i < 140; i++) {
      const a = r3() * Math.PI * 2, f = (r3() + z / 2600 * (0.6 + r3())) % 1, r = 140 + f * f * 1100, L = 30 + cepat * 260 * f;
      gg.beginPath(); gg.moveTo(960 + Math.cos(a) * r, 540 + Math.sin(a) * r); gg.lineTo(960 + Math.cos(a) * (r + L), 540 + Math.sin(a) * (r + L)); gg.stroke();
    }
  }
  sumber.style.opacity = seg(t, 12.6, 13.2) * (1 - seg(t, 16.8, 17.4));
  // B2 tampil setelah ujung terowongan menutupi layar
  const ada = t >= 17.95;
  wajah.style.visibility = ada && t < 24.1 ? "inherit" : "hidden";
  logoB.style.transform = `translate(960px,350px) translate(-50%,-50%) scale(${lerp(0.6, 1, keluar(seg(t, 18.05, 18.6)))})`; logoB.style.opacity = keluar(seg(t, 18.05, 18.4));
  munculKata(nadiB, t, 18.3); pos(nadiB.e, 960, 520);
  munculKata(nolB, t, 18.9, 0.09, 0.4, 24); pos(nolB.e, 960, 650);
  munculKata(usahaB, t, 19.4); pos(usahaB.e, 960, 735);
  // C1: tarik mundur cepat, semuanya mengecil ke muka koin
  const m = keluar5(seg(t, 22.2, 23.3));
  const R = lerp(1120, 260, m);
  wajah.style.clipPath = `circle(${R}px at 960px 540px)`;
  isiWajah.style.transform = `translate(960px,540px) scale(${lerp(1, 0.46, m)}) translate(-960px,-540px)`;
  isiWajah.style.opacity = 1 - seg(t, 23.5, 24.1);
});

// =====================================================================================================
// KOIN (pahlawan): muncul di 22,2 sebagai bingkai muka koin, dilempar 24,4, jatuh ke Lempar 28,6
// =====================================================================================================
const KOIN_TAMBAH = [];
const KOIN = lapis("transparent", 20);
KOIN.style.perspective = "1400px";
const koin = el("div", "koin", KOIN);
const muka = el("div", "muka", koin), balik = el("div", "balik", koin);
const kanvasKoin = [muka, balik].map((m) => { const c = el("canvas", "", m); c.width = c.height = 520; gambarKoin(c); return c; });
const cincinKoin = el("canvas", "", KOIN); cincinKoin.width = cincinKoin.height = 600; cincinKoin.style.cssText = "position:absolute;left:0;top:0";
{ const g = cincinKoin.getContext("2d"); const gr = g.createRadialGradient(300, 300, 250, 300, 300, 300); gr.addColorStop(0, "#A86F0E"); gr.addColorStop(0.5, "#FFE08A"); gr.addColorStop(1, "#8A5A0A");
  g.lineWidth = 34; g.strokeStyle = gr; g.beginPath(); g.arc(300, 300, 276, 0, Math.PI * 2); g.stroke(); }
// lintasan lempar: parabola dari (960,540) naik ke puncak, turun ke tengah area Lempar
const LEMPAR = { x: 960, y: 612 }; // diperbarui dari ukur area Lempar di babak C
function jalurKoin(t) {
  // dilempar ke atas keluar bingkai sambil berputar, kamera menunduk ke kotak Lempar, lalu koin jatuh cepat (gravitasi) ke kotak
  if (t < 24.4) return { x: 960, y: 540, s: 1, rx: 0 };
  if (t < 25.5) { const u = seg(t, 24.4, 25.5); return { x: 960, y: lerp(540, -460, keluar(u)), s: lerp(1, 0.8, u), rx: u * 900 }; }
  if (t < 28.15) return { x: 960, y: -460, s: 0.34, rx: 0 };
  const u = seg(t, 28.15, 28.6); return { x: LEMPAR.x, y: lerp(-260, LEMPAR.y, u * u), s: 0.34, rx: 900 + u * 540 };
}
babak(22.2, 1e9, KOIN, (t) => {
  const m = keluar5(seg(t, 22.2, 23.3));
  // bingkai cincin mengikuti lingkaran muka yang mengecil, lalu koin padat menggantikannya
  const R = lerp(1120, 260, m);
  cincinKoin.style.transform = `translate(${960 - 300}px,${540 - 300}px) scale(${R / 276})`;
  cincinKoin.style.opacity = seg(t, 22.4, 22.9) * (1 - seg(t, 23.5, 24.1));
  const j = jalurKoin(t), padat = seg(t, 23.5, 24.1);
  koin.style.opacity = padat;
  const jatuh = t > 28.6 ? keluar(seg(t, 28.6, 29.0)) : 0; // tenggelam sedikit saat menyentuh permukaan
  koin.style.transform = `translate(${j.x - 260}px,${j.y - 260}px) scale(${j.s * (1 - 0.12 * jatuh)}) rotateX(${j.rx}deg)`;
  KOIN_TAMBAH.forEach((f) => f(t)); // babak berikutnya mengambil alih koin
});

// =====================================================================================================
// BABAK C3: kotak Lempar (UI asli), riak, berkas menyusul seperti masuk kolam (24,4 - 34)
// =====================================================================================================
const C = lapis("#F6F2EA", 4);
const camC = el("div", "dunia", C);
const fLempar = document.getElementById("f-lempar-kosong").content.firstElementChild.cloneNode(true);
camC.appendChild(fLempar); fLempar.style.position = "absolute";
const UL = UKUR["lempar-kosong"], ar = UL.area;
const SC = 2.1; // skala potongan di layar: kotak Lempar mengisi sekitar 60% lebar
const fx = 960 - (ar.x + ar.w / 2) * SC, fy = 640 - (ar.y + ar.h / 2) * SC;
LEMPAR.x = 960; LEMPAR.y = 640;
const riak = Array.from({ length: 16 }, () => el("div", "riak", C));
const ubinC = BERKAS.slice(0, 9).map((d, i) => ({ b: ubinBerkas(C, d, i), t0: 29.0 + i * 0.36, dx: ((i * 37) % 9 - 4) * 46, r: ((i * 53) % 21 - 10) }));
ubinC.forEach((u) => { u.b.style.boxShadow = "0 2px 0 rgba(0,0,0,.08), 0 26px 50px rgba(28,27,24,.28)"; });
babak(24.4, 35.0, C, (t) => {
  // panggung terang naik dari bawah seperti kamera menunduk mengikuti koin
  const naik = ease(seg(t, 25.1, 27.0));
  C.style.transform = `translateY(${(1 - naik) * 1080}px)`;
  B.style.transform = `translateY(${-naik * 1080}px)`;
  const cs = lerp(1, 1.12, ease(seg(t, 28.6, 33.5)));
  camC.style.transform = `translate(960px,640px) scale(${cs}) translate(-960px,-640px)`;
  fLempar.style.transform = `translate(${fx}px,${fy}px) scale(${SC})`; fLempar.style.transformOrigin = "0 0";
  // riak: tiga cincin dari koin, satu dari tiap berkas yang jatuh
  const sumberRiak = [[28.6, 300], [28.78, 400], [28.96, 500], ...ubinC.map((u) => [u.t0 + 0.7, 220])];
  riak.forEach((rk, i) => {
    const s = sumberRiak[i]; if (!s) { rk.style.opacity = 0; return; }
    const p = seg(t, s[0], s[0] + 1.1), r = p * s[1];
    rk.style.width = rk.style.height = `${r * 2}px`;
    rk.style.transform = `translate(${960 - r}px,${640 - r * 0.55}px) scaleY(0.55)`; rk.style.transformOrigin = "50% 0";
    rk.style.opacity = p > 0 && p < 1 ? Math.pow(1 - p, 0.7) : 0;
  });
  ubinC.forEach((u) => {
    const p = seg(t, u.t0, u.t0 + 0.7), tenggelam = seg(t, u.t0 + 0.7, u.t0 + 1.2);
    const y = lerp(-300, 640, p * p * (1.6 - 0.6 * p)), s = 0.7 * (1 - 0.85 * keluar(tenggelam));
    pos(u.b, 960 + u.dx * (1 - tenggelam), y, s, u.r * (1 - p), p > 0 ? 1 - tenggelam : 0);
  });
});

