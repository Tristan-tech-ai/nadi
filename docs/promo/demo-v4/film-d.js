/* Babak D (Nadi membaca, tahu dulu datanya masuk ke mana, setujui) dan E (AI-mu: obrolan, draf, terapkan). STORY.md.
 * BEAT SHEET
 * 34,0 D  koin di kotak berubah menjadi lingkaran memuat; berkas: Disiapkan, Dikirim, Dibaca, Siap     tick
 * 36,0 D  daftar Lempar: tiap "Siap disetujui" disorot                                                   tick
 * 38,6 D  kalimat "Tahu dulu, datanya masuk ke mana."                                                     (musik)
 * 41,0 D  kartu tagihan INV/2026/X/0007, "Kalau disetujui" disorot, klik Lihat rincian                     click
 * 43,0 D  rincian terbuka: Akan ditambah (3)                                                              pop
 * 46,2 D  klik Setujui, cap DITERIMA                                                                      click, impact
 * 48,6 E  koin melompat keluar dari kartu, menggelinding membuka kalimat AI-mu                             gelinding, whoosh
 * 56,0 E  obrolan dengan AI netral (Excel karyawan, baca data, Budi ganda, tulis draf 15 baris)            ketik, pop
 * 74,0 E  tinjau draf: baris masuk satu per satu, Perlu dicek, gaji tidak dicentang                       tick
 * 84,6 E  klik Terapkan 10 baris, toast batal 10 menit                                                    click, pop
 * 88,0 E  kalimat "AI-mu menyiapkan. Kamu yang memutuskan."                                               (musik)
 */
DUR = 91.0;

