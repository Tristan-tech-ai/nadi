import { Bingkai } from "./bingkai";

/** Kalender dinding dengan satu hari distabilo (izin dan cuti). */
export function IlustrasiKalender({ className }: { className?: string }) {
  return (
    <Bingkai className={className}>
      <rect x="28" y="22" width="104" height="80" rx="6" fill="var(--kertas-2)" />
      <path d="M28 42h104M52 14v16M108 14v16" />
      <rect x="90" y="68" width="16" height="14" rx="2" fill="var(--kunyit)" />
      <path d="M42 56h8M62 56h8M82 56h8M102 56h8M42 74h8M62 74h8M110 74h4M42 90h8M62 90h8M82 90h8" strokeWidth="3" />
    </Bingkai>
  );
}
