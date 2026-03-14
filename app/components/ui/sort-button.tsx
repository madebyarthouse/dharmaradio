import { Button } from "./button";

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
    <Button
      onClick={onClick}
      variant={active ? "pressed" : "ghost"}
    >
      {label} {active && (ascending ? "↑" : "↓")}
    </Button>
  );
}