// ---- alat bersama babak UI ----
const pasang = (nama, induk) => { const f = document.getElementById("f-" + nama).content.firstElementChild.cloneNode(true); f.style.position = "absolute"; f.style.left = "0"; f.style.top = "0"; f.style.transformOrigin = "0 0"; induk.appendChild(f); return f; };
/** Kamera ke titik (px,py) potongan pada skala s: titik itu jatuh di (cx,cy) layar. Kembalikan fungsi peta potongan->layar. */
function bidik(f, px, py, s, cx = 960, cy = 540) {
  const tx = cx - px * s, ty = cy - py * s;
  f.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
  return (x, y) => [tx + x * s, ty + y * s];
}
const tengah = (r, fx = 0.5, fy = 0.5) => [r.x + r.w * fx, r.y + r.h * fy];
/** Kotak elemen terkecil di potongan yang teksnya diawali `teks`, diukur langsung dari DOM saat dimuat (ukur.json bisa meleset satu baris). */
function cariTeks(f, teks, ke = 0, akar = f) {
  const fr = f.getBoundingClientRect(), hasil = [];
  for (const e of akar.querySelectorAll("*")) { const t = (e.textContent || "").trim(); if (t.startsWith(teks) && ![...e.children].some((c) => (c.textContent || "").trim().startsWith(teks))) hasil.push(e); }
  const e = hasil[ke]; if (!e) return { x: 0, y: 0, w: 0, h: 0 };
  const r = e.getBoundingClientRect(); return { x: r.left - fr.left, y: r.top - fr.top, w: r.width, h: r.height };
}
/** Tutup bilah samping aplikasi di potongan supaya tidak terpotong tepi layar. */
const tutupSisi = (f, lebar) => { const e = el("div", "", f); e.style.cssText = `position:absolute;left:0;top:0;width:${lebar}px;height:100%;background:#F6F2EA;z-index:24`; };
/** Stabilo di atas potongan (koordinat potongan): sapuan kiri ke kanan, multiply supaya teks tetap terbaca. */
function stabilo(f, r, pad = 4) {
  const e = el("div", "", f); e.style.cssText = `position:absolute;left:${r.x - pad}px;top:${r.y - 1}px;width:${r.w + pad * 2}px;height:${r.h + 2}px;background:rgba(233,168,37,.55);mix-blend-mode:multiply;border-radius:3px;transform-origin:0 50%;z-index:30`;
  return (p) => { e.style.transform = `scaleX(${keluar(p)})`; e.style.opacity = p > 0 ? 1 : 0; };
}
// kursor panah (macOS), lapisan paling atas
const KUR = lapis("transparent", 40);
const kursor = el("div", "titik", KUR, `<svg width="44" height="52" viewBox="0 0 22 26"><path d="M2 1.5v19.2l5.1-4.6 3.3 7.6 3.3-1.4-3.3-7.4h6.9z" fill="#1C1B18" stroke="#FFFDF8" stroke-width="1.6" stroke-linejoin="round"/></svg>`);
const riakKlik = el("div", "titik", KUR); riakKlik.style.cssText += ";width:80px;height:80px;border-radius:50%;border:3px solid rgba(28,27,24,.45)";
const KLIK = []; // [t0, t1, jalur(t)->[x,y], tKlik[]]
babak(34, 1e9, KUR, (t) => {
  const k = KLIK.find((c) => t >= c[0] && t < c[1]);
  if (!k) { kursor.style.opacity = 0; riakKlik.style.opacity = 0; return; }
  const [x, y] = k[2](t);
  const tekan = k[3].reduce((m, tk) => Math.max(m, 1 - Math.abs(t - tk - 0.05) / 0.09), 0);
  kursor.style.transform = `translate(${x - 4}px,${y - 2}px) scale(${1 - 0.1 * clamp(tekan)})`; kursor.style.transformOrigin = "4px 2px";
  kursor.style.opacity = Math.min(seg(t, k[0], k[0] + 0.25), 1 - seg(t, k[1] - 0.25, k[1]));
  const tk = k[3].filter((c) => t >= c).pop();
  const p = tk == null ? 1 : seg(t, tk, tk + 0.5);
  riakKlik.style.opacity = p < 1 ? (1 - p) * 0.9 : 0;
  riakKlik.style.transform = `translate(${x - 40}px,${y - 40}px) scale(${0.3 + p})`;
});
/** Kursor bergerak melengkung dari a ke b dalam [t0,t1] (tiba lebih dulu, lalu diam). */
const lengkung = (a, b, t0, t1, bengkok = 0.18) => (t) => {
  const u = ease(seg(t, t0, t1)), mx = (a[0] + b[0]) / 2 - (b[1] - a[1]) * bengkok, my = (a[1] + b[1]) / 2 + (b[0] - a[0]) * bengkok;
  return [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * mx + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * my + u * u * b[1]];
};
/** Cap bergaya Nadi (garis tepi, kapital pendek, sedikit miring), turun dari atas lalu menetap. */
function cap(induk, teks, warna) {
  const e = el("div", "titik nowrap", induk, teks);
  e.style.cssText += `;border:5px solid ${warna};color:${warna};font-weight:800;font-size:44px;letter-spacing:.06em;padding:6px 22px;border-radius:10px;background:rgba(255,253,248,.85)`;
  return (x, y, p, r = -7) => { const q = keluar5(p); pos(e, x, y, lerp(2.2, 1, q), r, p > 0 ? Math.min(1, p * 3) : 0); };
}
/** Adegan kalimat pada kanvas polos (explainer-default): kata muncul, kamera mendorong masuk, satu frasa disorot, larut kabur keluar. */
function adeganKalimat(t0, t1, baris, sorotKata = [], ukuran = 50) {
  const L = lapis("#F6F2EA", 8), cam = el("div", "dunia", L);
  const ks = baris.map((b) => kalimat(cam, b, ukuran, "#1C1B18", 650));
  const sr = sorotKata.map(([i, a, b]) => { const s = el("span", "sorot", ks[i].e); return { s, i, a, b }; });
  babak(t0, t1, L, (t) => {
    const z = lerp(1, 1.42, ease(seg(t, t0 + 0.2, t1 - 0.2)));
    cam.style.transform = `translate(960px,540px) scale(${z}) translate(-960px,-540px)`;
    const keluarP = seg(t, t1 - 0.38, t1);
    L.style.opacity = 1 - keluarP; cam.style.filter = keluarP > 0 ? `blur(${keluarP * 10}px)` : "none";
    L.style.background = "#F6F2EA";
    ks.forEach((k, i) => { munculKata(k, t, t0 + 0.15 + i * 0.5); pos(k.e, 960, 540 + (i - (ks.length - 1) / 2) * ukuran * 1.35); });
    sr.forEach(({ s, i, a, b }) => {
      const k = ks[i], ka = k.kata[a], kb = k.kata[b];
      s.style.left = ka.offsetLeft - 8 + "px"; s.style.top = ka.offsetTop + 8 + "px";
      s.style.width = kb.offsetLeft + kb.offsetWidth - ka.offsetLeft + 4 + "px"; s.style.height = ka.offsetHeight - 12 + "px";
      s.style.transform = `scaleX(${keluar(seg(t, t0 + 1.0 + i * 0.5, t0 + 1.45 + i * 0.5))})`; s.style.opacity = 0.75;
    });
  });
  return L;
}
/** Lapisan potongan UI dengan larut kabur masuk/keluar 0,35 dtk. */
function lapisUI(t0, t1, latar = "#F6F2EA", z = 7) {
  const L = lapis(latar, z), cam = el("div", "dunia", L);
  const larut = (t) => { const a = seg(t, t0, t0 + 0.35), b = seg(t, t1 - 0.35, t1), o = Math.min(a, 1 - b); L.style.opacity = o; cam.style.filter = o < 1 ? `blur(${(1 - o) * 12}px)` : "none"; };
  return { L, cam, larut };
}

