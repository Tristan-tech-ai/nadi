import data from "./landmark.json";

// Q-20: perluas fixture ringkas menjadi bentuk hasil detectForVideo (478 titik Face Mesh, hanya x yang dipakai Nadi).
type Ringkas = { wajah: number; hidung: number; pipiA: number; pipiB: number; kedip: number };
export type NamaFixture = "menoleh-kiri" | "menoleh-kanan" | "foto-statis" | "dua-wajah";
export const TITIK_FIXTURE = { hidung: 1, pipiA: 234, pipiB: 454 };

export function hasilFixture(nama: NamaFixture) {
  return (data[nama] as Ringkas[]).map((r) => {
    const muka = Array.from({ length: 478 }, () => ({ x: 0.5 }));
    muka[TITIK_FIXTURE.hidung] = { x: r.hidung };
    muka[TITIK_FIXTURE.pipiA] = { x: r.pipiA };
    muka[TITIK_FIXTURE.pipiB] = { x: r.pipiB };
    const blend = { categories: [{ categoryName: "eyeBlinkLeft", score: r.kedip }, { categoryName: "eyeBlinkRight", score: r.kedip }] };
    return { faceLandmarks: Array.from({ length: r.wajah }, () => muka), faceBlendshapes: Array.from({ length: r.wajah }, () => blend) };
  });
}
