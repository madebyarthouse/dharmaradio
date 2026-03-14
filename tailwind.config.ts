/* eslint-disable @typescript-eslint/no-require-imports */
import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

export default {
  content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx}"],
  theme: {
    screens: {
      xxs: "350px",
      xs: "420px",
      ...defaultTheme.screens,
      "3xl": "1768px",
      notouch: { raw: "(hover: hover)" },
    },
    extend: {
      colors: {
        // New sky-themed color system
        sky: {
          from: "#b3d1ff",
          to: "#ffffff",
          bg: "#f0f7ff",
        },
        text: {
          primary: "#1A202C",
          secondary: "rgba(26, 32, 44, 0.7)",
          tertiary: "rgba(26, 32, 44, 0.4)",
        },
        accent: "#2D3748",
        overlay: "rgba(255, 255, 255, 0.1)",
        player: {
          bg: "rgba(255, 255, 255, 0.85)",
        },
        // Keep old colors for backward compatibility
        brand: "#608063",
        brandLight: "#B2C5BA",
        brandDark: "#395139",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        display: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif",
        ],
      },
      backdropBlur: {
        glass: "20px",
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("@tailwindcss/forms")],
} satisfies Config;