// =====================================================================================================
// D1: membaca (34,0 - 38,6): lempar-membaca lalu lempar-siap, koin menjadi lingkaran memuat
// =====================================================================================================
const D1 = lapisUI(34.0, 38.8);
const fBaca = pasang("lempar-membaca", D1.cam), fSiap = pasang("lempar-siap", D1.cam);
const UM = UKUR["lempar-membaca"], US = UKUR["lempar-siap"];
const sorotSiap = [0, 1, 2, 3, 4].map((i) => stabilo(fSiap, US["s" + i], 6));
const muat = el("div", "titik", D1.L, `<svg width="230" height="230" viewBox="0 0 70 70"><circle cx="35" cy="35" r="28" fill="none" stroke="#EFE9DD" stroke-width="7"/><circle class="busur" cx="35" cy="35" r="28" fill="none" stroke="#E9A825" stroke-width="7" stroke-linecap="round" stroke-dasharray="176" stroke-dashoffset="176" transform="rotate(-90 35 35)"/><path class="cek" d="M24 36l8 8 15-17" fill="none" stroke="#23704A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="40" stroke-dashoffset="40"/></svg>`);
const busur = muat.querySelector(".busur"), cek = muat.querySelector(".cek");
babak(34.0, 38.8, D1.L, (t) => {
  D1.larut(t); D1.L.style.opacity = 1; D1.cam.style.filter = "none"; // masuk tanpa larut: koin baru saja mendarat di kotak yang sama
  const siap = t >= 35.9;
  fBaca.style.visibility = siap ? "hidden" : "inherit"; fSiap.style.visibility = siap ? "inherit" : "hidden";
  if (!siap) {
    const [ax, ay] = tengah(UM.area), [dx, dy] = tengah(UM.daftar, 0.5, 0.2);
    const u = ease(seg(t, 34.5, 35.6));
    bidik(fBaca, lerp(ax, dx, u), lerp(ay, dy, u), lerp(2.6, 1.9, u));
  } else {
    // telusuri daftar: tiap baris Siap disetujui disorot berurutan
    const ys = [0, 1, 2, 3, 4].map((i) => US["s" + i].y);
    const u = seg(t, 36.1, 38.4), py = lerp(ys[0] + 40, ys[4] - 60, ease(u));
    bidik(fSiap, 290, py, 1.75);
    sorotSiap.forEach((f, i) => f(seg(t, 36.2 + i * 0.42, 36.6 + i * 0.42)));
    if (t > 38.45) D1.larut(t);
  }
  // lingkaran memuat menggantikan koin, lalu centang
  const pm = seg(t, 34.25, 35.7), tampak = seg(t, 34.15, 34.35) * (1 - seg(t, 35.85, 36.05));
  pos(muat, 960, 640 - ease(seg(t, 34.5, 35.6)) * 0, 1, t * 240 * (1 - pm), tampak);
  busur.setAttribute("stroke-dashoffset", String(176 * (1 - keluar(pm))));
  cek.setAttribute("stroke-dashoffset", String(40 * (1 - keluar(seg(t, 35.55, 35.8)))));
});
KOIN_TAMBAH.push((t) => { if (t >= 34.0 && t < 48.6) koin.style.opacity = 1 - seg(t, 34.0, 34.25); });

