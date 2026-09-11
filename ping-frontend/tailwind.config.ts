import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ping: {
          dark: "#1C2E36",
          orange: "#D8684C",
          "orange-light": "#E5775B",
          teal: "#1C4E44",
          "teal-light": "#2A9D8F",
          cream: "#FAF6F1",
          "cream-dark": "#ECE5DB",
          sand: "#E3DDD3",
          sage: "#E3EFE9",
          "sage-border": "#C9DCD2",
          text: "#1C2E36",
          "text-light": "#788890",
          green: "#22C55E",

          // Dark mode colors (Pic 3 night mode)
          "night-bg": "#0C171A",
          "night-surface": "#14252A",
          "night-card": "#182C32",
          "night-card-active": "#1E373E",
          "night-border": "#203940",
          "night-sage": "#143330",
          "night-text": "#E2ECE9",
          "night-text-light": "#879FA5",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;