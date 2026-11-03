/** Isi {nama} di teks kamus dengan nilai. Berkas sendiri agar komponen klien bisa memakainya tanpa menarik kamus. */
export function isiTeks(teks: string, nilai: Record<string, string | number>): string {
  return teks.replace(/\{(\w+)\}/g, (_, k: string) => String(nilai[k] ?? `{${k}}`));
}