// =====================================================================================================
// D2/D3: tahu dulu datanya masuk ke mana, setujui (38,6 - 48,6)
// =====================================================================================================
adeganKalimat(38.6, 41.0, ["Tahu dulu, datanya masuk ke mana."], [[0, 2, 5]]);
const D2 = lapisUI(41.0, 49.2);
const fRinci = pasang("feed-rincian", D2.cam);
const UR = UKUR["feed-rincian"];
fRinci.style.visibility = "inherit";
// semua kotak dicari di dalam kartu tagihan INV/2026/X/0007 (potongan Feed memuat beberapa kartu)
const kartuInv = (() => { let e = [...fRinci.querySelectorAll("*")].find((x) => (x.textContent || "").trim().startsWith("Catat tagihan INV") && x.children.length === 0);
  while (e && !((e.textContent || "").includes("Akan ditambah") && (e.textContent || "").includes("Tolak"))) e = e.parentElement; return e || fRinci; })();
const RK = { kalau: cariTeks(fRinci, "Kalau disetujui", 0, kartuInv), tambah: cariTeks(fRinci, "Akan ditambah", 0, kartuInv), lihat: cariTeks(fRinci, "Lihat rincian", 0, kartuInv),
  setujui: cariTeks(fRinci, "Setujui", 0, kartuInv), judul: cariTeks(fRinci, "Catat tagihan INV", 0, kartuInv) };
const sorotKalau2 = stabilo(fRinci, RK.kalau, 6);
const sorotTambah = stabilo(fRinci, RK.tambah, 6);
const capD = cap(D2.L, "DITERIMA", "#23704A");
let petaD2 = (x, y) => [x, y];
babak(41.0, 49.2, D2.L, (t) => {
  D2.larut(t);
  // dekat pada judul kartu dan "Kalau disetujui"; setelah Lihat rincian diklik, kamera turun ke isi rincian, lalu ke Setujui
  const k = UR.kartu, [rx, ry] = tengah(RK.tambah, 0.5, 3.5), [sx, sy] = tengah(RK.setujui);
  const u = ease(seg(t, 42.6, 43.5)), v = ease(seg(t, 44.7, 45.6));
  petaD2 = bidik(fRinci, lerp(k.x + k.w / 2, sx + 40, v), lerp(lerp(RK.judul.y + 150, ry, u), sy - 160, v), lerp(lerp(2.3, 2.4, seg(t, 41, 42.5)), 1.75, u) * lerp(1, 1.05, v));
  sorotKalau2(seg(t, 41.45, 41.9)); sorotTambah(seg(t, 43.5, 43.95));
  const [cx, cy] = petaD2(RK.setujui.x + 120, RK.setujui.y + 24);
  capD(cx + 360, cy - 96, seg(t, 46.3, 46.55));
});
// klik Lihat rincian, lalu Setujui (posisi dihitung dari kamera D2 saat itu)
KLIK.push([41.6, 42.75, (t) => { const [x, y] = petaD2(RK.lihat.x + 40, RK.lihat.y + RK.lihat.h / 2); return lengkung([x + 360, y + 220], [x, y], 41.6, 42.3)(t); }, [42.4]]);
KLIK.push([45.4, 47.0, (t) => { const [x, y] = petaD2(RK.setujui.x + 150, RK.setujui.y + RK.setujui.h / 2); return lengkung([x + 420, y + 160], [x, y], 45.4, 46.05)(t); }, [46.15]]);

