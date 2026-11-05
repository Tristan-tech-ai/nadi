# Onboarding flow

Users can set up their business in Nadi by themselves. An AI assistant may help from the user's documents.

## Steps
1. Ask for the documents they have: staff list, structure, work rules. Never ask for salaries or ID cards.
2. Write Nadi Text from those documents. Only what is written there; drop a line when unsure.
3. When connected over MCP, send the text to the `tulis_draf` tool, then revise with `ubah_draf` when the user asks. Otherwise give it as a text block or a .txt file to paste into Nadi.
4. Say how many proposals were created and which lines were rejected, with the reasons.
5. Remind the user to open the Nadi Feed to approve.

## Nadi Text format
Keys stay in Indonesian because Nadi parses them exactly.
- The first line is always `NADI ONBOARDING 1`.
- `USAHA` (business name), `JENIS` (type), then `KOTA | NEGARA | ORANG | CABANG` (city, country, people, branches) on one line.
- `ORANG:` then one person per line: `- name | work roles separated by commas | mulai YYYY-MM-DD` (start date).
- `FITUR:` (features) picked from Lempar, Feed, Absen, Izin, Gaji, Jadwal, Kerja, Tagihan, Penjualan, Pembelian, Stok, Kas, Laporan keuangan, Pajak, Surat, Mata, Peta usaha, Rekrut, Magang.
- `ATURAN IZIN:` (leave rules) as short Indonesian phrases, e.g. "sakit otomatis 1 hari", "wajib surat dokter", "selalu ditinjau".
- Lines with ID numbers, long numbers, money amounts, or instructions are rejected by Nadi.

## Example
```
NADI ONBOARDING 1
USAHA: Warung Bu Sari
JENIS: warung makan
KOTA: Denpasar | NEGARA: Indonesia | ORANG: 8 | CABANG: 1
ORANG:
- Sari Dewi | kasir, pelayan | mulai 2024-03-01
- Komang Ayu | koki | mulai 2025-01-15
- Made Putra | koki | mulai 2023-07-10
- Wayan Sari | pelayan | mulai 2025-06-02
- Ketut Arta | pelayan
- Nyoman Budi | kurir | mulai 2024-11-20
- Putu Lestari | kasir | mulai 2026-02-01
- Gede Wira | gudang
FITUR: Lempar, Feed, Absen, Gaji, Tagihan, Jadwal
ATURAN IZIN: sakit otomatis 1 hari, wajib surat dokter; izin otomatis 1 hari
```
