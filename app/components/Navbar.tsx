import { Link, useLocation } from "react-router";

export function Navbar() {
  const location = useLocation();

  const links = [
    { path: "/talks", label: "Talks" },
    { path: "/teachers", label: "Teachers" },
    { path: "/retreats", label: "Retreats" },
    { path: "/centers", label: "Centers" },
  ];

  return (
    <header className="border-b border-text-primary/10 mb-8 md:mb-12">
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-6 flex justify-between items-center">
        {/* Logo */}
        <Link
          to="/"
          className="group flex items-center gap-3 text-text-primary"
        >
          <div className="w-11 h-11 rounded-full border border-text-primary/20 flex items-center justify-center group-hover:border-text-primary/40 transition-colors">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="2" />
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
            </svg>
          </div>
          <div>
            <div className="text-lg font-serif font-light leading-tight tracking-tight">Dharma Radio</div>
            <div className="text-[0.6rem] text-text-tertiary uppercase tracking-[0.15em] font-light">
              Archive
            </div>
          </div>
        </Link>

        {/* Navigation - Desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => {
            const isActive = location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 text-sm tracking-wide transition-colors ${
                  isActive
                    ? "text-text-primary font-medium"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Navigation - Mobile */}
        <nav className="md:hidden flex items-center gap-1">
          {links.map((link) => {
            const isActive = location.pathname.startsWith(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-3 py-1.5 text-sm tracking-wide transition-colors ${
                  isActive
                    ? "text-text-primary font-medium border-b border-text-primary"
                    : "text-text-tertiary"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
