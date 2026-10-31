-- Q-26 (docs/quality/zona-hari-ini-pemakai.md, docs/quality/rencana-uji-q26.md): "hari ini" di database memakai zona usaha
-- lewat app.hari_ini(pid), bukan current_date (tanggal UTC server). Penulis dan pembaca pakai_topi.mulai diubah dalam satu
-- migrasi: kalau hanya sebagian, topi yang dipasang antara 00.00 lokal dan 00.00 UTC tidak terhitung sampai pagi.
-- 1. Pembaca: app.hitung_lintas_topi (pemicu kerja) dan app.beban_orang. Penulis: app.pasang_topi_dari_jabatan dan
--    public.simpan_rencana_magang. Definisi hidup diambil dengan pg_get_functiondef, lalu hanya ekspresi tanggal diganti lewat
--    replace teks persis dengan jumlah kemunculan diperiksa (gagal bila beda). Isi lain tidak tersentuh.
-- 2. app.hitung_lintas_topi dipicu juga oleh insert/update kerja langsung dari klien (authenticated), sedangkan app.hari_ini
--    sengaja tidak bisa dipanggil authenticated. Pemicu ini dijadikan security definer; sebagai ganti penyaring RLS yang tadinya
--    berlaku untuk klien, pencarian pakai_topi dibatasi ke usaha baris kerja itu (p.perusahaan_id = new.perusahaan_id).
-- 3. Bawaan pakai_topi.mulai (CURRENT_DATE) dihapus. Bawaan kolom diisi sebelum pemicu BEFORE berjalan, jadi kalau dibiarkan,
--    pemicu tidak pernah melihat null. Pemicu BEFORE INSERT pakai_topi_mulai mengisi app.hari_ini(new.perusahaan_id) bila mulai
--    null; NOT NULL diperiksa sesudah pemicu BEFORE ROW, jadi insert tanpa mulai tetap sah. Penulis lama yang tidak mengisi mulai
--    (putuskan_usulan cabang orang.topi, insert klien) tidak diubah. Fungsi pemicu tidak bisa dipanggil langsung.
-- 4. Daftar putih pola tanggal UTC (date_trunc('day', now())): app.isi_demo dan public.demo_lihat, diberi komentar alasan.
-- 5. Data lama tidak dikoreksi: baris yang mulai satu hari lebih awal tetap terhitung (hanya memanjang satu hari ke belakang).

create function pg_temp.ganti_tanggal(p_fungsi regprocedure, variadic p_pasangan text[]) returns void
language plpgsql as $$
declare d text := pg_get_functiondef(p_fungsi); lama text; baru text; n int; ada int;
begin
  for i in 1 .. array_length(p_pasangan, 1) / 3 loop
    lama := p_pasangan[3 * i - 2]; baru := p_pasangan[3 * i - 1]; n := p_pasangan[3 * i]::int;
    ada := (length(d) - length(replace(d, lama, ''))) / length(lama);
    if ada <> n then
      raise exception 'Q-26: % memuat pola % kali, bukan %: %', p_fungsi, ada, n, lama;
    end if;
    d := replace(d, lama, baru);
  end loop;
  if d ~* 'current_date' then
    raise exception 'Q-26: % masih memuat current_date', p_fungsi;
  end if;
  execute d;
end $$;

-- Pembaca.
select pg_temp.ganti_tanggal('app.hitung_lintas_topi()',
  $a$where p.orang_id = new.pelaksana_id and p.topi_id = new.topi_id$a$,
  $a$where p.perusahaan_id = new.perusahaan_id and p.orang_id = new.pelaksana_id and p.topi_id = new.topi_id$a$, '1',
  $a$p.mulai <= current_date and (p.selesai is null or p.selesai >= current_date)$a$,
  $a$p.mulai <= app.hari_ini(new.perusahaan_id) and (p.selesai is null or p.selesai >= app.hari_ini(new.perusahaan_id))$a$, '1');

select pg_temp.ganti_tanggal('app.beban_orang(uuid,date)',
  $a$pt.mulai <= current_date and (pt.selesai is null or pt.selesai >= current_date)$a$,
  $a$pt.mulai <= app.hari_ini(p_pid) and (pt.selesai is null or pt.selesai >= app.hari_ini(p_pid))$a$, '1');

-- Penulis.
select pg_temp.ganti_tanggal('app.pasang_topi_dari_jabatan(uuid,uuid,text,date)',
  $a$coalesce(p_mulai, current_date)$a$, $a$coalesce(p_mulai, app.hari_ini(p_pid))$a$, '1');

select pg_temp.ganti_tanggal('public.simpan_rencana_magang(uuid,uuid,uuid,uuid,date,date,jsonb,text,jsonb,text,text,integer,uuid)',
  $a$(selesai is null or selesai >= current_date)$a$, $a$(selesai is null or selesai >= app.hari_ini(v_pid))$a$, '2',
  $a$values (v_pid, p_mentor, v_topi_mentor, 10, current_date)$a$, $a$values (v_pid, p_mentor, v_topi_mentor, 10, app.hari_ini(v_pid))$a$, '1');

drop function pg_temp.ganti_tanggal(regprocedure, text[]);

alter function app.hitung_lintas_topi() security definer;
revoke all on function app.hitung_lintas_topi() from public, anon, authenticated;
comment on function app.hitung_lintas_topi() is 'Pemicu kerja: lintas_topi = pelaksana tidak memakai topi kerja itu hari ini (zona usaha, app.hari_ini). Security definer karena dipicu insert klien dan app.hari_ini tidak bisa dipanggil authenticated; pencarian dibatasi ke usaha baris kerja (Q-26).';

-- Bawaan pakai_topi.mulai.
create function app.isi_mulai_pakai_topi() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mulai is null then
    new.mulai := app.hari_ini(new.perusahaan_id);
  end if;
  return new;
end $$;

revoke all on function app.isi_mulai_pakai_topi() from public, anon, authenticated;
comment on function app.isi_mulai_pakai_topi() is 'Pemicu pakai_topi: mulai kosong diisi tanggal hari ini di zona usaha (app.hari_ini), pengganti bawaan CURRENT_DATE (UTC). Security definer karena dipicu insert klien (Q-26).';

alter table public.pakai_topi alter column mulai drop default;
create trigger pakai_topi_mulai before insert on public.pakai_topi
  for each row execute function app.isi_mulai_pakai_topi();

-- Daftar putih.
comment on function app.isi_demo() is 'Mengisi usaha contoh. Asia/Makassar di sini sengaja: nilai kolom zona_waktu usaha demo (data), bukan perhitungan batas hari (Q-24). Batas hari date_trunc(''day'', now()) (UTC) juga sengaja: data demo sintetis, sepasang dengan public.demo_lihat yang membaca di hari UTC yang sama (Q-26).';
comment on function public.demo_lihat(text) is 'SECURITY DEFINER dan anon DISENGAJA: halaman demo publik baca-saja; hanya membaca usaha dengan pengaturan.demo fnb/toko. Batas hari date_trunc(''day'', now()) (UTC) sengaja: sepasang dengan app.isi_demo yang menanam data demo di hari UTC yang sama, bukan data usaha nyata (Q-26).';
