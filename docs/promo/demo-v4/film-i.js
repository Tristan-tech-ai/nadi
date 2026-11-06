/* Babak I (kamera), J (belajar sendiri), K (di mana saja), L (penutup). STORY.md.
 * BEAT SHEET
 * 139,0 I  koin menggelinding di denah toko dari atas, kamera menunduk, denah menjadi CCTV asli   gelinding, whoosh
 * 141,6 I  rekaman CCTV asli dengan pelacakan Nadi; "CCTV yang sudah ada jadi penghitung pengunjung."  ruang toko
 * 150,6 I  gambar larut jadi kotak-kotak lalu titik; hanya angka yang terbang ke atas              tick
 * 155,4 I  "Lorong mana yang ramai, berapa lama orang antre." lalu peta panas asli                 pop
 * 163,0 J  struk SPBU meluncur ke pemindai Nadi, merah, terpental: "Struk aneh? Nadi belum kenal." glitch
 * 167,6 J  koin menjadi lensa AI, pemasok/tanggal/total menyala satu per satu                       tick
 * 173,6 J  bagian yang menyala membentuk pemindai baru; tiga centang pemeriksa                    click per centang
 * 180,0 J  struk berikutnya langsung terbaca, tiga lagi menyusul; biaya AI Rp0                     pop berturut
 * 188,0 K  laptop, tablet, HP: Hari ini yang sama                                                 whoosh
 * 195,0 L  koin dilempar terakhir, mendarat menjadi logo; kalimat penutup dan alamat               impact lembut
 */
DUR = 204.0;
const SIAP = window.SIAP || (window.SIAP = []);
const muatGambar = (src) => { const i = new Image(); i.src = src; SIAP.push(i.decode().catch(() => {})); return i; };

// =====================================================================================================
// I: kamera (139 - 163)
// =====================================================================================================
const I1 = lapis("#F6F2EA", 8); I1.style.perspective = "1400px";
const denah = el("div", "", I1);
denah.style.cssText = "position:absolute;left:0;top:0;width:1440px;height:810px;border-radius:18px;background:#FFFDF8;box-shadow:0 1px 0 #DDD5C6,0 30px 80px rgba(28,27,24,.12);transform-origin:50% 50%";
denah.innerHTML = `<svg width="1440" height="810" viewBox="0 0 1440 810" style="position:absolute;inset:0">
  <g fill="none" stroke="#1C1B18" stroke-width="3" stroke-linejoin="round">
    <rect x="40" y="40" width="1360" height="730" rx="10"/>
    <rect x="200" y="120" width="120" height="460" fill="#EFE9DD"/><rect x="470" y="120" width="120" height="460" fill="#EFE9DD"/><rect x="740" y="120" width="120" height="460" fill="#EFE9DD"/>
    <rect x="1060" y="140" width="260" height="120" fill="#EFE9DD"/><rect x="1060" y="300" width="260" height="70" fill="#E9A825" stroke="#1C1B18"/>
  </g>
  <g font-family="Jakarta" font-size="26" font-weight="600" fill="#5B574F"><text x="210" y="620">Rak</text><text x="480" y="620">Rak</text><text x="750" y="620">Rak</text><text x="1072" y="215">Gudang</text><text x="1072" y="345" fill="#1C1B18">Kasir</text><text x="90" y="745">Pintu</text></g>
  <path d="M40 690 h130" stroke="#F6F2EA" stroke-width="8"/></svg>`;
