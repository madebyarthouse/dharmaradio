export function SkyBackground() {
  return (
    <>
      {/* Sky gradient background */}
      <div className="fixed top-0 left-0 w-full h-full z-0 sky-gradient-bg" />

      {/* Subtle overlay */}
      <div className="fixed top-0 left-0 w-full h-full z-[1] bg-overlay" />

      {/* Flying birds with V-shaped wings */}
      <svg
        className="bird bird-1 z-[1]"
        width="24"
        height="16"
        viewBox="0 0 24 16"
        fill="none"
      >
        {/* Left wing */}
        <path
          d="M12 2 L6 8 L4 6 L2 4 L0 6 L4 10 L8 12 L12 8 Z"
          fill="rgba(26, 32, 44, 0.6)"
          stroke="rgba(26, 32, 44, 0.3)"
          strokeWidth="0.5"
        />
        {/* Right wing */}
        <path
          d="M12 2 L18 8 L20 6 L22 4 L24 6 L20 10 L16 12 L12 8 Z"
          fill="rgba(26, 32, 44, 0.6)"
          stroke="rgba(26, 32, 44, 0.3)"
          strokeWidth="0.5"
        />
        {/* Body */}
        <circle cx="12" cy="6" r="1.5" fill="rgba(26, 32, 44, 0.7)" />
      </svg>

      <svg
        className="bird bird-2 z-[1]"
        width="18"
        height="12"
        viewBox="0 0 24 16"
        fill="none"
      >
        <path
          d="M12 2 L6 8 L4 6 L2 4 L0 6 L4 10 L8 12 L12 8 Z"
          fill="rgba(26, 32, 44, 0.5)"
          stroke="rgba(26, 32, 44, 0.25)"
          strokeWidth="0.5"
        />
        <path
          d="M12 2 L18 8 L20 6 L22 4 L24 6 L20 10 L16 12 L12 8 Z"
          fill="rgba(26, 32, 44, 0.5)"
          stroke="rgba(26, 32, 44, 0.25)"
          strokeWidth="0.5"
        />
        <circle cx="12" cy="6" r="1.5" fill="rgba(26, 32, 44, 0.6)" />
      </svg>

      <svg
        className="bird bird-3 z-[1]"
        width="20"
        height="14"
        viewBox="0 0 24 16"
        fill="none"
      >
        <path
          d="M12 2 L6 8 L4 6 L2 4 L0 6 L4 10 L8 12 L12 8 Z"
          fill="rgba(26, 32, 44, 0.55)"
          stroke="rgba(26, 32, 44, 0.28)"
          strokeWidth="0.5"
        />
        <path
          d="M12 2 L18 8 L20 6 L22 4 L24 6 L20 10 L16 12 L12 8 Z"
          fill="rgba(26, 32, 44, 0.55)"
          stroke="rgba(26, 32, 44, 0.28)"
          strokeWidth="0.5"
        />
        <circle cx="12" cy="6" r="1.5" fill="rgba(26, 32, 44, 0.65)" />
      </svg>
    </>
  );
}
