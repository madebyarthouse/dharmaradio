import * as RadixTabs from "@radix-ui/react-tabs";
import clsx from "clsx";

type TabsProps = {
  defaultValue: string;
  tabs: {
    value: string;
    label: string;
    count?: number;
    content: React.ReactNode;
  }[];
};

export function Tabs({ defaultValue, tabs }: TabsProps) {
  return (
    <RadixTabs.Root defaultValue={defaultValue} className="w-full">
      <RadixTabs.List className="flex gap-2 border-b border-green-200 mb-8 justify-center">
        {tabs.map(({ value, label, count }) => (
          <RadixTabs.Trigger
            key={value}
            value={value}
            className={clsx(
              "px-4 py-2 text-green-800 hover:text-green-900 transition-colors",
              "data-[state=active]:text-green-900 data-[state=active]:border-b-2 data-[state=active]:border-green-900",
              "focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-t-lg",
            )}
          >
            {label}
            {count !== undefined && (
              <span className="ml-2 text-sm text-green-600">({count})</span>
            )}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>

      {tabs.map(({ value, content }) => (
        <RadixTabs.Content key={value} value={value}>
          {content}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
