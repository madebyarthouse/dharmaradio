import { Link, useLocation } from "@remix-run/react";
import { Radio } from "lucide-react";

export function Navbar() {
  const location = useLocation();
  const links = [
    { path: "/talks", label: "Talks" },
    { path: "/teachers", label: "Teachers" },
    { path: "/retreats", label: "Retreats" },
    { path: "/centers", label: "Centers" },
  ] as const;

  return (
    <nav className="">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <Radio className="text-sage-600" size={24} />
            <span className="font-serif text-xl text-sage-900">
              Dharma Radio
            </span>
          </Link>

          <div className="flex space-x-8">
            {links.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === link.path
                    ? "text-sage-900 border-b-2 border-sage-600"
                    : "text-sage-600 hover:text-sage-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
