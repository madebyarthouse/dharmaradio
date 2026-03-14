import { Link, useLocation } from "react-router";
import { Radio } from "lucide-react";

export function Navbar() {
  const location = useLocation();

  const links = [
    { path: "/talks", label: "Talks" },
    { path: "/teachers", label: "Teachers" },
    { path: "/retreats", label: "Retreats" },
    { path: "/centers", label: "Centers" },
  ];

  return (
    <header className="flex justify-between items-center mb-8 pb-6">
      {/* Logo */}
      <Link
        to="/"
        className="flex items-center gap-3 text-text-primary hover:opacity-80 transition-opacity"
      >
        <div className="neumorphic-button rounded-full w-12 h-12 flex items-center justify-center">
          <Radio size={20} className="text-blue-500" />
        </div>
        <div>
          <div className="text-lg font-semibold leading-tight">Dharma Radio</div>
          <div className="text-[0.7rem] text-text-secondary uppercase tracking-wider">
            Archive
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="hidden md:flex items-center gap-2">
        {links.map((link) => {
          const isActive = location.pathname.startsWith(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? "neumorphic-card-pressed text-text-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/40"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile Menu - Simple for now */}
      <div className="md:hidden flex items-center gap-2">
        {links.map((link) => {
          const isActive = location.pathname.startsWith(link.path);
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                isActive
                  ? "neumorphic-card-pressed text-text-primary"
                  : "text-text-secondary"
              }`}
            >
              {link.label.charAt(0)}
            </Link>
          );
        })}
      </div>
    </header>
  );
}

export default Navbar;
