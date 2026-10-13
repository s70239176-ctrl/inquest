/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Editorial surfaces (marketing homepage)
        ivory: { DEFAULT: "#F3F0E7", 2: "#E9E4D8", ink: "#171713", muted: "#66645D", line: "#D4CEC1" },
        // Application surfaces (the product)
        app: { bg: "#090A09", surface: "#111210", raised: "#171815", text: "#F1F0EA", soft: "#A3A39A", line: "#292A25" },
        // Brand
        // "deep" is the same gold deepened for AA contrast on ivory (the standard gold is ~2:1 there)
        gold: { DEFAULT: "#D6A844", bright: "#F0C96C", hover: "#E3B955", deep: "#8A6210" },
        // Semantic status
        ok: "#6FA37B",
        pending: "#E3A02E",
        adverse: "#C0675A",
        neutral: "#8D9097",
      },
      fontFamily: {
        serif: ['"Instrument Serif"', "Georgia", "Cambria", "serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", '"Segoe UI"', "Roboto", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      maxWidth: { page: "74rem" },
      keyframes: { rise: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "none" } } },
      animation: { rise: "rise 220ms ease-out both" },
    },
  },
  plugins: [],
};
