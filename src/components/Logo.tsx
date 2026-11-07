export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <rect width="100" height="100" rx="22" fill="var(--accent)" />
      <rect
        x="30"
        y="20"
        width="44"
        height="58"
        rx="6"
        fill="var(--accent-contrast)"
        opacity=".45"
      />
      <rect x="24" y="26" width="44" height="58" rx="6" fill="var(--accent-contrast)" />
      <rect x="31" y="34" width="30" height="20" rx="3" fill="var(--accent)" />
      <rect x="31" y="60" width="30" height="4" rx="2" fill="var(--accent)" opacity=".5" />
      <rect x="31" y="68" width="20" height="4" rx="2" fill="var(--accent)" opacity=".5" />
    </svg>
  );
}