// =====================================================================================================
// E1: koin keluar dan menggelinding membuka kalimat (48,6 - 56,0)
// =====================================================================================================
const E1 = lapis("#F6F2EA", 9), camE1 = el("div", "dunia", E1);
const e1a = kalimat(camE1, "Punya AI sendiri?", 58, "#1C1B18", 700);
const e1b = kalimat(camE1, "Kerjakan langsung dari obrolan.", 58, "#1C1B18", 700);
const R_KOIN = 92; // jari-jari koin saat menggelinding (skala 92/260)
const jalurGelinding = (t) => {
  // keluar dari kartu (melompat), jatuh ke garis kalimat, menggelinding ke kanan lalu keluar layar
  if (t < 50.0) { const u = seg(t, 48.6, 50.0); return [lerp(1180, 300, ease(u)), lerp(470, 512, u) - Math.sin(u * Math.PI) * 330, u * -540]; }
  const u = seg(t, 50.0, 55.4), x = lerp(300, 2150, u * u * (3 - 2 * u) * 0.35 + u * 0.65);
  return [x, 512, (x - 300) / R_KOIN * 180 / Math.PI];
};
babak(48.6, 56.2, E1, (t) => {
  E1.style.opacity = seg(t, 48.6, 48.9);
  const kx = t < 50.0 ? 0 : jalurGelinding(t)[0]; // kalimat hanya terbuka saat koin menggelinding ke kanan
  [e1a, e1b].forEach((k, i) => {
    pos(k.e, 960, 466 + i * 92);
    k.kata.forEach((w) => { w.style.opacity = 1; w.style.transform = "none"; });
    // kalimat terbuka tepat di belakang koin: yang sudah dilewati koin terlihat
    const lebar = k.e.offsetWidth, kiri = 960 - lebar / 2, buka = clamp((kx - kiri - (i ? 40 : 0)) / lebar);
    k.e.style.clipPath = `inset(-20px ${(1 - buka) * 100}% -20px 0)`;
  });
  const keluarP = seg(t, 55.7, 56.2); camE1.style.opacity = 1 - keluarP;
});
KOIN_TAMBAH.push((t) => {
  if (t < 48.6 || t >= 56.2) return;
  const [x, y, r] = jalurGelinding(t);
  koin.style.opacity = 1;
  koin.style.transform = `translate(${x - 260}px,${y - 260}px) scale(${R_KOIN / 260}) rotateZ(${r}deg)`;
  KOIN.style.zIndex = 20;
});

