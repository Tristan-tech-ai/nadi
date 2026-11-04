//! Inti agen Mata tanpa jaringan: masker zona dari poligon ternormalisasi, beda terhadap latar kosong, jumlah gumpalan untuk
//! antrean, dan histeresis agar satu cuplikan berisik (orang lewat) tidak langsung mengubah keadaan. Cara ini lebih sederhana
//! dari pendeteksi orang di peramban (F5-01): cocok untuk kamera tetap dengan latar yang tidak berubah; diukur dengan
//! `nadi-mata-agen evaluasi` pada korpus fixtures/korpus/mata.

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Zona {
    pub id: String,
    pub nama: String,
    pub jenis: String,
    pub poligon: Vec<[f64; 2]>,
}

/// Titik (x, y) di dalam poligon (aturan ganjil-genap).
pub fn di_dalam(x: f64, y: f64, p: &[[f64; 2]]) -> bool {
    let mut dalam = false;
    let mut j = p.len().wrapping_sub(1);
    for i in 0..p.len() {
        let (xi, yi, xj, yj) = (p[i][0], p[i][1], p[j][0], p[j][1]);
        if (yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi {
            dalam = !dalam;
        }
        j = i;
    }
    dalam
}

/// Masker piksel (lebar x tinggi) untuk poligon ternormalisasi 0..1, diambil di tengah piksel.
pub fn masker(poligon: &[[f64; 2]], lebar: usize, tinggi: usize) -> Vec<bool> {
    let mut m = vec![false; lebar * tinggi];
    for y in 0..tinggi {
        for x in 0..lebar {
            m[y * lebar + x] = di_dalam((x as f64 + 0.5) / lebar as f64, (y as f64 + 0.5) / tinggi as f64, poligon);
        }
    }
    m
}

/// Piksel yang berbeda dari latar lebih dari `ambang` (abu-abu 0..255).
pub fn beda(frame: &[u8], latar: &[u8], ambang: u8) -> Vec<bool> {
    frame.iter().zip(latar).map(|(a, b)| a.abs_diff(*b) > ambang).collect()
}

/// Fraksi piksel berbeda di dalam masker.
pub fn fraksi(berubah: &[bool], m: &[bool]) -> f64 {
    let total = m.iter().filter(|x| **x).count();
    if total == 0 {
        return 0.0;
    }
    berubah.iter().zip(m).filter(|(b, d)| **b && **d).count() as f64 / total as f64
}

/// Jumlah gumpalan piksel berbeda (bertetangga 4 arah) di dalam masker dengan luas paling sedikit `luas_min`.
pub fn gumpalan(berubah: &[bool], m: &[bool], lebar: usize, tinggi: usize, luas_min: usize) -> usize {
    let mut dilihat = vec![false; lebar * tinggi];
    let mut n = 0;
    let mut tumpuk = Vec::new();
    for awal in 0..lebar * tinggi {
        if dilihat[awal] || !berubah[awal] || !m[awal] {
            continue;
        }
        let mut luas = 0;
        tumpuk.push(awal);
        dilihat[awal] = true;
        while let Some(i) = tumpuk.pop() {
            luas += 1;
            let (x, y) = (i % lebar, i / lebar);
            let tetangga = [
                (x > 0).then(|| i - 1),
                (x + 1 < lebar).then(|| i + 1),
                (y > 0).then(|| i - lebar),
                (y + 1 < tinggi).then(|| i + lebar),
            ];
            for t in tetangga.into_iter().flatten() {
                if !dilihat[t] && berubah[t] && m[t] {
                    dilihat[t] = true;
                    tumpuk.push(t);
                }
            }
        }
        if luas >= luas_min {
            n += 1;
        }
    }
    n
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Bacaan {
    Meja(bool),
    Antrean(usize),
}

pub struct Ambang {
    pub piksel: u8,
    pub fraksi_meja: f64,
    pub luas_orang: usize,
}

impl Default for Ambang {
    fn default() -> Self {
        Ambang { piksel: 35, fraksi_meja: 0.12, luas_orang: 40 }
    }
}

pub fn baca_zona(z: &Zona, m: &[bool], berubah: &[bool], lebar: usize, tinggi: usize, a: &Ambang) -> Bacaan {
    if z.jenis == "meja" {
        Bacaan::Meja(fraksi(berubah, m) > a.fraksi_meja)
    } else {
        Bacaan::Antrean(gumpalan(berubah, m, lebar, tinggi, a.luas_orang))
    }
}

/// Histeresis: keadaan baru baru diterima setelah terbaca sama `perlu` kali berturut-turut.
pub struct Pelacak {
    pub perlu: usize,
    pub tetap: Option<Bacaan>,
    calon: Option<Bacaan>,
    hitung: usize,
}

impl Pelacak {
    pub fn baru(perlu: usize) -> Self {
        Pelacak { perlu: perlu.max(1), tetap: None, calon: None, hitung: 0 }
    }

    /// Mengembalikan Some(bacaan) bila keadaan tetap berubah karena bacaan ini.
    pub fn masuk(&mut self, b: Bacaan) -> Option<Bacaan> {
        if Some(b) == self.tetap {
            self.calon = None;
            self.hitung = 0;
            return None;
        }
        if Some(b) == self.calon {
            self.hitung += 1;
        } else {
            self.calon = Some(b);
            self.hitung = 1;
        }
        if self.hitung >= self.perlu {
            self.tetap = Some(b);
            self.calon = None;
            self.hitung = 0;
            return Some(b);
        }
        None
    }
}

/// Butir untuk RPC agen_mata_catat.
pub fn butir(zona: &str, b: Bacaan) -> serde_json::Value {
    match b {
        Bacaan::Meja(terisi) => serde_json::json!({ "zona": zona, "status": if terisi { "terisi" } else { "kosong" } }),
        Bacaan::Antrean(n) => serde_json::json!({ "zona": zona, "jumlah": n }),
    }
}

#[cfg(test)]
mod tes {
    use super::*;

    const KOTAK: [[f64; 2]; 4] = [[0.0, 0.0], [0.5, 0.0], [0.5, 0.5], [0.0, 0.5]];

    #[test]
    fn masker_kotak_seperempat() {
        let m = masker(&KOTAK, 10, 10);
        assert_eq!(m.iter().filter(|x| **x).count(), 25);
        assert!(m[0] && !m[99]);
    }

    #[test]
    fn fraksi_dan_meja() {
        let m = masker(&KOTAK, 10, 10);
        let latar = vec![100u8; 100];
        let mut frame = latar.clone();
        for i in [0usize, 1, 2, 10, 11] {
            frame[i] = 200;
        }
        frame[99] = 0; // di luar zona: tidak dihitung
        let b = beda(&frame, &latar, 35);
        assert!((fraksi(&b, &m) - 0.2).abs() < 1e-9);
        let z = Zona { id: "z".into(), nama: "Meja".into(), jenis: "meja".into(), poligon: KOTAK.to_vec() };
        assert_eq!(baca_zona(&z, &m, &b, 10, 10, &Ambang::default()), Bacaan::Meja(true));
        let sepi = beda(&latar, &latar, 35);
        assert_eq!(baca_zona(&z, &m, &sepi, 10, 10, &Ambang::default()), Bacaan::Meja(false));
    }

    #[test]
    fn gumpalan_dua_orang() {
        let (w, h) = (20, 10);
        let m = vec![true; w * h];
        let mut b = vec![false; w * h];
        for y in 2..6 {
            for x in 2..5 {
                b[y * w + x] = true;
            }
            for x in 12..15 {
                b[y * w + x] = true;
            }
        }
        b[9 * w + 19] = true; // derau satu piksel
        assert_eq!(gumpalan(&b, &m, w, h, 5), 2);
    }

    #[test]
    fn histeresis_abaikan_satu_cuplikan() {
        let mut p = Pelacak::baru(2);
        assert_eq!(p.masuk(Bacaan::Meja(false)), None);
        assert_eq!(p.masuk(Bacaan::Meja(false)), Some(Bacaan::Meja(false)));
        assert_eq!(p.masuk(Bacaan::Meja(true)), None); // orang lewat satu cuplikan
        assert_eq!(p.masuk(Bacaan::Meja(false)), None);
        assert_eq!(p.masuk(Bacaan::Meja(true)), None);
        assert_eq!(p.masuk(Bacaan::Meja(true)), Some(Bacaan::Meja(true)));
    }

    #[test]
    fn butir_rpc() {
        assert_eq!(butir("a", Bacaan::Meja(true))["status"], "terisi");
        assert_eq!(butir("b", Bacaan::Antrean(3))["jumlah"], 3);
    }
}
