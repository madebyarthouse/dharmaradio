import { Link, useLocation } from "@remix-run/react";
import { Radio, Menu, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const links = [
    { path: "/talks", label: "Talks" },
    { path: "/teachers", label: "Teachers" },
    { path: "/retreats", label: "Retreats" },
    { path: "/centers", label: "Centers" },
  ] as const;

  return (
    <nav>
      <div className="container mx-auto px-4 py-5">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <img
              src="/dharmaradio-logo-v0.png"
              alt=""
              className="w-14 aspect-square h-14"
            />
            <span className="font-serif text-3xl text-green-900">
              Dharma Radio
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-xl font-medium text-green-900 transition-all ${
                  location.pathname === link.path
                    ? "underline"
                    : "hover:opacity-80"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden text-green-600 hover:text-green-900 transition-colors"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden absolute top-16 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-green-200 shadow-lg"
          >
            <div className="container mx-auto px-4 py-4">
              <div className="flex flex-col space-y-4">
                {links.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={`text-sm font-medium p-2 rounded-lg transition-colors ${
                      location.pathname === link.path
                        ? "bg-green-100 text-green-900"
                        : "text-green-600 hover:bg-green-50 hover:text-green-900"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

export default Navbar;
