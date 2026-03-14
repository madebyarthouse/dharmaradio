import { Search } from "lucide-react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: SearchInputProps) {
  return (
    <div className="relative w-full md:w-auto">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-12 pr-4 py-3 w-full md:w-80 rounded-full neumorphic-card-pressed bg-transparent border-none outline-none text-text-primary placeholder:text-text-tertiary focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-all"
      />
      <Search
        className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        size={18}
      />
    </div>
  );
}
