// =====================================================================================================
// seek, pratinjau, render
// =====================================================================================================
window.VIDEO.duration = DUR;
const seekSiap = (t) => {
  t = Math.max(0, Math.min(DUR - 1e-6, t));
  for (const b of BABAK) { const on = t >= b.t0 && t < b.t1; b.e.style.visibility = on ? "visible" : "hidden"; if (on) b.fn(t); }
};
// seek baru tersedia setelah semua gambar (bingkai CCTV, struk) siap, supaya render tidak memotret gambar kosong.
Promise.all(window.SIAP || []).then(() => { window.seek = seekSiap; seekSiap(0); });
if (RENDER) document.body.classList.add("render");
else {
  const skala = () => { const s = Math.min(innerWidth / W, (innerHeight - 50) / H); P.style.transform = `scale(${s})`; };
  addEventListener("resize", skala); skala();
  const geser = document.getElementById("geser"), waktu = document.getElementById("waktu");
  let main = false, mulai = 0, awal = 0;
  document.getElementById("putar").onclick = () => { main = !main; mulai = performance.now(); awal = +geser.value / 1000 * DUR; };
  geser.oninput = () => { main = false; };
  (function loop() { const t = main ? (awal + (performance.now() - mulai) / 1000) % DUR : +geser.value / 1000 * DUR; if (main) geser.value = t / DUR * 1000; waktu.textContent = t.toFixed(2); if (window.seek) window.seek(t); requestAnimationFrame(loop); })();
}

