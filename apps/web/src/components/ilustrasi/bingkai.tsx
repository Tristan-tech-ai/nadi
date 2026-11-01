import type { ReactNode } from "react";

// Bingkai bersama ilustrasi D-03: garis tinta (currentColor = token tinta di sekitarnya), tanpa gradien, dekoratif (aria-hidden).
export function Bingkai({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 160 120" width={160} height={120} aria-hidden="true" focusable="false" fill="none" stroke="currentColor"
      strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className={`h-auto w-32 text-tinta ${className}`}>
      {children}
    </svg>
  );
}
