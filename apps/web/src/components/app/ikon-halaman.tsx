// U-12 ikon per halaman: setiap tujuan punya ikon sendiri yang mengenali tujuannya (Material 3 navigation drawer; ANTI-SLOP S55).
// Ikon ruang hanya dipakai di judul ruang. Tes src/components/app/ikon-halaman.test.ts menolak halaman tanpa ikon dan ikon ganda.
import {
  AddressBookIcon, AirplaneTiltIcon, AnchorIcon, ArrowsClockwiseIcon, ArrowsLeftRightIcon, BankIcon, BookOpenTextIcon, BriefcaseIcon, BuildingsIcon,
  CalculatorIcon, CalendarCheckIcon, CalendarIcon, CalendarXIcon, CashRegisterIcon, ChartLineUpIcon, ChartPieSliceIcon, ChatCircleTextIcon,
  ClipboardTextIcon, CoinsIcon, CubeIcon, EnvelopeSimpleIcon, EyeIcon, FactoryIcon, FileTextIcon, FlowArrowIcon, GearSixIcon, GiftIcon,
  GraduationCapIcon, HandbagIcon, HandCoinsIcon, HandshakeIcon, HeadsetIcon, IdentificationCardIcon, KanbanIcon, LightbulbIcon, LightningIcon,
  ListChecksIcon, LockKeyIcon, MapTrifoldIcon, MegaphoneIcon, MoneyIcon, PackageIcon, PaperPlaneRightIcon, PaperPlaneTiltIcon, ReceiptIcon,
  ScalesIcon, ShieldCheckIcon, ShoppingCartIcon, SignatureIcon, SparkleIcon, StampIcon, StorefrontIcon, StudentIcon, SunHorizonIcon, TargetIcon,
  ToolboxIcon, TrayIcon, UserListIcon, UserPlusIcon, UsersThreeIcon, VideoCameraIcon, WalletIcon, WrenchIcon, type IconProps,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";

export type Ikon = ComponentType<IconProps>;

export const IKON_RUANG: Record<string, Ikon> = {
  "hari-ini": SunHorizonIcon, uang: WalletIcon, jual: StorefrontIcon, barang: PackageIcon, orang: UsersThreeIcon,
  tempat: VideoCameraIcon, dokumen: FileTextIcon, otomasi: LightningIcon, pengaturan: GearSixIcon,
};

export const IKON_HALAMAN: Record<string, Ikon> = {
  "/app": TrayIcon, "/app/lempar": PaperPlaneTiltIcon, "/app/tanya": ChatCircleTextIcon, "/app/wawasan": ChartLineUpIcon,
  "/app/invoice": ReceiptIcon, "/app/kas": BankIcon, "/app/beli": ShoppingCartIcon, "/app/klaim": HandCoinsIcon, "/app/buku": BookOpenTextIcon,
  "/app/buku/lanjut": ChartPieSliceIcon, "/app/buku/pembiayaan": BriefcaseIcon, "/app/pajak": ScalesIcon, "/app/pajak/faktur": StampIcon,
  "/app/aset": ToolboxIcon, "/app/akuntan": CalculatorIcon,
  "/app/kasir": CashRegisterIcon, "/app/jual": HandbagIcon, "/app/pelanggan": AddressBookIcon, "/app/layanan": HeadsetIcon,
  "/app/janji-temu": CalendarCheckIcon, "/app/servis": WrenchIcon, "/app/proyek": KanbanIcon,
  "/app/barang": CubeIcon, "/app/produksi": FactoryIcon, "/app/impor": AnchorIcon, "/app/ekspor": AirplaneTiltIcon,
  "/app/orang": UserListIcon, "/app/orang/kerja": IdentificationCardIcon, "/app/kerja": ClipboardTextIcon, "/app/jadwal": CalendarIcon,
  "/app/izin": CalendarXIcon, "/app/gaji": MoneyIcon, "/app/gaji/kasbon": CoinsIcon, "/app/gaji/thr": GiftIcon, "/app/rekrutmen": UserPlusIcon,
  "/app/magang": StudentIcon, "/app/kinerja": TargetIcon, "/app/kursus": GraduationCapIcon, "/app/pengumuman": MegaphoneIcon,
  "/app/survei": ListChecksIcon, "/app/serah-terima": ArrowsLeftRightIcon, "/app/ilmu": LightbulbIcon,
  "/app/mata": EyeIcon, "/app/peta-usaha": MapTrifoldIcon,
  "/app/surat": EnvelopeSimpleIcon, "/app/surat-keluar": PaperPlaneRightIcon, "/app/tanda-tangan": SignatureIcon, "/app/kepatuhan": ShieldCheckIcon,
  "/app/alur": FlowArrowIcon, "/app/siapkan": SparkleIcon, "/app/pindah": ArrowsClockwiseIcon, "/app/mitra": HandshakeIcon,
  "/app/perusahaan": BuildingsIcon, "/app/akun/keamanan": LockKeyIcon,
};
