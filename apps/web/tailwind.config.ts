import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: "hsl(var(--primary))",
        muted: "hsl(var(--muted))",
        accent: "hsl(var(--accent))",
        brand: {
          black: "#0a0a0a",
          orange: "#ff6b00",
          amber: "#ff9500",
          yellow: "#ffd60a",
          gold: "#fbbf24"
        }
      },
      animation: {
        float: "float 7s ease-in-out infinite",
        "float-delayed": "float 9s ease-in-out 1.5s infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        "fade-up": "fade-up 0.7s ease-out both",
        "fade-up-delay-1": "fade-up 0.7s ease-out 0.15s both",
        "fade-up-delay-2": "fade-up 0.7s ease-out 0.3s both",
        "fade-up-delay-3": "fade-up 0.7s ease-out 0.45s both",
        shimmer: "shimmer 2.5s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0) scale(1)" },
          "50%": { transform: "translateY(-18px) scale(1.03)" }
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" }
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(28px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.5", transform: "scale(1)" },
          "50%": { opacity: "0.85", transform: "scale(1.05)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
