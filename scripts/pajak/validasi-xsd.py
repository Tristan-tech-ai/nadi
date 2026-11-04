"""M-09/M-09B: validasi berkas XML impor Coretax terhadap skema turunan di docs/pajak/coretax (lxml).

Skema dipilih dari elemen akar: TaxInvoiceBulk (Faktur Keluaran), BpuBulk (e-Bupot Unifikasi), InputTaxInvoiceReturn (Retur
Faktur Masukan). Contoh resmi DJP (fixtures/korpus/efaktur/resmi) wajib lolos lebih dulu, supaya skema tidak lebih ketat dari
Coretax; lalu semua berkas korpus (fixtures/korpus/efaktur/*.xml) atau berkas yang disebut di argumen.
Pakai: python -I scripts/pajak/validasi-xsd.py [BERKAS.xml ...]   |   uji diri merah: --selftest
"""
import glob
import os
import sys

from lxml import etree

AKAR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKEMA = {nama: etree.XMLSchema(etree.parse(os.path.join(AKAR, "docs", "pajak", "coretax", f"{nama}.xsd")))
         for nama in ("TaxInvoice", "BpuBulk", "InputTaxInvoiceReturn")}
AKAR_KE_SKEMA = {"TaxInvoiceBulk": "TaxInvoice", "BpuBulk": "BpuBulk", "InputTaxInvoiceReturn": "InputTaxInvoiceReturn"}


def periksa(jalur):
    doc = etree.parse(jalur)
    nama = AKAR_KE_SKEMA.get(etree.QName(doc.getroot()).localname)
    if not nama:
        return False, [f"elemen akar {doc.getroot().tag} tidak dikenal"]
    s = SKEMA[nama]
    ok = s.validate(doc)
    return ok, [f"{e.line}: {e.message}" for e in s.error_log][:5]


def main(arg):
    if arg == ["--selftest"]:
        rusak = [b'<?xml version="1.0"?><TaxInvoiceBulk><TIN>123</TIN><ListOfTaxInvoice/></TaxInvoiceBulk>',
                 b'<?xml version="1.0"?><BpuBulk><TIN>0029482015507000</TIN><ListOfBpu><Bpu><TaxPeriodMonth>13</TaxPeriodMonth></Bpu></ListOfBpu></BpuBulk>']
        ok = [SKEMA[AKAR_KE_SKEMA[etree.fromstring(r).tag]].validate(etree.fromstring(r)) for r in rusak]
        print("uji diri:", "LULUS (berkas rusak ditolak)" if not any(ok) else "GAGAL (berkas rusak diterima)")
        return 0 if not any(ok) else 1
    resmi = sorted(glob.glob(os.path.join(AKAR, "fixtures", "korpus", "efaktur", "resmi", "*.xml")))
    berkas = arg or sorted(glob.glob(os.path.join(AKAR, "fixtures", "korpus", "efaktur", "*.xml")))
    gagal = 0
    for j in resmi + berkas:
        ok, galat = periksa(j)
        print(("LOLOS " if ok else "GAGAL ") + os.path.relpath(j, AKAR) + ("" if ok else " :: " + " | ".join(galat)))
        gagal += 0 if ok else 1
    print(f"{len(resmi) + len(berkas) - gagal}/{len(resmi) + len(berkas)} lolos")
    return 1 if gagal or not berkas else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
