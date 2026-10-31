import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171a16",
        lime: "#d7ff46",
        paper: "#f2f2e9",
        muted: "#a7aca2",
        line: "#373b35",
        panel: "#20241f",
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
        display: ["Impact", "Arial Narrow", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
