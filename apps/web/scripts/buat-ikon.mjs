import { chromium } from "@playwright/test";
const svg = (bg, pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="${bg}"/><g transform="translate(${pad} ${pad}) scale(${(32 - 2 * pad) / 32})"><path d="M6 3h20a1 1 0 0 1 1 1v22.5l-2.5 2-2.5-2-2.5 2-2.5-2-2.5 2-2.5-2-2.5 2L5 26.5V4a1 1 0 0 1 1-1Z" fill="#1C1B18"/><path d="M8 15h4.5l2-4.5 3 9 2-4.5H24" fill="none" stroke="#E9A825" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
const b = await chromium.launch(); const p = await b.newPage();
for (const [nama, ukuran, pad] of [["ikon-192.png",192,3],["ikon-512.png",512,3],["ikon-maskable-512.png",512,7],["apple-touch-icon.png",180,3]]) {
  await p.setViewportSize({ width: ukuran, height: ukuran });
  await p.setContent(`<style>body{margin:0}</style><img src="data:image/svg+xml,${encodeURIComponent(svg("#F6F2EA", pad))}" width="${ukuran}" height="${ukuran}">`);
  await p.screenshot({ path: `public/ikon/${nama}`, omitBackground: false });
}
await b.close(); console.log("ikon dibuat");