const kv = el("canvas", "", I1); kv.width = 1440; kv.height = 810; kv.style.cssText = "position:absolute;left:0;top:0;border-radius:18px;transform-origin:50% 50%";
const kg = kv.getContext("2d");
const kecil = document.createElement("canvas"); kecil.width = 36; kecil.height = 20; const kk = kecil.getContext("2d");
const BINGKAI = Array.from({ length: 285 }, (_, i) => muatGambar(`assets/mata/f${String(i + 1).padStart(3, "0")}.jpg`));
const judulI = kalimat(I1, "CCTV yang sudah ada jadi penghitung pengunjung.", 42, "#1C1B18", 650);
const judulI2 = kalimat(I1, "Wajah tidak disimpan. Yang dikirim hanya angkanya.", 42, "#1C1B18", 650);
const angkaI = ["Masuk", "Keluar"].map((l) => { const e = el("div", "titik nowrap", I1, `<span style="font-size:22px;color:#5B574F;font-weight:600">${l}</span><b style="display:block;font-size:56px;font-weight:800;color:#1C1B18;margin-top:4px">0</b>`); e.style.cssText += ";background:#FFFDF8;border-radius:16px;padding:16px 26px;box-shadow:0 1px 0 #DDD5C6,0 16px 40px rgba(28,27,24,.1)"; return e; });
const KX = 960, KY = 600; // pusat bidang kamera di layar
function lukisMata(tv) {
  const per = MATA.per, f = Math.min(per.length - 1.001, Math.max(0, tv) * MATA.fps), i = Math.floor(f), a = f - i, A = per[i], B = per[i + 1];
  const jejak = A.jejak.map((j) => { const k = B.jejak.find((q) => q.nomor === j.nomor); if (!k) return j; const x = j.x + (k.x - j.x) * a, y = j.y + (k.y - j.y) * a; return { ...j, x, y, garis: [...j.garis, [x, y]] }; });
  gambarMata(kg, 1440, 810, { jejak, zona: MATA.zona, pintu: A.pintu, teks: { hud: "Mata · di perangkat ini", masuk: "Masuk", keluar: "Keluar" }, warna: { aksen: "#E9A825", terang: "white", gelap: "black", hidup: "#4FB07F" } });
  return { jejak, pintu: A.pintu };
}
babak(139.0, 155.4, I1, (t) => {
  const o = Math.min(seg(t, 139.0, 139.3), 1 - seg(t, 155.0, 155.4)); I1.style.opacity = o;
  // denah dari atas -> kamera menunduk (miring), denah larut menjadi rekaman CCTV asli
  const miring = Math.sin(Math.PI * seg(t, 139.8, 141.8)) * 32, sk = lerp(0.86, 1.0, ease(seg(t, 139.0, 141.8)));
  const tf = `translate(${KX - 720}px,${KY - 405}px) rotateX(${miring}deg) scale(${sk})`;
  denah.style.transform = tf; kv.style.transform = tf;
  denah.style.opacity = 1 - seg(t, 140.9, 141.5);
  const tv = t - 141.4; // waktu rekaman
  kg.clearRect(0, 0, 1440, 810);
  if (t >= 140.9) {
    const idx = Math.min(284, Math.max(0, Math.floor(tv * 30))), img = BINGKAI[idx];
    const pix = seg(t, 150.6, 152.0); // privasi: gambar menjadi kotak-kotak lalu hilang
    kg.globalAlpha = seg(t, 140.9, 141.5);
    if (pix > 0) { kk.drawImage(img, 0, 0, 36, 20); kg.imageSmoothingEnabled = false; kg.globalAlpha *= 1 - seg(t, 151.4, 152.4); kg.drawImage(kecil, 0, 0, 1440, 810); kg.imageSmoothingEnabled = true; }
    else kg.drawImage(img, 0, 0, 1440, 810);
    kg.globalAlpha = 1;
    if (t < 151.4) { kg.globalAlpha = seg(t, 141.6, 142.0) * (1 - seg(t, 150.8, 151.4)); lukisMata(Math.min(tv, 9.4)); kg.globalAlpha = 1; }
    // titik orang tersisa sebentar, lalu angka saja yang terbang ke atas
    if (t >= 151.4 && t < 153.4) {
      const { jejak } = lukisMataData(Math.min(tv, 9.4));
      kg.fillStyle = "#E9A825"; jejak.forEach((j) => { kg.globalAlpha = 1 - seg(t, 152.4, 153.2); kg.beginPath(); kg.arc(j.x * 1440, j.y * 810, 16, 0, Math.PI * 2); kg.fill(); }); kg.globalAlpha = 1;
    }
  }
  munculKata(judulI, t, 142.0, 0.05); pos(judulI.e, 960, 110, 1, 0, 1 - seg(t, 150.4, 150.8));
  munculKata(judulI2, t, 151.0, 0.05); pos(judulI2.e, 960, 110);
  const pintu = MATA.per[MATA.per.length - 1].pintu;
  const nilai = [pintu.masuk, pintu.keluar]; // hitungan pelacak Nadi pada rekaman ini, tanpa angka karangan
  angkaI.forEach((e, i) => {
    const p = keluar(seg(t, 152.2 + i * 0.12, 152.9 + i * 0.12));
    pos(e, 800 + i * 320, lerp(620, 470, p), 1, 0, p);
    e.querySelector("b").textContent = String(nilai[i]);
  });
});
// data jejak tanpa menggambar (untuk titik)
function lukisMataData(tv) { const per = MATA.per, f = Math.min(per.length - 1.001, tv * MATA.fps), i = Math.floor(f); return { jejak: per[i].jejak }; }
KOIN_TAMBAH.push((t) => {
  if (t < 139.0 || t >= 141.0) return;
  const u = seg(t, 139.0, 140.8), x = lerp(-120, 1240, keluar(u)), r = 70;
  koin.style.opacity = 1 - seg(t, 140.5, 140.9);
  koin.style.transform = `translate(${x - 260}px,${KY + 300 - 260 - Math.sin(u * Math.PI * 3) * 14 * (1 - u)}px) scale(${r / 260}) rotateZ(${(x + 120) / r * 57.3}deg)`;
});
adeganKalimat(155.4, 157.8, ["Lorong mana yang ramai,", "berapa lama orang antre."], [[0, 1, 2]]);
const I4 = lapisUI(157.8, 163.0);
const fPeta = pasang("peta-panas", I4.cam); fPeta.style.visibility = "inherit";
const UPP = UKUR["peta-panas"];
const sorotJumlah = stabilo(fPeta, UPP.jumlah, 4), sorotTunggu = stabilo(fPeta, UPP.tunggu, 4);
babak(157.8, 163.0, I4.L, (t) => {
  I4.larut(t);
  const a = ease(seg(t, 158.0, 160.0));
  bidik(fPeta, 364, lerp(260, 420, a), lerp(1.9, 1.5, a));
  sorotJumlah(seg(t, 158.6, 159.0)); sorotTunggu(seg(t, 160.6, 161.0));
});

