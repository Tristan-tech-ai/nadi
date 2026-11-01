-- F4-04 lanjutan: app.jaga_jurnal membaca old.dibalik_oleh dalam satu syarat AND bersama tg_table_name; PL/pgSQL tidak menjamin
-- syarat berhenti lebih awal, sehingga UPDATE jurnal_baris (yang tidak punya kolom itu) ditolak dengan galat 42703, bukan pesan
-- jurnal balik. Ditemukan tes ledger ("baris jurnal tidak bisa diedit"). Syarat dipecah per tabel.
create or replace function app.jaga_jurnal() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and tg_table_name = 'jurnal' then
    if old.dibalik_oleh is null and new.dibalik_oleh is not null
       and (to_jsonb(new) - 'dibalik_oleh' - 'alasan_balik') = (to_jsonb(old) - 'dibalik_oleh' - 'alasan_balik') then
      return new;
    end if;
  end if;
  raise exception 'Jurnal yang sudah dibukukan tidak bisa diubah atau dihapus. Betulkan dengan jurnal balik.' using errcode = '42501';
end $$;
revoke all on function app.jaga_jurnal() from public, anon, authenticated;
