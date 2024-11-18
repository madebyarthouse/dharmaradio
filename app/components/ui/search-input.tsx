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
    <div className="relative ">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-4 py-2 w-full rounded-lg bg-white/60 backdrop-blur border border-sage-200 focus:border-sage-400 focus:ring focus:ring-sage-200 focus:ring-opacity-50 transition-all"
      />
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400"
        size={18}
      />
    </div>
  );
}