// =====================================================================================================
// J: belajar sendiri (163 - 188)
// =====================================================================================================
const J = lapis("#F6F2EA", 8), camJ = el("div", "dunia", J);
const PX = 640, PY = 600; // pusat pemindai
const pemindai = el("div", "titik", camJ); pemindai.style.cssText += ";width:620px;height:620px";
pemindai.innerHTML = ["0 0", "100% 0", "0 100%", "100% 100%"].map((p, i) => `<span style="position:absolute;width:90px;height:90px;border:10px solid currentColor;${i % 2 ? "right:0;border-left:0" : "left:0;border-right:0"};${i < 2 ? "top:0;border-bottom:0" : "bottom:0;border-top:0"};border-radius:${["16px 0 0 0", "0 16px 0 0", "0 0 0 16px", "0 0 16px 0"][i]}"></span>`).join("");
const garisPindai = el("div", "", pemindai); garisPindai.style.cssText = "position:absolute;left:30px;right:30px;height:8px;border-radius:4px;background:#E9A825;box-shadow:0 0 0 6px rgba(233,168,37,.25)";
const labelP = el("div", "titik nowrap", camJ); labelP.style.cssText += ";font-size:30px;font-weight:700;padding:12px 24px;border-radius:12px";
const STRUK = ["s01", "s09", "s17", "s25"].map((n) => { const e = el("img", "titik", camJ); e.src = `assets/struk/${n}.jpg`; e.style.cssText += ";width:448px;height:442px;border-radius:6px;box-shadow:0 2px 0 rgba(0,0,0,.08),0 24px 50px rgba(28,27,24,.25)"; SIAP.push(e.decode().catch(() => {})); return e; });
// bagian struk (koordinat gambar 448x442): pemasok, tanggal, total
const BAGIAN = [["Pemasok", "SPBU 34.520.88", 30, 38, 200, 28], ["Tanggal", "04/10/2026", 30, 131, 316, 30], ["Total", "Rp64.800", 30, 287, 316, 30]];
const kotakB = BAGIAN.map(() => { const e = el("div", "titik", camJ); e.style.cssText += ";border:5px solid #E9A825;border-radius:8px;background:rgba(233,168,37,.18)"; return e; });
const lensa = el("div", "titik", camJ); lensa.style.cssText += ";width:220px;height:220px;border-radius:50%;border:12px solid #E9A825;background:rgba(255,253,248,.25);box-shadow:0 0 0 10px rgba(233,168,37,.2),0 20px 50px rgba(28,27,24,.25)";
const slotB = BAGIAN.map(([nama]) => { const e = el("div", "titik nowrap", camJ, `<span style="font-size:20px;color:#5B574F;font-weight:600">${nama}</span><b style="display:block;font-size:30px;font-weight:800;margin-top:2px"></b>`); e.style.cssText += ";width:400px;background:#FFFDF8;border-radius:14px;padding:14px 22px;border:3px dashed #DDD5C6"; return e; });
const CEK = ["Hanya membaca, tidak menjalankan apa pun", "Diuji pada struk ini", "Harus cocok 2 kali sebelum dipakai"];
const cekJ = CEK.map((c) => { const e = el("div", "titik nowrap", camJ, `<span class="b" style="width:40px;height:40px;border-radius:50%;border:4px solid #DDD5C6;display:inline-flex;align-items:center;justify-content:center;margin-right:18px;vertical-align:middle"></span>${c}`); e.style.cssText += ";font-size:30px;font-weight:600"; return e; });
const biaya = el("div", "titik nowrap", camJ, `Biaya AI untuk struk ini: <b>Rp0</b>`); biaya.style.cssText += ";font-size:32px;font-weight:600;background:#1C1B18;color:#F6F2EA;padding:18px 30px;border-radius:16px";
const kalJ = [["Struk aneh? Nadi belum kenal.", 163.0, 167.4], ["Nadi mempelajarinya, sekali saja.", 167.6, 173.4], ["Pemindai baru diperiksa dulu sebelum dipakai.", 173.6, 179.8], ["Struk yang sama berikutnya langsung terbaca, tanpa biaya AI.", 180.0, 188.0]].map(([s, a, b]) => ({ k: kalimat(camJ, s, 42, "#1C1B18", 650), a, b }));
const getar = (t, t0) => (t > t0 && t < t0 + 0.4 ? Math.sin((t - t0) * 70) * 14 * (1 - (t - t0) / 0.4) : 0);
babak(163.0, 188.4, J, (t) => {
  const o = Math.min(seg(t, 163.0, 163.35), 1 - seg(t, 188.0, 188.4)); J.style.opacity = o; camJ.style.filter = o < 1 ? `blur(${(1 - o) * 12}px)` : "none";
  kalJ.forEach(({ k, a, b }) => { munculKata(k, t, a + 0.1, 0.05); pos(k.e, 960, 120, 1, 0, t < a ? 0 : 1 - seg(t, b - 0.3, b)); });
  // status pemindai: biasa, ditolak (merah), dipelajari (kunyit), aktif (hijau)
  const tolak = t >= 164.6 && t < 167.6, belajar = t >= 167.6 && t < 180.0, aktif = t >= 180.0;
  pemindai.style.color = tolak ? "#B4372A" : aktif ? "#23704A" : "#1C1B18";
  pos(pemindai, PX + getar(t, 164.6), PY, 1, 0, 1);
  labelP.textContent = tolak ? "Format ini belum dikenal" : belajar && t >= 175.0 ? "Pemindai baru: struk SPBU" : aktif ? "Terbaca: struk SPBU" : "Pemindai Nadi";
  labelP.style.background = tolak ? "#B4372A" : aktif ? "#23704A" : "#1C1B18"; labelP.style.color = "#F6F2EA";
  pos(labelP, PX, PY + 370, 1, 0, 1);
  // garis pindai: lewat saat struk pertama, lalu tiap struk berikutnya
  const lewat = [[163.9, 164.6], [180.6, 181.0], [183.2, 183.5], [184.6, 184.9], [186.0, 186.3]].find(([a, b]) => t >= a && t < b);
  garisPindai.style.opacity = lewat ? 1 : 0; if (lewat) garisPindai.style.top = `${30 + seg(t, lewat[0], lewat[1]) * 552}px`;
  // struk 1: meluncur masuk, ditolak dan terpental, lalu kembali untuk dicerna
  const s1 = STRUK[0];
  let x1 = lerp(-400, PX, keluar(seg(t, 163.2, 163.9)));
  x1 = lerp(x1, PX - 520, keluar(seg(t, 164.7, 165.3)));
  x1 = lerp(x1, PX, ease(seg(t, 167.4, 168.0)));
  x1 = lerp(x1, -500, ease(seg(t, 179.8, 180.4)));
  pos(s1, x1 + getar(t, 164.6), PY, 1, lerp(-9, -3, seg(t, 163.2, 163.9)) * (1 - seg(t, 167.4, 168.0)), 1);
  // koin menjadi lensa, mencerna tiap bagian
  const lensaU = seg(t, 168.0, 172.6), bi = Math.min(2, Math.floor(lensaU * 3));
  const [nm, , bx, by, bw, bh] = BAGIAN[bi];
  pos(lensa, PX - 224 + bx + bw / 2, PY - 221 + by + bh / 2, 1, 0, t >= 168.0 && t < 173.2 ? Math.min(seg(t, 168.0, 168.3), 1 - seg(t, 172.8, 173.2)) : 0);
  // bagian yang menyala, lalu terbang membentuk pemindai baru (slot)
  BAGIAN.forEach(([nama, nilai, x, y, w, h], i) => {
    const nyala = seg(t, 168.4 + i * 1.4, 168.8 + i * 1.4), terbang = ease(seg(t, 173.8 + i * 0.25, 174.8 + i * 0.25));
    const sx = PX - 224 + x + w / 2, sy = PY - 221 + y + h / 2, tx = 1430, ty = 360 + i * 120;
    const e = kotakB[i]; e.style.width = w + 12 + "px"; e.style.height = h + 10 + "px";
    pos(e, lerp(sx, tx, terbang), lerp(sy, ty, terbang), 1, 0, nyala * (1 - terbang));
    const slot = slotB[i]; const ps = keluar(seg(t, 174.6 + i * 0.25, 175.0 + i * 0.25));
    // isian mengikuti struk yang sedang dibaca (teks OCR asli korpus struk-foto 09, 17, 25)
    const ke = t >= 184.2 ? 2 : t >= 182.8 ? 1 : 0;
    slot.querySelector("b").textContent = aktif ? [["SPBU 34.790.44", "26-09-2026", "Rp174.300"], ["SPBU 34.452.97", "09-07-2026", "Rp177.500"], ["SPBU 34.549.21", "27-07-2026", "Rp275.100"]][ke][i] : nilai;
    slot.style.borderStyle = t > 175.6 ? "solid" : "dashed"; slot.style.borderColor = aktif ? "#23704A" : t > 175.6 ? "#E9A825" : "#DDD5C6";
    pos(slot, 1430, 360 + i * 120, 1, 0, ps * (1 - seg(t, 187.6, 188.0)));
  });
  // pemeriksa: tiga centang
  cekJ.forEach((e, i) => {
    const p = keluar(seg(t, 176.2 + i * 0.8, 176.6 + i * 0.8)), b = e.querySelector(".b"), centang = t >= 176.5 + i * 0.8;
    b.style.background = centang ? "#23704A" : "transparent"; b.style.borderColor = centang ? "#23704A" : "#DDD5C6";
    b.innerHTML = centang ? `<svg width="24" height="24" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>` : "";
    pos(e, 1430, 760 + i * 64, 1, 0, p * (1 - seg(t, 179.6, 180.0)));
  });
  // struk berikutnya: langsung terbaca, hijau, biaya Rp0
  [1, 2, 3].forEach((k, i) => {
    const t0 = [180.2, 182.8, 184.2][i], s = STRUK[k];
    const x = lerp(lerp(-400, PX, keluar(seg(t, t0, t0 + 0.4))), 2300, masuk(seg(t, t0 + 1.0, t0 + 1.4)));
    pos(s, x, PY, 1, -4 + i * 3, t >= t0 ? 1 : 0);
  });
  const pb = keluar(seg(t, 181.2, 181.6));
  pos(biaya, 1430, 790, 1, 0, pb * (1 - seg(t, 187.6, 188.0)));
});
KOIN_TAMBAH.push((t) => {
  // koin datang dari kanan atas, lalu berubah menjadi lensa (lensa mengambil alih di 168,0)
  if (t < 166.4 || t >= 168.2) return;
  const u = seg(t, 166.4, 168.0);
  koin.style.opacity = 1 - seg(t, 167.9, 168.2);
  koin.style.transform = `translate(${lerp(1800, PX - 224 + 130, ease(u)) - 260}px,${lerp(-100, PY - 221 + 52, ease(u)) - 260 - Math.sin(u * Math.PI) * 120}px) scale(${110 / 260}) rotateY(${u * 720}deg)`;
});

