-- F3-07E lanjutan: tanggal di penjelasan usulan hak berhenti memakai format VOICE.md ("4 Des 2026", bukan "04-12-2026").
-- Isi fungsi sama dengan 20261104048000_hak_berhenti.sql selain baris tanggal itu.

create or replace function public.ajukan_hak_berhenti(p_berhenti uuid, p_rincian jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.berhenti := app.wajib_pemilik_berhenti(p_berhenti); v_nama text; v_gaji bigint; v_cuti bigint; v_pisah bigint; v_total bigint;
  v_hari numeric; v_upah bigint; u public.usulan; v_judul text; v_ket text[]; v_payload jsonb;
begin
  if jsonb_typeof(p_rincian) is distinct from 'object' then raise exception 'Rincian hak tidak lengkap.' using errcode = '22023'; end if;
  begin
    v_gaji := coalesce((p_rincian ->> 'gaji_akhir')::bigint, 0);
    v_cuti := (p_rincian ->> 'cuti')::bigint;
    v_pisah := (p_rincian ->> 'uang_pisah')::bigint;
    v_hari := (p_rincian ->> 'cuti_hari')::numeric;
    v_upah := (p_rincian ->> 'upah_harian')::bigint;
  exception when others then
    raise exception 'Nilai hak harus rupiah bulat.' using errcode = '22023';
  end;
  if v_gaji < 0 or coalesce(v_cuti, 0) < 0 or coalesce(v_pisah, 0) < 0
     or greatest(v_gaji, coalesce(v_cuti, 0), coalesce(v_pisah, 0)) > 100000000000 then
    raise exception 'Nilai hak tidak boleh negatif.' using errcode = '22023';
  end if;
  v_total := v_gaji + coalesce(v_cuti, 0) + coalesce(v_pisah, 0);
  if v_total <= 0 then raise exception 'Total hak masih Rp0.' using errcode = '22023'; end if;
  select o.nama into v_nama from public.orang o where o.id = b.orang_id;

  update public.berhenti set uang_pisah = v_pisah where id = b.id;
  v_judul := left('Bayar hak ' || v_nama || ' yang berhenti: ' || app.rupiah(v_total), 200);
  v_ket := array_remove(array[
    'Gaji sampai ' || extract(day from b.tanggal_efektif)::int || ' ' || (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from b.tanggal_efektif)::int] || ' ' || extract(year from b.tanggal_efektif)::int || ': ' || app.rupiah(v_gaji) || coalesce(' (' || nullif(left(btrim(p_rincian ->> 'dasar_gaji'), 200), '') || ')', ''),
    case when v_cuti is not null then 'Penggantian sisa cuti' || coalesce(' ' || trim_scale(v_hari)::text || ' hari', '') || coalesce(' x ' || app.rupiah(v_upah), '')
      || ': ' || app.rupiah(v_cuti) || ' (PP 35/2021 Pasal 40 ayat (4) huruf a; upah sehari PP 36/2021 Pasal 17)' end,
    case when v_pisah is not null then 'Uang pisah: ' || app.rupiah(v_pisah) || ' (isian pemilik; besarnya diatur perjanjian kerja atau peraturan perusahaan)' end,
    case when b.alasan = 'mundur' then 'Tanpa pesangon: mengundurkan diri mendapat uang penggantian hak dan uang pisah (PP 35/2021 Pasal 50).'
      else 'Pesangon atau kompensasi untuk alasan ini belum dihitung Nadi; periksa perjanjian kerja.' end,
    'Menyetujui hanya mencatat keputusan; pembayaran tetap kamu lakukan sendiri.'], null);
  v_payload := jsonb_build_object('berhenti_id', b.id, 'orang_id', b.orang_id,
    'bidang', jsonb_strip_nulls(jsonb_build_object('tanggal', b.tanggal_efektif, 'orang_id', b.orang_id, 'berhenti_id', b.id,
      'gaji_akhir', v_gaji, 'cuti', v_cuti, 'cuti_hari', v_hari, 'upah_harian', v_upah, 'uang_pisah', v_pisah, 'total', v_total,
      'pesangon', case when b.alasan = 'mundur' then 'tidak_berlaku' else 'belum_dihitung' end)),
    'sumber_pasal', jsonb_build_array('PP 35/2021 Pasal 40 ayat (4)', 'PP 35/2021 Pasal 50', 'PP 36/2021 Pasal 17'));

  select * into u from public.usulan x
   where x.perusahaan_id = b.perusahaan_id and x.aksi = 'uang.hak_berhenti' and x.payload ->> 'berhenti_id' = b.id::text
     and x.status in ('menunggu', 'diterima', 'otomatis')
   order by x.dibuat_at desc limit 1 for update;
  if u.id is not null and u.status <> 'menunggu' then
    raise exception 'Hak keuangan orang ini sudah disetujui.' using errcode = '23505';
  end if;
  if u.id is not null then
    update public.usulan set judul = v_judul, penjelasan = array_to_string(v_ket, E'\n'), payload = v_payload, dampak_rp = v_total
     where id = u.id;
    return jsonb_build_object('usulan', u.id, 'total', v_total, 'baru', false);
  end if;
  insert into public.usulan (perusahaan_id, sumber, aksi, judul, penjelasan, payload, dampak_rp, untuk_peran)
  values (b.perusahaan_id, 'aturan', 'uang.hak_berhenti', v_judul, array_to_string(v_ket, E'\n'), v_payload, v_total, '{pemilik}')
  returning * into u;
  return jsonb_build_object('usulan', u.id, 'total', v_total, 'baru', true);
end $$;

