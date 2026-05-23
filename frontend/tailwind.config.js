/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        muted: "#64748b",
        canvas: "#f7faf9",
        line: "#d9e2df",
        teal: {
          50: "#e9fbf7",
          100: "#c8f2e9",
          500: "#007c74",
          700: "#005f59",
          DEFAULT: "#007c74"
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
