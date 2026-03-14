import * as React from "react";
import { cn } from "~/lib/cn";

export interface SliderProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  orientation?: "horizontal" | "vertical";
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, orientation = "horizontal", ...props }, ref) => {
    return (
      <input
        type="range"
        className={cn(
          "appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          orientation === "horizontal"
            ? "h-1 w-full bg-gray-300 rounded-lg"
            : "w-1 h-full bg-gray-300 rounded-lg [writing-mode:vertical-lr] [direction:rtl]",
          "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110",
          "[&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:border-none [&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
