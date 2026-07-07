/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Space Grotesk", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      colors: {
        ink: "#111827",
        muted: "#64748b",
        canvas: "#f7faf9",
        line: "#d9e2df",
        teal: {
          50: "#e9fbf7",
          100: "#c8f2e9",
          400: "#14b8a6",
          500: "#0d9488",
          600: "#0f766e",
          700: "#005f59",
          800: "#115e59",
          900: "#134e4a",
          950: "#042f2e",
          DEFAULT: "#0d9488"
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669"
        },
        cobalt: "#2557d6",
        saffron: "#b86b00"
      },
      boxShadow: {
        soft: "0 18px 60px rgba(17, 24, 39, 0.11)"
      }
    }
  },
  plugins: []
};
