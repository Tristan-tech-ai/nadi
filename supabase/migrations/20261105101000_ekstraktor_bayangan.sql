-- T-02 pengawas bukan AI: aturan ekstraktor baru dari model tidak langsung dipakai. Statusnya bayangan sampai hasilnya sama
-- dengan model pada BAYANGAN_WAJIB (2) berkas berikutnya; beda sekali langsung mati dengan alasannya. Database menolak status
-- aktif untuk aturan baru yang belum lolos masa bayangan, jadi kode yang keliru pun tidak bisa melompatinya. Aturan lama
-- (sebelum T-02, sudah lolos uji pada berkas asalnya) ditandai versi 0. Kolom aktif lama diikutkan dari status.

-- Baris lama mendapat nilai bawaan saat kolom ditambah (status aktif, versi 0), lalu bawaan diganti untuk baris baru.
alter table public.ekstraktor
  add column status text not null default 'aktif' check (status in ('bayangan', 'aktif', 'mati')),
  add column bayangan_cocok integer not null default 0 check (bayangan_cocok >= 0),
  add column versi integer not null default 0 check (versi >= 0),
  add column asal jsonb not null default '{}'::jsonb,
  add column alasan_mati text;
alter table public.ekstraktor alter column status set default 'bayangan', alter column versi set default 1;
-- Aturan lama yang sudah dimatikan tetap mati.
update public.ekstraktor set status = 'mati' where aktif = false and versi = 0;

alter table public.ekstraktor add constraint ekstraktor_aktif_lolos_bayangan
  check (status <> 'aktif' or versi = 0 or bayangan_cocok >= 2);

create or replace function app.ekstraktor_ikut_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.aktif := new.status = 'aktif';
  return new;
end $$;
create trigger ekstraktor_ikut_status before insert or update on public.ekstraktor
  for each row execute function app.ekstraktor_ikut_status();
revoke all on function app.ekstraktor_ikut_status() from public, anon, authenticated;
