/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      text: "var(--color-text)",
      brand: "var(--color-brand)",
      "brand-light": "var(--color-brand-light)",
      "brand-dark": "var(--color-brand-dark)",
      white: "var(--color-white)",
    },
    fontFamily: {
      body: ["var(--font-inter)", "Inter", "Helvetica", "Arial", "sans-serif"],
      heading: [
        "var(--font-playfair-display)",
        "Playfair Display",
        "Georgia",
        "serif",
      ],
    },
    extend: {},
  },
  plugins: [require("@tailwindcss/typography")],
};
