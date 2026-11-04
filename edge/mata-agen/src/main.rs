//! nadi-mata-agen: agen edge Mata untuk kotak lokal (Windows/Linux). Panduan pasang: docs/edge/PASANG.md.
//!   nadi-mata-agen jalan       baca RTSP, nilai zona dari Nadi, kirim perubahan ke RPC agen_mata_catat
//!   nadi-mata-agen kalibrasi   simpan satu cuplikan kamera saat ruangan kosong sebagai latar
//!   nadi-mata-agen evaluasi <video> <latar> <zona.json> <jawaban.json>   ukur akurasi pada korpus
//! Konfigurasi lewat env: NADI_SUPABASE_URL, NADI_KUNCI_PUBLIK (kunci publishable, bukan rahasia), NADI_TOKEN_AGEN (nma_...),
//! NADI_RTSP, NADI_LATAR (berkas gambar latar), NADI_FFMPEG (opsional, bawaan "ffmpeg"), NADI_DETIK (jeda cuplikan, bawaan 2).
use nadi_mata_agen::{baca_zona, beda, butir, masker, Ambang, Bacaan, Pelacak, Zona};
use std::collections::HashMap;
use std::io::Read;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

const LEBAR: usize = 160;
const TINGGI: usize = 120;

fn env(k: &str) -> Result<String, String> {
    std::env::var(k).map_err(|_| format!("env {k} belum diisi (lihat docs/edge/PASANG.md)"))
}

fn ffmpeg() -> String {
    std::env::var("NADI_FFMPEG").unwrap_or_else(|_| "ffmpeg".into())
}

/// Satu gambar (berkas apa pun yang dibaca ffmpeg) menjadi abu-abu LEBAR x TINGGI.
fn baca_gambar(jalur: &str) -> Result<Vec<u8>, String> {
    let out = Command::new(ffmpeg())
        .args(["-loglevel", "error", "-i", jalur, "-frames:v", "1", "-vf", &format!("scale={LEBAR}:{TINGGI},format=gray"), "-f", "rawvideo", "-"])
        .output()
        .map_err(|e| format!("ffmpeg tidak bisa dijalankan: {e}"))?;
    if out.stdout.len() != LEBAR * TINGGI {
        return Err(format!("latar {jalur} tidak terbaca: {}", String::from_utf8_lossy(&out.stderr)));
    }
    Ok(out.stdout)
}

/// Cuplikan abu-abu dari sumber (RTSP atau berkas video), satu setiap `detik`.
fn aliran(sumber: &str, detik: f64) -> Result<std::process::Child, String> {
    let mut a: Vec<String> = vec!["-loglevel".into(), "error".into()];
    if sumber.starts_with("rtsp://") {
        a.extend(["-rtsp_transport".into(), "tcp".into()]);
    }
    a.extend(["-i".into(), sumber.into(), "-vf".into(), format!("fps=1/{detik},scale={LEBAR}:{TINGGI},format=gray"), "-f".into(), "rawvideo".into(), "-".into()]);
    Command::new(ffmpeg()).args(&a).stdout(Stdio::piped()).stderr(Stdio::inherit()).spawn().map_err(|e| format!("ffmpeg tidak bisa dijalankan: {e}"))
}

fn rpc(url: &str, kunci: &str, nama: &str, isi: serde_json::Value) -> Result<serde_json::Value, String> {
    let alamat = format!("{}/rest/v1/rpc/{nama}", url.trim_end_matches('/'));
    match ureq::post(&alamat).header("apikey", kunci).header("Authorization", &format!("Bearer {kunci}")).send_json(&isi) {
        Ok(mut r) => r.body_mut().read_json::<serde_json::Value>().map_err(|e| format!("jawaban {nama} tidak terbaca: {e}")),
        Err(ureq::Error::StatusCode(k)) => Err(format!("{nama} ditolak Nadi (HTTP {k}); periksa token agen dan zona")),
        Err(e) => Err(format!("{nama} gagal tersambung: {e}")),
    }
}

fn siapkan(zona: &[Zona]) -> Vec<(Zona, Vec<bool>, Pelacak)> {
    zona.iter().map(|z| (z.clone(), masker(&z.poligon, LEBAR, TINGGI), Pelacak::baru(2))).collect()
}

