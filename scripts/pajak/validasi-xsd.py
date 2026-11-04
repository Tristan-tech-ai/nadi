"""M-09: validasi berkas XML Faktur Pajak Keluaran terhadap skema turunan docs/pajak/coretax/TaxInvoice.xsd (lxml).

Contoh resmi DJP (fixtures/korpus/efaktur/resmi) wajib lolos lebih dulu, supaya skema tidak lebih ketat dari Coretax; lalu
semua berkas korpus (fixtures/korpus/efaktur/*.xml) atau berkas yang disebut di argumen.
Pakai: python -I scripts/pajak/validasi-xsd.py [BERKAS.xml ...]   |   uji diri merah: --selftest
"""
import glob
import os
import sys

from lxml import etree

AKAR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SKEMA = etree.XMLSchema(etree.parse(os.path.join(AKAR, "docs", "pajak", "coretax", "TaxInvoice.xsd")))


def periksa(jalur):
    doc = etree.parse(jalur)
    ok = SKEMA.validate(doc)
    return ok, [f"{e.line}: {e.message}" for e in SKEMA.error_log][:5]


def main(arg):
    if arg == ["--selftest"]:
        rusak = b'<?xml version="1.0"?><TaxInvoiceBulk><TIN>123</TIN><ListOfTaxInvoice/></TaxInvoiceBulk>'
        ok = SKEMA.validate(etree.fromstring(rusak))
        print("uji diri:", "LULUS (berkas rusak ditolak)" if not ok else "GAGAL (berkas rusak diterima)")
        return 0 if not ok else 1
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
