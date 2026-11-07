export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden className={className}>
      <rect width="100" height="100" rx="22" fill="#2F4BD8" />
      <rect x="33" y="17" width="44" height="58" rx="6" fill="#FFFFFF" opacity=".4" />
      <rect x="24" y="24" width="44" height="58" rx="6" fill="#FFFFFF" />
      <rect x="31" y="31" width="30" height="21" rx="3" fill="#2F4BD8" opacity=".9" />
      <path
        d="M33 49l8-8 6 6 5-4 7 6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="31" y="59" width="30" height="4.5" rx="2.25" fill="#2F4BD8" opacity=".55" />
      <rect x="31" y="67" width="20" height="4.5" rx="2.25" fill="#2F4BD8" opacity=".55" />
    </svg>
  );
}
