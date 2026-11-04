-- M-10 lanjutan: beri_kasbon memasang bagan akun bawaan dulu (usaha baru belum punya 1-100/1-110 sampai ada jurnal pertama),
-- ditemukan tes gaji_lanjutan. Fungsi lain di 20261105066000_gaji_lanjutan.sql tidak berubah.
create or replace function public.beri_kasbon(p_orang uuid, p_jumlah bigint, p_cicilan bigint, p_cara text, p_alasan text, p_kunci uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_pid uuid := app.pid(); k public.kasbon; v_jurnal jsonb; v_hari date;
begin
  if v_pid is null or coalesce((select app.peran_aktif()), '') <> 'pemilik' then
    raise exception 'Hanya pemilik yang memberi kasbon' using errcode = '42501';
  end if;
  if p_kunci is null then raise exception 'Kunci klien wajib' using errcode = '22023'; end if;
  select * into k from public.kasbon where perusahaan_id = v_pid and kunci_klien = p_kunci;
  if found then return jsonb_build_object('id', k.id, 'sudah', true); end if;
  if not exists (select 1 from public.orang where id = p_orang and perusahaan_id = v_pid and status = 'aktif') then
    raise exception 'Orang tidak ditemukan di usaha ini' using errcode = 'P0002';
  end if;
  if p_jumlah is null or p_jumlah <= 0 or p_cicilan is null or p_cicilan <= 0 or p_cicilan > p_jumlah then
    raise exception 'Isi jumlah kasbon dan cicilan per bulan (cicilan tidak melebihi jumlah)' using errcode = '22023';
  end if;
  if p_cara not in ('tunai', 'transfer') then raise exception 'Pilih tunai atau transfer' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_alasan, ''))) < 3 then raise exception 'Tulis alasan kasbon' using errcode = '22023'; end if;
  v_hari := app.hari_ini(v_pid);
  perform app.pasang_bagan_bawaan(v_pid);
  perform app.akun_pastikan(v_pid, '1-150', 'Piutang karyawan (kasbon)', 'aset', 'debit');
  v_jurnal := app.posting_jurnal(v_pid, jsonb_build_object('tanggal', v_hari, 'keterangan', left('Kasbon ' || (select nama from public.orang where id = p_orang), 200),
    'sumber', 'gaji', 'sumber_id', p_orang::text, 'kunci_idempoten', 'kasbon:' || p_kunci),
    jsonb_build_array(jsonb_build_object('akun', '1-150', 'debit', p_jumlah), jsonb_build_object('akun', case when p_cara = 'tunai' then '1-100' else '1-110' end, 'kredit', p_jumlah)), auth.uid());
  insert into public.kasbon (perusahaan_id, orang_id, jumlah, cicilan, sisa, tanggal, cara, alasan, jurnal_id, kunci_klien, dibuat_oleh)
  values (v_pid, p_orang, p_jumlah, p_cicilan, p_jumlah, v_hari, p_cara, btrim(p_alasan), (v_jurnal ->> 'id')::uuid, p_kunci, auth.uid()) returning * into k;
  return jsonb_build_object('id', k.id, 'sisa', k.sisa, 'sudah', false);
end $$;
