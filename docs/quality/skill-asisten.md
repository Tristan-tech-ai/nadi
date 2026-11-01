# Hasil uji F6-05 Paket skill asisten AI (1 Nov 2026)

| Butir | Hasil |
|---|---|
| Modul apps/web/src/lib/skill/paket.ts | vitest merah (modul belum ada) lalu 16/16: nama sesuai spesifikasi (huruf kecil, tanda hubung, <= 64, aksen dibuang), pemeriksa menolak huruf besar, tanda hubung berurutan/tepi, name beda folder, description kosong/>1024, tanpa frontmatter, badan >= 500 baris; zip berisi satu folder |
| e2e skill.spec (lokal, desktop) | lulus: unduh dari /app/perusahaan, zip nadi-warung-uji-a berisi SKILL.md + references/usaha.md, periksaSkill bersih, alamat MCP situs, tanpa angka panjang |
| Validator resmi skills-ref 0.1.1 | `agentskills validate` pada folder hasil unduhan: "Valid skill". Kendali: folder dengan name huruf besar ditolak ("must be lowercase") |
| Data pribadi | tidak ada nama orang, gaji, NIK, atau rekening; topi nonaktif tidak ikut |
