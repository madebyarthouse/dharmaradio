/** Optically centred play / pause glyphs; lucide's play sits visually left. */
export function PlayGlyph({ playing, size = 16 }: { playing: boolean; size?: number }) {
  return playing ? (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <rect x="3.5" y="2.5" width="3" height="11" rx="1" />
      <rect x="9.5" y="2.5" width="3" height="11" rx="1" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden fill="currentColor">
      <path d="M5 3.05v9.9a1 1 0 0 0 1.52.85l7.9-4.95a1 1 0 0 0 0-1.7l-7.9-4.95A1 1 0 0 0 5 3.05Z" />
    </svg>
  );
}
