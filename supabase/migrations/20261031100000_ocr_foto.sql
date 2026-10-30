-- OCR foto di perangkat: teks hasil tesseract.js disimpan bersama berkas agar baca-berkas bisa mencoba aturan tersimpan
-- (0 token) untuk foto nota. Hanya pengunggah berkas yang masih berstatus 'unggah' yang boleh menyimpannya.
alter table public.berkas add column teks_ocr text check (teks_ocr is null or length(teks_ocr) <= 20000);
alter table public.berkas add column ocr_keyakinan real check (ocr_keyakinan is null or ocr_keyakinan between 0 and 100);

create or replace function public.simpan_ocr(p_berkas uuid, p_teks text, p_keyakinan real) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_keyakinan is null or p_keyakinan < 0 or p_keyakinan > 100 then raise exception 'Keyakinan OCR tidak sah' using errcode = '22023'; end if;
  update public.berkas set teks_ocr = left(p_teks, 20000), ocr_keyakinan = p_keyakinan
   where id = p_berkas and perusahaan_id = app.pid() and diunggah_oleh = auth.uid() and status = 'unggah' and mime like 'image/%';
  return found;
end $$;
revoke all on function public.simpan_ocr(uuid, text, real) from public, anon;
grant execute on function public.simpan_ocr(uuid, text, real) to authenticated;
