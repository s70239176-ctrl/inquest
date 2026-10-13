/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm editorial paper (light surfaces)
        paper: { DEFAULT: "#F7F5F0", 2: "#F2EFE9", card: "#FAF9F6" },
        // Dark contrast containers
        editorial: { DEFAULT: "#121316", panel: "#1A1C20" },
        // Primary accent: amber gold
        accent: { DEFAULT: "#D97706", hover: "#B45309", soft: "rgba(217, 119, 6, 0.1)" },
        // Text
        ink: { DEFAULT: "#18181B", soft: "#71717A", inverse: "#FAFAFA", "inverse-soft": "#A1A1AA" },
        // Borders
        line: { DEFAULT: "#E4E4E7", dark: "#27272A" },
      },
      fontFamily: {
        serif: ['"Playfair Display"', "Georgia", "Cambria", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      maxWidth: { page: "72rem" },
      boxShadow: { card: "0 1px 0 rgba(24,24,27,0.04), 0 8px 24px -12px rgba(24,24,27,0.12)" },
    },
  },
  plugins: [],
};
