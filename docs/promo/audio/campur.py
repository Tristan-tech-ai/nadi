# D-21: campuran audio video promo. Musik "Funk in my Pocket" (OptiKill, CC BY 3.0) dipotong mulai 61,762 dtk (ketukan bar
# pertama jendela terpilih, docs/promo/audio/analisis-funk-in-my-pocket.md). Efek suara dibuat sendiri dengan ffmpeg dan diolah
# (lapisan, EQ, pitch, kompresi, gema), ditaruh di waktu isyarat yang ditulis docs/promo/film/buat.py (film/sfx/*.json).
# Musik ditekan di bawah efek (sidechaincompress rasio 3, attack 5 ms, release 150 ms, docs/research/audio-iklan.md), lalu
# loudnorm dua langkah ke -14 LUFS, true peak -1,5 dBTP, dan diukur ulang dengan ebur128.
# Pakai: python -I campur.py LAGU.mp3 VIDEO_BISU.mp4 ISYARAT.json KELUARAN.mp4 FOLDER_KERJA
import json
import os
import re
import subprocess
import sys

MULAI_LAGU = 61.762
SR = 48000

# jenis: (graf filter lavfi pembangkit, puncak sasaran dBFS; gain dihitung dari puncak mentah). Setiap efek = beberapa lapisan yang digabung, lalu EQ, kompresi, gema.
EFEK = {
    # sapu: desis merah muda disaring pita naik, ekor gema pendek
    "sapu": ("anoisesrc=d=0.35:c=pink:a=0.6,highpass=f=900,lowpass=f=7000,afade=t=in:d=0.12,afade=t=out:st=0.16:d=0.19,"
             "equalizer=f=3500:t=q:w=1:g=4,acompressor=threshold=-18dB:ratio=3,aecho=0.6:0.4:40:0.25", -10),
    # kertas: lapisan desis tinggi pendek + ketuk rendah 140 Hz
    "kertas": ("anoisesrc=d=0.09:c=white:a=0.5,highpass=f=2500,afade=t=out:d=0.09[a];"
               "sine=f=140:d=0.08,afade=t=out:d=0.08,volume=0.6[b];[a][b]amix=inputs=2:normalize=0,acompressor=threshold=-16dB:ratio=4", -9),
    # dentum: sinus 55 Hz dengan pitch turun (frekuensi meluncur lewat aevalsrc) + ledakan desis rendah + gema ruang
    "dentum": ("aevalsrc='0.9*sin(2*PI*(70-30*t)*t)*exp(-4*t)':d=0.9[a];anoisesrc=d=0.2:c=brown:a=0.5,lowpass=f=400,afade=t=out:d=0.2[b];"
               "[a][b]amix=inputs=2:normalize=0,equalizer=f=60:t=q:w=1:g=5,acompressor=threshold=-14dB:ratio=4,aecho=0.7:0.5:80|160:0.3|0.15", -2),
    # klik: sinus 2,2 kHz 12 ms + desis tinggi 6 ms
    "klik": ("sine=f=2200:d=0.012,afade=t=out:d=0.012[a];anoisesrc=d=0.006:c=white:a=0.4,highpass=f=4000[b];"
             "[a][b]amix=inputs=2:normalize=0,equalizer=f=3000:t=q:w=2:g=3", -8),
    # taruh: dentum kecil 95 Hz + kertas
    "taruh": ("aevalsrc='0.8*sin(2*PI*(120-40*t)*t)*exp(-9*t)':d=0.35[a];anoisesrc=d=0.08:c=white:a=0.35,highpass=f=2000,afade=t=out:d=0.08[b];"
              "[a][b]amix=inputs=2:normalize=0,acompressor=threshold=-16dB:ratio=3,aecho=0.5:0.3:30:0.2", -4),
    # cetak: kotak 1,2 kHz 25 ms seperti printer thermal, disaring
    "cetak": ("aevalsrc='0.4*sgn(sin(2*PI*1200*t))*exp(-60*t)':d=0.03,lowpass=f=5000,highpass=f=600", -10),
    # cap: dentum 70 Hz + ketuk kayu 420 Hz + gema ruang, dikompres
    "cap": ("aevalsrc='0.9*sin(2*PI*(90-35*t)*t)*exp(-7*t)':d=0.5[a];aevalsrc='0.6*sin(2*PI*420*t)*exp(-40*t)':d=0.12[b];"
            "anoisesrc=d=0.04:c=pink:a=0.5,afade=t=out:d=0.04[c];[a][b][c]amix=inputs=3:normalize=0,equalizer=f=80:t=q:w=1:g=4,"
            "acompressor=threshold=-12dB:ratio=5:attack=2:release=80,aecho=0.7:0.45:60|130:0.3|0.18", -1.5),
    # geser: desis pita lebar dengan lowpass, lebih pendek dari sapu
    "geser": ("anoisesrc=d=0.25:c=pink:a=0.5,bandpass=f=1800:w=1500,afade=t=in:d=0.08,afade=t=out:st=0.1:d=0.15,aecho=0.5:0.3:25:0.2", -9),
    # tik: kayu kecil 900 Hz, pitch naik setengah oktaf lewat asetrate
    "tik": ("aevalsrc='0.5*sin(2*PI*900*t)*exp(-50*t)':d=0.08,asetrate=48000*1.41,aresample=48000,highpass=f=300", -8),
    # ketuk: tendang 60 Hz meluncur + klik atas, dikompres
    "ketuk": ("aevalsrc='0.9*sin(2*PI*(110-60*t)*t)*exp(-12*t)':d=0.3[a];sine=f=3000:d=0.008,volume=0.3[b];[a][b]amix=inputs=2:normalize=0,"
              "acompressor=threshold=-14dB:ratio=4,equalizer=f=70:t=q:w=1:g=3", -4),
}