// =====================================================================================================
// K: di laptop dan HP (188 - 195), L: penutup (195 - 204)
// =====================================================================================================
const K = lapis("#F6F2EA", 8), camK = el("div", "dunia", K);
const ALAT = [["hari-1440", 1440, 900, 0.62, 520, 560, 26], ["hari-768", 768, 1024, 0.5, 1240, 600, 22], ["hari-390", 390, 844, 0.66, 1640, 600, 34]];
const alatK = ALAT.map(([nama, w, h, s, x, y, r]) => {
  const bingkai = el("div", "titik", camK); bingkai.style.cssText += `;width:${w * s + 28}px;height:${h * s + 28}px;border-radius:${r}px;background:#1C1B18;padding:14px;box-shadow:0 30px 80px rgba(28,27,24,.18)`;
  const layar = el("div", "", bingkai); layar.style.cssText = `width:${w * s}px;height:${h * s}px;overflow:hidden;border-radius:${r - 10}px;background:#F6F2EA;position:relative`;
  // Tiap perangkat = iframe selebar layar perangkat itu, supaya CSS aplikasi membaca lebar 768/390 dan tata letaknya benar-benar
  // tablet/HP (potongan di div biasa ikut lebar panggung 1920 sehingga tampil desktop; teguran Tristan 6 Nov 2026).
  const fr = el("iframe", "", layar); fr.setAttribute("width", w); fr.setAttribute("height", h); fr.setAttribute("scrolling", "no");
  fr.style.cssText = `border:0;width:${w}px;height:${h}px;transform:scale(${s});transform-origin:0 0;display:block`;
  const isi = document.getElementById("f-" + nama).content.firstElementChild.outerHTML;
  SIAP.push(new Promise((ok) => { fr.addEventListener("load", ok, { once: true }); setTimeout(ok, 8000); }));
  fr.srcdoc = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=${w}">${document.getElementById("css-app").outerHTML}</head><body style="margin:0;background:#F6F2EA;overflow:hidden">${isi}</body></html>`;
  return { bingkai, x, y };
});
const kalK = kalimat(camK, "Di laptop dan HP, tempatnya sama.", 46, "#1C1B18", 650);
babak(188.0, 195.4, K, (t) => {
  const o = Math.min(seg(t, 188.0, 188.35), 1 - seg(t, 195.0, 195.4)); K.style.opacity = o;
  const z = lerp(1.12, 1, ease(seg(t, 188.0, 191.5)));
  camK.style.transform = `translate(960px,560px) scale(${z}) translate(-960px,-560px)`;
  alatK.forEach((a, i) => { const p = keluar(seg(t, 188.3 + i * 0.5, 189.0 + i * 0.5)); pos(a.bingkai, a.x, a.y + (1 - p) * 80, 1, 0, p); });
  munculKata(kalK, t, 190.4); pos(kalK.e, 960, 120);
});
const L = lapis("#F6F2EA", 9), camL = el("div", "dunia", L);
const tutupL = kalimat(camL, "Lempar berkasnya. Nadi yang merapikan.", 54, "#1C1B18", 700);
const alamatL = kalimat(camL, "nadi-swart.vercel.app", 32, "#5B574F", 600);
babak(195.0, 204.0, L, (t) => {
  L.style.opacity = seg(t, 195.0, 195.4);
  munculKata(tutupL, t, 198.6); pos(tutupL.e, 960, 720);
  munculKata(alamatL, t, 199.6); pos(alamatL.e, 960, 800);
});
KOIN_TAMBAH.push((t) => {
  if (t < 195.2) return;
  // lemparan terakhir: naik, berputar, mendarat di tengah dan menetap sebagai logo
  const u = seg(t, 195.2, 197.6), y = 540 - Math.sin(Math.PI * u) * 420 + (1 - u) * 300 * 0 - 120 * keluar(seg(t, 197.6, 198.4));
  koin.style.opacity = seg(t, 195.2, 195.4);
  const putar = keluar(u) * 360 * 5;
  koin.style.transform = `translate(${960 - 260}px,${y - 260}px) scale(${lerp(0.5, 0.62, keluar(seg(t, 197.6, 198.4)))}) rotateX(${putar}deg)`;
  KOIN.style.zIndex = 30;
});
