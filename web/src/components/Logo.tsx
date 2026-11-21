/** The Cache & Carry mark: a trolley carrying a package. The trolley uses the current text colour. */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 13h8.5l5.2 29.500h31.300" stroke="currentColor" strokeWidth="4.200" />
      <rect x="25" y="14.500" width="25" height="21.500" rx="4" stroke="currentColor" strokeWidth="4.200" />
      <path d="M37.500 20v9.500m-4.700-4.300 4.700 4.700 4.700-4.700" stroke="var(--c-fg)" strokeWidth="3.600" />
      <circle cx="26" cy="52" r="3.300" fill="currentColor" stroke="currentColor" strokeWidth="2.400" />
      <circle cx="46.500" cy="52" r="3.300" fill="currentColor" stroke="currentColor" strokeWidth="2.400" />
    </svg>
  );
}

/** The product name with the accent-coloured ampersand. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      Cache <span className="text-ok">&</span> Carry
    </span>
  );
}
