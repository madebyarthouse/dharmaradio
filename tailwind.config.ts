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
        brand: "#527555",
        brandLight: "#B2C5BA",
        brandDark: "#395139",
        text: "#222",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
          "Apple Color Emoji",
          "Segoe UI Emoji",
          "Segoe UI Symbol",
          "Noto Color Emoji",
        ],
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("@tailwindcss/forms")],
} satisfies Config;
