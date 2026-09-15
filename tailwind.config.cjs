/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Haji Abdul Manan & Abdul Hanan — Atta Dealer Pishin brand palette
        brand: {
          green: {
            50: "#eef6ee",
            100: "#d3e8d4",
            200: "#a7d1aa",
            300: "#79b77e",
            400: "#4f9c58",
            500: "#2f7a3a",
            600: "#1f6b2a", // primary agricultural green
            700: "#175322",
            800: "#123f1a",
            900: "#0d2e13"
          },
          navy: {
            600: "#1c2b2a",
            700: "#16211f",
            800: "#101817",
            900: "#0b1110" // dark navy/green text
          },
          wheat: {
            100: "#fdf6e0",
            200: "#faecb8",
            300: "#f4dd88",
            400: "#eec85a", // wheat/golden accent
            500: "#e0af35",
            600: "#c2911f"
          },
          gold: "#d98e2c" // orange/gold agricultural accent
        }
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "system-ui", "sans-serif"],
        urdu: ["Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "serif"]
      },
      borderRadius: {
        card: "10px"
      }
    }
  },
  plugins: []
};
