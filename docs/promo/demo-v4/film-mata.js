// V-12 (dirancang ulang 6 Nov 2026): lapisan pelacakan Mata di atas cuplikan kamera, hanya di layar perangkat.
// Pola dari produk penghitung pengunjung berbasis video: kotak sudut tipis per orang dengan label nomor, jejak yang memudar ke
// belakang, zona bergaris tipis berlabel jumlah orang dan menyala saat terisi, hitungan masuk/keluar di panel kepala.
// Satu fungsi dipakai layar Mata (hitung-kunjungan.tsx) dan film demo (docs/promo/demo-v3), supaya yang tampil di film sama dengan
// yang tampil di aplikasi. Tidak ada yang disimpan atau dikirim dari sini.
const HURUF = "Plus Jakarta Sans, system-ui, sans-serif";
/** Jumlah orang per zona dari jejak yang sedang terlihat. */
function isiZona(jejak) {
    const n = {};
    for (const j of jejak)
        if (j.zona)
            n[j.zona] = (n[j.zona] ?? 0) + 1;
    return n;
}
function pil(g, x, y, teks, s, w, ukuran = 12, tebal = 700) {
    g.font = `${tebal} ${ukuran * s}px ${HURUF}`;
    const lebar = g.measureText(teks).width + 12 * s;
    const tinggi = (ukuran + 8) * s;
    g.globalAlpha = 0.78;
    g.fillStyle = w.gelap;
    g.beginPath();
    g.roundRect(x, y, lebar, tinggi, 6 * s);
    g.fill();
    g.globalAlpha = 1;
    g.fillStyle = w.terang;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(teks, x + 6 * s, y + tinggi / 2 + 0.5);
    return lebar;
}
/** Gambar zona, jejak, dan panel kepala pada bidang lebar x tinggi (koordinat jejak dan zona 0..1). */
function gambarMata(g, lebar, tinggi, d) {
    const s = lebar / 640;
    const w = d.warna;
    const isi = isiZona(d.jejak);
    g.save();
    g.lineJoin = "round";
    g.lineCap = "round";
    // Zona: garis putus tipis; menyala (garis kunyit utuh + isian tipis) bila ada orang; label dengan jumlah orang.
    for (const z of d.zona) {
        const ada = (isi[z.id] ?? 0) > 0;
        g.beginPath();
        z.poligon.forEach(([x, y], i) => (i ? g.lineTo(x * lebar, y * tinggi) : g.moveTo(x * lebar, y * tinggi)));
        g.closePath();
        if (ada) {
            g.globalAlpha = 0.14;
            g.fillStyle = w.aksen;
            g.fill();
            g.globalAlpha = 1;
        }
        g.setLineDash(ada ? [] : [6 * s, 5 * s]);
        g.lineWidth = (ada ? 2 : 1.2) * s;
        g.strokeStyle = ada ? w.aksen : w.terang;
        g.globalAlpha = ada ? 1 : 0.55;
        g.stroke();
        g.globalAlpha = 1;
        g.setLineDash([]);
        const [x0, y0] = z.poligon.reduce(([a, b], [x, y]) => [Math.min(a, x), Math.min(b, y)], [1, 1]);
        pil(g, x0 * lebar + 6 * s, y0 * tinggi + 6 * s, ada ? `${z.nama} · ${isi[z.id]}` : z.nama, s, w, 10, 600);
    }
    // Jejak: garis 3 detik terakhir memudar ke belakang, kotak sudut di posisi orang, label nomor anonim.
    for (const j of d.jejak) {
        const p = j.garis;
        for (let i = 1; i < p.length; i++) {
            g.globalAlpha = 0.15 + 0.85 * (i / p.length);
            g.beginPath();
            g.moveTo(p[i - 1][0] * lebar, p[i - 1][1] * tinggi);
            g.lineTo(p[i][0] * lebar, p[i][1] * tinggi);
            g.lineWidth = 2.5 * s;
            g.strokeStyle = w.aksen;
            g.stroke();
        }
        g.globalAlpha = 1;
        const cx = j.x * lebar, cy = j.y * tinggi, r = 13 * s, k = 6 * s;
        g.lineWidth = 2 * s;
        g.strokeStyle = w.terang;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            g.beginPath();
            g.moveTo(cx + sx * r, cy + sy * (r - k));
            g.lineTo(cx + sx * r, cy + sy * r);
            g.lineTo(cx + sx * (r - k), cy + sy * r);
            g.stroke();
        }
        g.beginPath();
        g.arc(cx, cy, 2.5 * s, 0, Math.PI * 2);
        g.fillStyle = w.aksen;
        g.fill();
        pil(g, cx + r + 3 * s, cy - r - 4 * s, `#${j.nomor}`, s, w, 11);
    }
    // Panel kepala: penanda hidup + "di perangkat", lalu hitungan pintu di kanan.
    const h = 30 * s;
    g.globalAlpha = 0.78;
    g.fillStyle = w.gelap;
    g.fillRect(0, 0, lebar, h);
    g.globalAlpha = 1;
    g.beginPath();
    g.arc(14 * s, h / 2, 4 * s, 0, Math.PI * 2);
    g.fillStyle = w.hidup;
    g.fill();
    g.font = `600 ${12 * s}px ${HURUF}`;
    g.fillStyle = w.terang;
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillText(d.teks.hud, 26 * s, h / 2 + 0.5);
    const hitung = `${d.teks.masuk} ${d.pintu.masuk}    ${d.teks.keluar} ${d.pintu.keluar}`;
    g.font = `700 ${13 * s}px ${HURUF}`;
    g.textAlign = "right";
    g.fillText(hitung, lebar - 12 * s, h / 2 + 0.5);
    g.restore();
}
