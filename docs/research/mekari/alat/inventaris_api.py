"""Ringkas spesifikasi API publik Mekari menjadi daftar endpoint + entitas/kolom.
Pakai: python -I api_inv.py <folder_api> <berkas_keluar.md>
"""
import json, sys, os, re
import yaml

src, out = sys.argv[1], sys.argv[2]
L = ["# Inventaris API publik Mekari", "",
     "Sumber: developers.mekari.com/docs/kb/product-api (diakses 4 Nov 2026) yang menautkan koleksi Postman Talenta,",
     "Klikpajak, Qontak CRM, Swagger Jurnal (api-doc.jurnal.id), OpenAPI POS (api-docs-pos.mekari.com), OpenAPI Sign",
     "(api-docs.esign.mekari.com), dan dokumentasi Expense (api-docs.expense.mekari.com). API menunjukkan entitas data dan",
     "aksi yang benar-benar ada di balik layar setiap produk.", ""]

def postman(nama, f):
    d = json.load(open(f, encoding="utf-8"))
    L.append(f"## {nama} (Postman: {d.get('info', {}).get('name')})")
    n = 0
    def jalan(items, induk):
        nonlocal n
        for it in items:
            if "item" in it:
                L.append(f"{'#' * min(3 + len(induk), 6)} {it.get('name')}")
                jalan(it["item"], induk + [it.get("name")])
            elif "request" in it:
                r = it["request"]
                url = r.get("url", {})
                p = url.get("raw") if isinstance(url, dict) else url
                p = re.sub(r"\{\{[^}]+\}\}", "", p or "")
                p = re.sub(r"https?://[^/]+", "", p).split("?")[0]
                L.append(f"- {r.get('method')} {p}  {it.get('name')}")
                n += 1
    jalan(d.get("item", []), [])
    L.append(f"\nJumlah endpoint: {n}\n")

def openapi(nama, spec):
    L.append(f"## {nama} ({spec.get('info', {}).get('title')} {spec.get('info', {}).get('version', '')})")
    n = 0
    tag = {}
    for p, ops in (spec.get("paths") or {}).items():
        for m, op in ops.items():
            if m.lower() not in ("get", "post", "put", "patch", "delete"):
                continue
            t = (op.get("tags") or ["lain"])[0]
            tag.setdefault(t, []).append(f"- {m.upper()} {p}  {op.get('summary') or op.get('operationId') or ''}".rstrip())
            n += 1
    for t in sorted(tag):
        L.append(f"### {t}")
        L.extend(tag[t])
    sk = (spec.get("components") or {}).get("schemas") or spec.get("definitions") or {}
    if sk:
        L.append("### Entitas (skema) dan kolomnya")
        for nm, s in sorted(sk.items()):
            props = list((s.get("properties") or {}).keys())
            if not props and "allOf" in s:
                for x in s["allOf"]:
                    props += list((x.get("properties") or {}).keys())
            if props:
                L.append(f"- {nm}: {', '.join(props[:60])}{' ...' if len(props) > 60 else ''}")
    L.append(f"\nJumlah endpoint: {n}\n")

postman("Talenta", os.path.join(src, "postman_12246328_UVR5qp6v.json"))
postman("Klikpajak", os.path.join(src, "postman_17365057_U16hrR5d.json"))
postman("Qontak CRM", os.path.join(src, "postman_22728681_2sAXxV6A5V.json"))
openapi("Jurnal", json.load(open(os.path.join(src, "jurnal_swagger.json"), encoding="utf-8")))
openapi("Mekari POS", json.load(open(os.path.join(src, "pos_openapi.json"), encoding="utf-8")))
openapi("Mekari Sign", yaml.safe_load(open(os.path.join(src, "sign_openapi.yml"), encoding="utf-8")))
L.append("## Mekari Expense (halaman dokumentasi)")
for u in open(os.path.join(src, "expense_urls.txt"), encoding="utf-8"):
    u = u.strip().replace("https://api.mekari.com", "")
    if u.startswith("/api/"):
        L.append(f"- {u[5:].replace('-', ' ')}")
open(out, "w", encoding="utf-8", newline="\n").write("\n".join(L) + "\n")
print(len(L), "baris")
