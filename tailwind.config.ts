import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          '"Segoe UI"',
          "Roboto",
          "Arial",
          "sans-serif"
        ]
      },
      colors: {
        paper: "#fbf9f1",
        moss: {
          700: "#3a6b52",
          800: "#2c5240",
          900: "#20392b",
          950: "#1a2b21"
        },
        mint: {
          50: "#f0fbea",
          100: "#e2f4da"
        },
        leaf: {
          50: "#f1f9ec",
          100: "#dff2d4",
          500: "#4f9d4e",
          700: "#2f6e3c",
          900: "#1d4327"
        },
        soil: {
          100: "#f6e8d6",
          500: "#a97c4f"
        },
        sky: {
          100: "#deeff6",
          500: "#3f8fac"
        }
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      boxShadow: {
        soft: "0 18px 50px rgba(40, 70, 45, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