def jalan(arg):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *arg], capture_output=True, text=True)
    if r.returncode:
        raise SystemExit(r.stderr[-2000:])
    return r


def ukur(berkas):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", berkas, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True)
    teks = r.stderr[r.stderr.rfind("Summary:"):]
    i = float(re.search(r"I:\s+(-?[\d.]+) LUFS", teks).group(1))
    tp = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", teks).group(1))
    return i, tp


def main(lagu, video, isyarat, keluar, kerja):
    os.makedirs(kerja, exist_ok=True)
    d = json.load(open(isyarat))
    durasi = d["durasi"]
    # 1. setiap efek dibangkitkan sekali, mono 48 kHz
    for nama, (graf, sasaran) in EFEK.items():
        mentah = os.path.join(kerja, f"{nama}-mentah.wav")
        jalan(["-f", "lavfi", "-i", f"{graf},aformat=sample_rates={SR}:channel_layouts=mono", mentah])
        r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", mentah, "-af", "volumedetect", "-f", "null", "-"], capture_output=True, text=True)
        puncak = float(re.search(r"max_volume: (-?[\d.]+)", r.stderr).group(1))
        jalan(["-i", mentah, "-af", f"volume={sasaran - puncak:.2f}dB", os.path.join(kerja, f"{nama}.wav")])
    # 2. jalur efek: setiap isyarat ditunda ke waktunya lalu dijumlahkan
    cue = [c for c in d["sfx"] if c[0] < durasi - 0.05]
    masuk, graf = [], []
    for j, (t, nama) in enumerate(cue):
        masuk += ["-i", os.path.join(kerja, f"{nama}.wav")]
        graf.append(f"[{j}:a]adelay={int(t * 1000)}:all=1[c{j}]")
    graf.append("".join(f"[c{j}]" for j in range(len(cue))) + f"amix=inputs={len(cue)}:normalize=0:duration=longest,apad=whole_dur={durasi},atrim=0:{durasi},aformat=channel_layouts=stereo[sfx]")
    jalur_efek = os.path.join(kerja, "efek.wav")
    jalan([*masuk, "-filter_complex", ";".join(graf), "-map", "[sfx]", "-ar", str(SR), jalur_efek])
    # 3. musik dipotong di bar, ditekan di bawah efek, dijumlahkan, akhir memudar
    mentah = os.path.join(kerja, "campur-mentah.wav")
    jalan(["-ss", str(MULAI_LAGU), "-t", str(durasi), "-i", lagu, "-i", jalur_efek, "-filter_complex",
           f"[0:a]aresample={SR},aformat=channel_layouts=stereo,afade=t=in:d=0.04,afade=t=out:st={durasi - 1.6:.3f}:d=1.6,volume=-6dB[m];"
           "[1:a]asplit=2[e1][e2];[m][e1]sidechaincompress=threshold=0.05:ratio=3:attack=5:release=150[md];"
           "[md][e2]amix=inputs=2:normalize=0[out]", "-map", "[out]", mentah])
    # 4. loudnorm dua langkah ke -14 LUFS, TP -1,5
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", mentah, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], capture_output=True, text=True)
    m = json.loads(r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1])
    akhir = os.path.join(kerja, "campur.wav")
    jalan(["-i", mentah, "-af", f"loudnorm=I=-14:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
           f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample={SR}", akhir])
    # 5. gabung dengan video bisu, ukur hasil akhir
    jalan(["-i", video, "-i", akhir, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", keluar])
    i, tp = ukur(keluar)
    print(json.dumps({"keluaran": keluar, "isyarat": len(cue), "lufs": i, "true_peak_dbtp": tp, "lulus": abs(i + 14) <= 1 and tp <= -1}))


if __name__ == "__main__":
    main(*sys.argv[1:6])