// =====================================================================================================
// E2: obrolan dengan AI-mu (56,0 - 74,4)
// =====================================================================================================
const E2 = lapisUI(56.0, 74.6, "#EFE9DD");
const jendela = el("div", "", E2.cam);
jendela.style.cssText = "position:absolute;left:0;top:0;width:1100px;height:1500px;background:#FFFDF8;border-radius:28px;box-shadow:0 1px 0 #DDD5C6,0 30px 80px rgba(28,27,24,.12);transform-origin:0 0";
const kepalaJ = el("div", "", jendela, `<span style="width:14px;height:14px;border-radius:50%;background:#DDD5C6;display:inline-block;margin-right:8px"></span><span style="width:14px;height:14px;border-radius:50%;background:#DDD5C6;display:inline-block;margin-right:8px"></span><span style="width:14px;height:14px;border-radius:50%;background:#DDD5C6;display:inline-block;margin-right:22px"></span>AI milikmu · tersambung ke Nadi`);
kepalaJ.style.cssText = "position:absolute;left:0;top:0;right:0;height:76px;border-bottom:1px solid #ECE6DA;display:flex;align-items:center;padding:0 30px;font-size:22px;font-weight:600;color:#5B574F";
const isiJ = el("div", "", jendela); isiJ.style.cssText = "position:absolute;left:44px;right:44px;top:110px;display:grid;gap:22px;align-content:start";
const PESAN = [
  ["aku", 56.6, "Aku punya toko, 10 karyawan. Ini Excel karyawan kami.", "karyawan-berantakan.xlsx"],
  ["ai", 59.4, "Aku baca dulu."], ["alat", 60.3, "Nadi · baca data usaha"],
  ["ai", 61.8, "Ketemu 10 orang dan gaji pokoknya. Budi Santoso muncul dua kali di Excel. Aku tandai supaya kamu cek, ya?"],
  ["aku", 65.0, "Iya. Budi sekarang kasir pagi."],
  ["alat", 67.6, "Nadi · tulis draf · 15 baris"],
  ["ai", 69.0, "Drafnya sudah di Nadi. Gaji tidak aku centang, kamu yang periksa."],
];
const gelembung = PESAN.map(([siapa, t0, teks, lampiran]) => {
  const g = el("div", "", isiJ);
  if (siapa === "alat") {
    g.style.cssText = "justify-self:start;display:flex;gap:14px;align-items:center;border:1px solid #DDD5C6;border-radius:14px;padding:14px 20px;font-size:22px;font-weight:600;color:#1C1B18;background:#F6F2EA";
    g.innerHTML = `<svg width="26" height="26" viewBox="0 0 32 32"><path d="M5 27.5L6.75 26 8.5 27.5 10.25 26 12 27.5V15a4 4 0 0 1 8 0V27.5L21.75 26 23.5 27.5 25.25 26 27 27.5V15A11 11 0 0 0 5 15Z" fill="#1C1B18"/><circle cx="27.5" cy="4.5" r="3" fill="#E9A825"/></svg><span>${teks}</span><span class="status" style="margin-left:6px;width:26px;height:26px;border-radius:50%;border:3px solid #E9A825;border-right-color:transparent;display:inline-block"></span>`;
  } else {
    g.style.cssText = `max-width:78%;font-size:27px;line-height:1.45;padding:18px 24px;border-radius:24px;${siapa === "aku" ? "justify-self:end;background:#1C1B18;color:#F6F2EA;border-bottom-right-radius:8px" : "justify-self:start;background:#EFE9DD;color:#1C1B18;border-bottom-left-radius:8px"}`;
    g.innerHTML = `<span class="teks"></span>${lampiran ? `<div style="margin-top:14px;display:flex;gap:12px;align-items:center;background:rgba(246,242,234,.12);border-radius:12px;padding:10px 14px;font-size:21px"><span style="background:#1E7145;color:#fff;font-weight:800;font-size:15px;padding:3px 8px;border-radius:5px">XLSX</span>${lampiran}</div>` : ""}`;
  }
  return { g, siapa, t0, teks, lampiran };
});
const masukan = el("div", "", jendela); masukan.style.cssText = "position:absolute;left:44px;right:44px;bottom:40px;height:84px;border:1px solid #DDD5C6;border-radius:42px;display:flex;align-items:center;padding:0 32px;font-size:26px;color:#1C1B18";
babak(56.0, 74.6, E2.L, (t) => {
  E2.larut(t);
  let tinggiIsi = 0, ketik = "";
  gelembung.forEach((b, i) => {
    // pesan pemilik diketik dulu di kotak masukan (25 huruf/dtk), lalu terkirim; pesan AI muncul per kata
    const ketikMulai = b.t0 - b.teks.length / 25 - 0.2;
    if (b.siapa === "aku" && t >= ketikMulai && t < b.t0) ketik = b.teks.slice(0, Math.floor((t - ketikMulai) * 25));
    const tampak = t >= b.t0;
    b.g.style.display = tampak ? "" : "none";
    if (!tampak) return;
    const p = keluar(seg(t, b.t0, b.t0 + 0.35));
    b.g.style.opacity = p; b.g.style.transform = `translateY(${(1 - p) * 24}px)`;
    if (b.siapa === "ai") { const kata = b.teks.split(" "); b.g.querySelector(".teks").textContent = kata.slice(0, Math.max(1, Math.floor((t - b.t0) * 9))).join(" "); }
    if (b.siapa === "aku") b.g.querySelector(".teks").textContent = b.teks;
    if (b.siapa === "alat") {
      const s = b.g.querySelector(".status"), selesai = t > b.t0 + 0.9;
      s.style.border = selesai ? "none" : "3px solid #E9A825"; s.style.borderRightColor = selesai ? "" : "transparent";
      s.style.transform = selesai ? "none" : `rotate(${(t - b.t0) * 400}deg)`;
      s.innerHTML = selesai ? `<svg width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="13" fill="#23704A"/><path d="M7 13.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>` : "";
    }
    tinggiIsi = b.g.offsetTop + b.g.offsetHeight;
  });
  masukan.textContent = ketik || "Tulis pesan";
  masukan.style.color = ketik ? "#1C1B18" : "#A8A196";
  // kamera: dekat pada pesan terbaru, ikut turun saat obrolan memanjang
  const fokusY = 110 + Math.max(260, tinggiIsi) - 120, s = lerp(1.18, 1.08, seg(t, 56, 74));
  const jy = 540 - Math.min(fokusY, 1500 - 470) * s + 0, jx = 960 - 550 * s;
  jendela.style.transform = `translate(${jx}px,${Math.min(140, jy)}px) scale(${s})`;
});

