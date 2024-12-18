type SortButtonProps = {
  label: string;
  active: boolean;
  ascending: boolean;
  onClick: () => void;
};

export function SortButton({
  label,
  active,
  ascending,
  onClick,
}: SortButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded ${active ? "bg-green-200" : "bg-green-100"}`}
    >
      {label} {active && (ascending ? "↑" : "↓")}
    </button>
  );
}
