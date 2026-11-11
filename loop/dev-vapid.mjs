// Membuat pasangan kunci VAPID sekali pakai untuk Supabase LOKAL dan mencetak SQL ke stdout (dipipa langsung ke psql oleh
// loop/dev-db.sh, tidak ditulis ke berkas). Produksi punya kuncinya sendiri di vault; skrip ini tidak menyentuhnya.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
// Kunci publik server aplikasi: titik tak terkompresi 0x04 || X || Y (65 bita), base64url = 87 huruf.
const publik = Buffer.from(publicKey.export({ format: "der", type: "spki" }).subarray(-65)).toString("base64url");
// Bentuk sama dengan webpush.exportVapidKeys di supabase/functions/push: { publicKey: JWK, privateKey: JWK }.
const pasangan = JSON.stringify({ publicKey: publicKey.export({ format: "jwk" }), privateKey: privateKey.export({ format: "jwk" }) });
const sql = (s) => "'" + s.replaceAll("'", "''") + "'";
// Bila sudah ada kunci lokal (misalnya bentuk lama), rahasia vault diganti di tempat; selain itu lewat vapid_simpan.
process.stdout.write(`do $$ begin
  if exists (select 1 from app.vapid) then
    perform vault.update_secret((select rahasia_id from app.vapid), ${sql(pasangan)});
    update app.vapid set publik = ${sql(publik)};
  else
    perform public.vapid_simpan(${sql(publik)}, ${sql(pasangan)});
  end if;
end $$;
`);