// =====================================================================================================
// E3/E4: tinjau draf di Nadi, terapkan (74,4 - 88,2)
// =====================================================================================================
const E3 = lapisUI(74.4, 88.2);
const fDraf = pasang("tinjau-draf", E3.cam);
tutupSisi(fDraf, 340);
const UD = UKUR["tinjau-draf"];
const tirai = el("div", "", fDraf); tirai.style.cssText = "position:absolute;left:0;right:0;bottom:0;background:#F6F2EA;z-index:25";
const sorotRagu = stabilo(fDraf, UD.ragu, 4), sorotGaji = stabilo(fDraf, UD.gaji, 4);
const toast = el("div", "titik nowrap", E3.L, "10 baris diterapkan. Bisa dibatalkan selama 10 menit.");
toast.style.cssText += ";background:#1C1B18;color:#F6F2EA;font-size:30px;font-weight:600;padding:22px 34px;border-radius:16px";
let petaE3 = (x, y) => [x, y];
babak(74.4, 88.2, E3.L, (t) => {
  E3.larut(t);
  // baris masuk satu per satu: tirai turun selangkah per baris (sekitar 74 px), kamera ikut
  const awal = UD.ringkas.y + 120, akhir = UD.gaji.y + 360, langkah = 74;
  const n = Math.floor(seg(t, 75.0, 81.2) * ((akhir - awal) / langkah)), batas = awal + n * langkah + langkah * keluar((t - 75.0) % 0.34 / 0.34);
  tirai.style.top = (t >= 81.2 ? UD.tinggi : Math.min(UD.tinggi, batas)) + "px";
  const tu = ease(seg(t, 81.6, 83.6)), [tx, ty] = tengah(UD.terapkan);
  const fy = lerp(Math.max(UD.ringkas.y + 260, Math.min(batas - 220, UD.gaji.y + 120)), ty - 200, tu);
  petaE3 = bidik(fDraf, lerp(UD.tinjau.x + UD.tinjau.w / 2, tx + 320, tu), t < 75.0 ? UD.ringkas.y + 260 : fy, lerp(1.32, 1.5, tu));
  sorotRagu(seg(t, 75.9, 76.3)); sorotGaji(seg(t, 80.2, 80.6));
  const pt = keluar(seg(t, 85.0, 85.4));
  pos(toast, 960, lerp(1100, 930, pt), 1, 0, pt * (1 - seg(t, 87.5, 87.9)));
});
KLIK.push([83.8, 85.6, (t) => { const [x, y] = petaE3(UD.terapkan.x + 80, UD.terapkan.y + 24); return lengkung([x + 520, y - 200], [x, y], 83.8, 84.5)(t); }, [84.65]]);
adeganKalimat(88.2, 91.0, ["AI-mu menyiapkan.", "Kamu yang memutuskan."], [[1, 0, 2]]);
KOIN_TAMBAH.push((t) => { if (t >= 56.2) koin.style.opacity = 0; }); // babak F memunculkan koin lagi
