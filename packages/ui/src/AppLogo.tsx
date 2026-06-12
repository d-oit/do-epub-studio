export interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogo({ size = 48, className = '' }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="do EPUB Studio logo"
      className={className}
    >
      {/* Book shape */}
      <rect x="8" y="6" width="24" height="36" rx="3" fill="currentColor" opacity="0.15" />
      <rect x="10" y="8" width="24" height="36" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
      {/* Spine line */}
      <line x1="14" y1="8" x2="14" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      {/* Page lines */}
      <line x1="18" y1="16" x2="30" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="18" y1="22" x2="28" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      <line x1="18" y1="28" x2="26" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
      {/* EPUB mark */}
      <text x="18" y="38" fill="currentColor" fontSize="6" fontWeight="700" fontFamily="monospace" opacity="0.7">EPUB</text>
    </svg>
  );
}
