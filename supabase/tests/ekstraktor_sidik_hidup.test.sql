-- T-01B: sidik tata letak boleh dipakai ulang setelah aturannya mati, tetapi tetap unik di antara aturan hidup.
-- Diakhiri raise exception seperti tes lain supaya semua perubahan dibatalkan (sebelumnya diakhiri select, sehingga
-- dijalankan di luar transaksi yang dibatalkan, baris uji tertinggal).
create temp table _t (n int, ok boolean, ket text) on commit drop;
do $$
declare p uuid; a jsonb := '{"bentuk":"teks","jenis":"struk","jangkar":["SPBU","Total Harga"],"bidang":{"total":{"pola":"Total Harga\\s*:\\s*Rp\\.?\\s*([\\d.]+)","tipe":"rupiah"}}}';
begin
  select id into p from public.perusahaan order by dibuat_at limit 1;
  insert into public.ekstraktor (perusahaan_id, sidik_tata_letak, jenis_berkas, aturan, status, versi) values (p, 'uji-sidik-t01b', 'struk', a, 'bayangan', 1);
  begin
    insert into public.ekstraktor (perusahaan_id, sidik_tata_letak, jenis_berkas, aturan, status, versi) values (p, 'uji-sidik-t01b', 'struk', a, 'bayangan', 1);
    insert into _t values (1, false, 'dua aturan hidup bersidik sama diterima');
  exception when unique_violation then insert into _t values (1, true, 'dua aturan hidup bersidik sama ditolak');
  end;
  update public.ekstraktor set status = 'mati', alasan_mati = 'uji' where perusahaan_id = p and sidik_tata_letak = 'uji-sidik-t01b';
  begin
    insert into public.ekstraktor (perusahaan_id, sidik_tata_letak, jenis_berkas, aturan, status, versi) values (p, 'uji-sidik-t01b', 'struk', a, 'bayangan', 1);
    insert into _t values (2, true, 'tata letak yang aturannya mati bisa dipelajari ulang');
  exception when unique_violation then insert into _t values (2, false, 'sidik aturan mati masih menghalangi');
  end;
  insert into _t select 3, count(*) = 2, 'aturan mati tetap tersimpan sebagai jejak' from public.ekstraktor where perusahaan_id = p and sidik_tata_letak = 'uji-sidik-t01b';
  begin
    insert into public.ekstraktor (perusahaan_id, sidik_tata_letak, jenis_berkas, aturan, status, versi) values (p, 'uji-sidik-t01b', 'struk', a, 'bayangan', 1);
    insert into _t values (4, false, 'aturan hidup kedua diterima setelah pelajari ulang');
  exception when unique_violation then insert into _t values (4, true, 'aturan hidup tetap unik setelah pelajari ulang');
  end;
end $$;
do $$ begin raise exception '%', (select 'HASIL_TES ' || count(*) filter (where ok) || ' | gagal=' || coalesce(json_agg(n) filter (where not ok)::text, '[]') from _t); end $$;
