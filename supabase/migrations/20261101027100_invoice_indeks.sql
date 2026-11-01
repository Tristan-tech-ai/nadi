-- Advisor performa setelah migrasi invoice: FK komposit pengingat_invoice (perusahaan_id, invoice_id) belum berindeks penutup.
create index if not exists pengingat_invoice_perusahaan_invoice_idx on public.pengingat_invoice (perusahaan_id, invoice_id);
