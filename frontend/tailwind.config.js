/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        forest: {
          50: "#f2f7f3",
          100: "#e0ede2",
          200: "#c1dbc6",
          300: "#96c19f",
          400: "#67a075",
          500: "#458157",
          600: "#336744",
          700: "#2a5238",
          800: "#24422f",
          900: "#1e3728",
        },
        sage: {
          50: "#f5f7f3",
          100: "#e7ede2",
          200: "#d0ddc6",
          300: "#aec2a0",
          400: "#8aa878",
          500: "#6d8c5c",
          600: "#557046",
          700: "#43593a",
          800: "#384830",
          900: "#2f3c29",
        },
        beige: {
          50: "#fdfbf6",
          100: "#f9f4e8",
          200: "#f2e9d3",
          300: "#e8d9b3",
          400: "#dac68c",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 10px -2px rgba(36, 66, 47, 0.08), 0 1px 3px -1px rgba(36,66,47,0.06)",
        cardHover: "0 8px 24px -4px rgba(36, 66, 47, 0.14)",
      },
    },
  },
  plugins: [],
}
