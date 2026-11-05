-- M-07 perbaikan: alias x di app.finish_work_order bentrok dengan variabel x (42702, ditemukan tes SQL produksi).
create or replace function app.finish_work_order(p_pid uuid, p_wo uuid, p_hasil numeric, p_lain jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare w public.work_order; b public.bom; e jsonb; v_konv bigint; v_tot bigint; v_sisa bigint; v_samping bigint := 0; v_lines jsonb := '[]';
  v_bobot numeric := 0; v_n int; i int := 0; v_nilai bigint; v_alok bigint := 0; x jsonb; v_hasil numeric; v_harga numeric; v_var bigint;
begin
  select * into w from public.work_order where id = p_wo and perusahaan_id = p_pid for update;
  if w.status <> 'running' then raise exception 'Ambil bahan dulu sebelum menyelesaikan perintah kerja' using errcode = '22023'; end if;
  select * into b from public.bom where id = w.bom_id;
  v_hasil := coalesce(p_hasil, w.planned_qty);
  if v_hasil <= 0 then raise exception 'Jumlah hasil harus lebih dari 0' using errcode = '22023'; end if;
  v_konv := round(b.conversion_cost * w.factor)::bigint;
  v_tot := w.material_cost + v_konv;
  -- Baris hasil: utama dulu, lalu hasil lain.
  v_lines := jsonb_build_array(jsonb_build_object('produk', w.product_id, 'jumlah', v_hasil, 'jenis', 'utama'));
  for e in select * from jsonb_array_elements(b.other_outputs) loop
    v_lines := v_lines || jsonb_build_object('produk', e ->> 'produk', 'jenis', e ->> 'jenis',
      'jumlah', coalesce((select (a ->> 'jumlah')::numeric from jsonb_array_elements(coalesce(p_lain, '[]')) a where a ->> 'produk' = e ->> 'produk' limit 1),
                         round((e ->> 'jumlah')::numeric * w.factor, 4)));
  end loop;
  -- Sampingan pada nilai realisasi neto (harga jual x jumlah), dikurangkan dari biaya; sisanya dibagi utama + bersama menurut nilai jual relatif.
  for x in select * from jsonb_array_elements(v_lines) loop
    select harga_jual into v_harga from public.produk where id = (x ->> 'produk')::uuid;
    if x ->> 'jenis' = 'sampingan' then v_samping := v_samping + round(coalesce(v_harga, 0) * (x ->> 'jumlah')::numeric)::bigint;
    elsif (x ->> 'jumlah')::numeric > 0 then v_bobot := v_bobot + coalesce(v_harga, 0) * (x ->> 'jumlah')::numeric; end if;
  end loop;
  v_samping := least(v_samping, v_tot);
  v_sisa := v_tot - v_samping;
  select count(*) into v_n from jsonb_array_elements(v_lines) z where z ->> 'jenis' <> 'sampingan' and (z ->> 'jumlah')::numeric > 0;
  if v_konv > 0 then
    perform app.posting_jurnal(p_pid, jsonb_build_object('tanggal', w.tanggal, 'keterangan', left('Biaya konversi ' || w.nomor, 200), 'sumber', 'produksi', 'sumber_id', w.id::text,
      'kunci_idempoten', 'pk:' || w.id || ':konversi'), jsonb_build_array(jsonb_build_object('akun', '1-320', 'debit', v_konv), jsonb_build_object('akun', '5-310', 'kredit', v_konv)), auth.uid());
  end if;
  x := '[]';
  for e in select * from jsonb_array_elements(v_lines) loop
    i := i + 1;
    continue when (e ->> 'jumlah')::numeric <= 0;
    select harga_jual into v_harga from public.produk where id = (e ->> 'produk')::uuid;
    if e ->> 'jenis' = 'sampingan' then
      v_nilai := least(round(coalesce(v_harga, 0) * (e ->> 'jumlah')::numeric)::bigint, v_samping);
      v_samping := v_samping - v_nilai;
    else
      v_n := v_n - 1;
      v_nilai := case when v_n = 0 then v_sisa - v_alok
                      when v_bobot > 0 then round(v_sisa * coalesce(v_harga, 0) * (e ->> 'jumlah')::numeric / v_bobot)::bigint
                      else 0 end;
      v_alok := v_alok + v_nilai;
    end if;
    perform app.gerak_stok(p_pid, (e ->> 'produk')::uuid, w.gudang_id, (e ->> 'jumlah')::numeric, v_nilai, 'masuk', w.tanggal, 'Hasil ' || w.nomor, 'produksi', w.id::text,
      'pk:' || w.id || ':hasil:' || i);
    x := x || (e || jsonb_build_object('nilai', v_nilai));
  end loop;
  if v_tot > 0 then
    perform app.posting_jurnal(p_pid, jsonb_build_object('tanggal', w.tanggal, 'keterangan', left('Hasil produksi ' || w.nomor, 200), 'sumber', 'produksi', 'sumber_id', w.id::text,
      'kunci_idempoten', 'pk:' || w.id || ':hasil'), jsonb_build_array(jsonb_build_object('akun', '1-300', 'debit', v_tot), jsonb_build_object('akun', '1-320', 'kredit', v_tot)), auth.uid());
  end if;
  v_var := v_tot - round(w.standard_unit_cost * v_hasil)::bigint;
  update public.work_order set status = 'done', conversion_cost = v_konv, outputs = x, variance = v_var, selesai_at = now() where id = w.id;
  return jsonb_build_object('nomor', w.nomor, 'biaya_total', v_tot, 'biaya_satuan', round(v_tot::numeric / v_hasil), 'standar', w.standard_unit_cost, 'selisih', v_var, 'hasil', x);
end $$;
revoke all on function app.finish_work_order(uuid, uuid, numeric, jsonb) from public, anon, authenticated;
