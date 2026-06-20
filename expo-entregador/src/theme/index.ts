export const C = {
  brand:       "#f97316",
  brandDark:   "#ea580c",
  brandLight:  "#fff7ed",
  brandBorder: "#fed7aa",

  green:       "#16a34a",
  greenLight:  "#dcfce7",
  greenBorder: "#bbf7d0",

  amber:       "#d97706",
  amberLight:  "#fef3c7",

  red:         "#dc2626",
  redLight:    "#fee2e2",
  redBorder:   "#fecaca",

  blue:        "#2563eb",
  blueLight:   "#eff6ff",

  purple:      "#7c3aed",
  purpleLight: "#ede9fe",

  text:        "#111827",
  textMid:     "#374151",
  textMuted:   "#6b7280",
  textLight:   "#9ca3af",

  bg:          "#f5f5f5",
  card:        "#ffffff",
  border:      "#e5e7eb",

  white:       "#ffffff",
} as const;

export const R = {
  sm:  10,
  md:  14,
  lg:  18,
  xl:  24,
} as const;

export const shadow = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
} as const;
