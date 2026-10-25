import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        paper: "rgb(var(--paper-rgb) / <alpha-value>)",
        signal: "rgb(var(--signal-rgb) / <alpha-value>)",
        deep: "rgb(var(--deep-rgb) / <alpha-value>)",
        sage: "rgb(var(--sage-rgb) / <alpha-value>)",
        amber: "rgb(var(--amber-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
      },
      fontFamily: {
        ui: ["var(--font-space-grotesk)", "sans-serif"],
        "mono-data": ["var(--font-ibm-plex-mono)", "monospace"],
      },
      spacing: {
        "space-1": "var(--space-1)",
        "space-2": "var(--space-2)",
        "space-3": "var(--space-3)",
        "space-4": "var(--space-4)",
        "space-6": "var(--space-6)",
        "space-8": "var(--space-8)",
        "space-12": "var(--space-12)",
        "space-16": "var(--space-16)",
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
      },
      fontSize: {
        display: [
          "var(--type-display)",
          { lineHeight: "var(--leading-display)" },
        ],
        h1: ["var(--type-h1)", { lineHeight: "var(--leading-h1)" }],
        h2: ["var(--type-h2)", { lineHeight: "var(--leading-h2)" }],
        body: ["var(--type-body)", { lineHeight: "var(--leading-body)" }],
        small: ["var(--type-small)", { lineHeight: "var(--leading-small)" }],
        "mono-data": [
          "var(--type-mono-data)",
          { lineHeight: "var(--leading-mono-data)" },
        ],
      },
    },
  },
  plugins: [],
} satisfies Config;