fn jalan() -> Result<(), String> {
    let (url, kunci, token, sumber) = (env("NADI_SUPABASE_URL")?, env("NADI_KUNCI_PUBLIK")?, env("NADI_TOKEN_AGEN")?, env("NADI_RTSP")?);
    let latar = baca_gambar(&env("NADI_LATAR")?)?;
    let detik: f64 = std::env::var("NADI_DETIK").ok().and_then(|x| x.parse().ok()).unwrap_or(2.0);
    let ambang = Ambang::default();
    loop {
        let zona: Vec<Zona> = serde_json::from_value(rpc(&url, &kunci, "agen_mata_zona", serde_json::json!({ "p_token": token }))?)
            .map_err(|e| format!("zona tidak terbaca: {e}"))?;
        if zona.is_empty() {
            return Err("Belum ada zona aktif. Gambar zona dulu di Nadi (halaman Mata).".into());
        }
        eprintln!("{} zona dimuat; membaca {sumber}", zona.len());
        let mut z = siapkan(&zona);
        let mut anak = aliran(&sumber, detik)?;
        let mut keluar = anak.stdout.take().ok_or("ffmpeg tanpa stdout")?;
        let mut buf = vec![0u8; LEBAR * TINGGI];
        let mulai = Instant::now();
        while keluar.read_exact(&mut buf).is_ok() {
            let berubah = beda(&buf, &latar, ambang.piksel);
            let kirim: Vec<serde_json::Value> = z
                .iter_mut()
                .filter_map(|(zz, m, p)| p.masuk(baca_zona(zz, m, &berubah, LEBAR, TINGGI, &ambang)).map(|b| butir(&zz.id, b)))
                .collect();
            if !kirim.is_empty() {
                match rpc(&url, &kunci, "agen_mata_catat", serde_json::json!({ "p_token": token, "p_butir": kirim })) {
                    Ok(n) => eprintln!("{} perubahan dikirim, {n} kejadian baru", kirim.len()),
                    Err(e) => eprintln!("{e}"),
                }
            }
            // Zona dimuat ulang tiap 10 menit agar perubahan di Nadi ikut terpakai.
            if mulai.elapsed() > Duration::from_secs(600) {
                break;
            }
        }
        let _ = anak.kill();
        let _ = anak.wait();
        eprintln!("aliran berhenti; sambung ulang 5 detik lagi");
        std::thread::sleep(Duration::from_secs(5));
    }
}

fn kalibrasi() -> Result<(), String> {
    let (sumber, latar) = (env("NADI_RTSP")?, env("NADI_LATAR")?);
    let st = Command::new(ffmpeg()).args(["-loglevel", "error", "-y", "-rtsp_transport", "tcp", "-i", &sumber, "-frames:v", "1", &latar]).status().map_err(|e| e.to_string())?;
    if !st.success() {
        return Err("cuplikan latar gagal diambil; periksa alamat RTSP".into());
    }
    eprintln!("latar disimpan ke {latar}; ambil saat ruangan kosong");
    Ok(())
}

#[derive(serde::Deserialize)]
struct Jawaban {
    status: HashMap<String, String>,
}

fn evaluasi(a: &[String]) -> Result<(), String> {
    let [video, latar, zona, jawaban] = a else { return Err("pakai: evaluasi <video> <latar> <zona.json> <jawaban.json>".into()) };
    let latar = baca_gambar(latar)?;
    let zona: Vec<Zona> = serde_json::from_str(&std::fs::read_to_string(zona).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let jawaban: Vec<Jawaban> = serde_json::from_str(&std::fs::read_to_string(jawaban).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let ambang = Ambang::default();
    let mut z = siapkan(&zona);
    let mut anak = aliran(video, 2.0)?;
    let mut keluar = anak.stdout.take().ok_or("ffmpeg tanpa stdout")?;
    let mut buf = vec![0u8; LEBAR * TINGGI];
    let (mut benar, mut total, mut i) = (0, 0, 0);
    while i < jawaban.len() && keluar.read_exact(&mut buf).is_ok() {
        let berubah = beda(&buf, &latar, ambang.piksel);
        for (zz, m, p) in z.iter_mut() {
            p.masuk(baca_zona(zz, m, &berubah, LEBAR, TINGGI, &ambang));
            if let (Some(Bacaan::Meja(t)), Some(harap)) = (p.tetap, jawaban[i].status.get(&zz.id)) {
                total += 1;
                benar += usize::from((harap == "terisi") == t);
            }
        }
        i += 1;
    }
    let _ = anak.kill();
    let persen = if total > 0 { 100.0 * benar as f64 / total as f64 } else { 0.0 };
    println!("AKURASI {benar}/{total} = {persen:.1}% ({i} cuplikan)");
    if persen >= 85.0 { Ok(()) } else { Err("akurasi di bawah 85%".into()) }
}

fn main() {
    let a: Vec<String> = std::env::args().skip(1).collect();
    let hasil = match a.first().map(String::as_str) {
        Some("jalan") => jalan(),
        Some("kalibrasi") => kalibrasi(),
        Some("evaluasi") => evaluasi(&a[1..]),
        _ => Err("pakai: nadi-mata-agen jalan | kalibrasi | evaluasi <video> <latar> <zona.json> <jawaban.json>".into()),
    };
    if let Err(e) = hasil {
        eprintln!("{e}");
        std::process::exit(1);
    }
}
