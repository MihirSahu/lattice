type LatticeMarkProps = {
  className?: string;
};

export function LatticeMark({ className }: LatticeMarkProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M8 4.75V19.25M16 4.75V19.25M4.75 8H19.25M4.75 16H19.25"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.4"
      />
    </svg>
  );
}
