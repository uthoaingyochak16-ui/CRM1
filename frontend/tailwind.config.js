/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#21242A",
        "ink-soft": "#364152",
        muted: "#4B5563",
        faint: "#5B6472",
        border: "#D5DCE3",
        bg: "#F8FAFC",
        bg2: "#EEF2FF",
        accent: "#2563EB",
        "accent-hover": "#1D4ED8",
        "accent-soft": "#DBEAFE",
        success: "#16A34A",
        "success-soft": "#ECFDF3",
        danger: "#DC2626",
        "danger-soft": "#FEF2F2",
        warning: "#B45309",
        "warning-soft": "#FFFBEB",
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        sans: ["'DM Sans'", "'Noto Sans Bengali'", "sans-serif"],
      },
      borderRadius: {
        xl: "20px",
        "2xl": "24px",
      },
    },
  },
  plugins: [],
};
