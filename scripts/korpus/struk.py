"""Korpus struk sintetis M-18 (data karangan, nama usaha generik): teks struk kertas hasil OCR dan e-struk aplikasi/email
dengan total, tanggal, dan kelompok yang diketahui. Jalankan: python -I scripts/korpus/struk.py (menulis fixtures/korpus/struk).
"""
import json
import os
import random

AKAR = os.path.join(os.path.dirname(__file__), "..", "..", "fixtures", "korpus", "struk")
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
SINGKAT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def rp_titik(n):
    return f"{n:,}".replace(",", ".")


def rp_koma(n):
    return f"{n:,}"


def tgl(acak, gaya):
    th, bl, hr = 2026, acak.randint(1, 11), acak.randint(1, 28)
    iso = f"{th}-{bl:02d}-{hr:02d}"
    teks = {
        "dmy": f"{hr:02d}/{bl:02d}/{th}",
        "dmy-": f"{hr:02d}-{bl:02d}-{th}",
        "dmy2": f"{hr:02d}/{bl:02d}/{str(th)[2:]}",
        "iso": iso,
        "panjang": f"{hr} {BULAN[bl - 1]} {th}",
        "singkat": f"{hr:02d} {SINGKAT[bl - 1]} {th}",
    }[gaya]
    return iso, teks


def bensin(a):
    liter = round(a.uniform(3, 30), 2)
    harga = 10000
    total = int(round(liter * harga, -2))
    iso, t = tgl(a, a.choice(["dmy", "dmy-"]))
    return "bensin", total, iso, f"""SPBU 34.{a.randint(100, 999)}.{a.randint(10, 99)}
JL. RAYA SINGARAJA KM {a.randint(1, 20)}
Shift : {a.randint(1, 3)}   No.Trans : {a.randint(100000, 999999)}
Waktu : {t} {a.randint(6, 22):02d}:{a.randint(0, 59):02d}
Pulau/Pompa : {a.randint(1, 4)}
Nama Produk : PERTALITE
Harga/Liter : Rp. {rp_titik(harga)}
Volume : (L) {str(liter).replace('.', ',')}
Total Harga : Rp. {rp_titik(total)}
Operator : {a.choice(['WAYAN', 'KADEK', 'NYOMAN'])}
CASH : {rp_titik(total + a.choice([0, 1000, 5000]))}
TERIMA KASIH DAN SELAMAT JALAN"""


def parkir(a):
    total = a.choice([2000, 3000, 5000, 10000, 15000])
    iso, t = tgl(a, a.choice(["dmy", "iso"]))
    return "parkir", total, iso, f"""PARKIR MAL SENTRAL
Plat : DK {a.randint(1000, 9999)} AB
Masuk  : {t} 09:{a.randint(10, 59)}
Keluar : {t} 12:{a.randint(10, 59)}
Durasi : 3 jam
Tarif Parkir
Total Bayar Rp {rp_titik(total)}
Terima kasih"""


def tol(a):
    total = a.choice([4500, 11500, 13000, 24000])
    iso, t = tgl(a, "dmy")
    return "tol", total, iso, f"""GERBANG TOL BALI MANDARA
GT. NUSA DUA {a.randint(1, 4)}
Gol : I
Tgl : {t}  Jam : 07:4{a.randint(0, 9)}
Tarif : Rp. {rp_titik(total)}
Saldo e-Toll : Rp. {rp_titik(a.randint(20, 200) * 1000)}"""


def ojek(a):
    jarak = a.randint(3, 25)
    total = jarak * a.choice([2500, 3000]) + 2000
    diskon = a.choice([0, 3000, 5000])
    iso, t = tgl(a, a.choice(["panjang", "singkat"]))
    bayar = total - diskon
    return "transport", bayar, iso, f"""Terima kasih sudah memakai Ojek Daring
Perjalanan kamu pada {t}
Dari: Jl. Gatot Subroto Timur
Ke: Kantor Cabang Renon
Jarak {jarak} km
Tarif perjalanan       Rp{rp_titik(total - 2000)}
Biaya jasa aplikasi    Rp2.000
Diskon                 -Rp{rp_titik(diskon)}
Total dibayar          Rp{rp_titik(bayar)}
Metode: Dompet digital"""


def makan(a):
    item = [(a.choice(["Nasi campur", "Ayam betutu", "Mie goreng", "Es teh", "Kopi susu"]), a.choice([8000, 15000, 25000, 35000])) for _ in range(a.randint(2, 5))]
    sub = sum(h for _, h in item)
    pajak = int(sub * 0.1)
    total = sub + pajak
    iso, t = tgl(a, a.choice(["dmy", "dmy2"]))
    isi = "\n".join(f"{n:<20} {rp_titik(h)}" for n, h in item)
    return "makan", total, iso, f"""RUMAH MAKAN SARI RASA
Jl. Teuku Umar No. {a.randint(1, 99)}
{t} {a.randint(11, 20)}:{a.randint(10, 59)}
Meja {a.randint(1, 20)}
{isi}
Subtotal             {rp_titik(sub)}
PB1 10%              {rp_titik(pajak)}
Grand Total          {rp_titik(total)}
Tunai                {rp_titik(total + 5000)}
Kembali              5.000"""


def hotel(a):
    malam = a.randint(1, 3)
    tarif = a.choice([350000, 450000, 600000])
    total = malam * tarif
    iso, t = tgl(a, "panjang")
    return "hotel", total, iso, f"""HOTEL MELATI INDAH
Invoice / Folio
Check-in: {t}
Room 2{a.randint(10, 30)} - Deluxe
Room charge {malam} night(s) x IDR {rp_koma(tarif)}
Total Amount  IDR {rp_koma(total)}.00
Paid by: Transfer"""


def atk(a):
    total = a.choice([27500, 48000, 76500, 120000])
    iso, t = tgl(a, "dmy-")
    return "atk", total, iso, f"""TOKO ALAT TULIS CERIA
{t}
Kertas HVS A4 1 rim
Pulpen hitam 1 lusin
Fotokopi 40 lembar
TOTAL : {rp_titik(total)}
BAYAR : {rp_titik(total)}"""


def pulsa(a):
    total = a.choice([25000, 50000, 100000])
    iso, t = tgl(a, "singkat")
    return "pulsa", total, iso, f"""Bukti pembelian
Paket data 15 GB 30 hari
Nomor 0812-xxxx-{a.randint(1000, 9999)}
Tanggal {t}
Harga Rp{rp_titik(total)}
Jumlah dibayar Rp{rp_titik(total)}
Status: Berhasil"""


def main():
    a = random.Random(20261105)
    os.makedirs(AKAR, exist_ok=True)
    harapan = {}
    pembuat = [bensin, parkir, tol, ojek, makan, hotel, atk, pulsa]
    for i in range(32):
        kel, total, iso, teks = pembuat[i % len(pembuat)](a)
        nama = f"struk-{i + 1:02d}.txt"
        open(os.path.join(AKAR, nama), "w", encoding="utf8", newline="\n").write(teks + "\n")
        harapan[nama] = {"total": total, "tanggal": iso, "kategori": kel}
    open(os.path.join(AKAR, "harapan.json"), "w", encoding="utf8", newline="\n").write(json.dumps(harapan, indent=1) + "\n")
    print(len(harapan), "struk")


if __name__ == "__main__":
    main()
