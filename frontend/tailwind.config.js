/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                /* ─── Primary Palette (Government Navy Blue) ─── */
                primary: {
                    DEFAULT: '#1e3a8a', // Deep navy — professional, trustworthy, gov feel
                    50:  '#eff6ff',
                    100: '#dbeafe',     // Light tint for subtle backgrounds / highlights
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',     // Brighter blue — use for links, info accents
                    700: '#1d4ed8',     // Hover state for primary buttons
                    800: '#1e40af',
                    900: '#1e3a8a',     // Same as DEFAULT — deep navy
                },

                /* ─── Accent (Decorative ONLY — tricolor stripe) ─── */
                /* These MUST NOT be used as functional UI colors (buttons, badges)
                   to maintain political neutrality (GIGW / ECI guideline) */
                accent: {
                    saffron: '#FF9933', // India tricolor — decorative gradient only
                    green:   '#138808', // India tricolor — decorative gradient only
                },

                /* ─── Functional Palette (State indicators) ─── */
                functional: {
                    success:       '#16a34a', // Green-600 — verified, completed
                    'success-hover': '#15803d',
                    error:         '#dc2626', // Red-600 — errors, destructive actions
                    'error-hover': '#b91c1c',
                    warning:       '#d97706', // Amber-600 — non-critical warnings
                    info:          '#0ea5e9', // Sky-500 — informational (distinct from primary)
                },

                /* ─── Neutral Palette (Layout workhorses) ─── */
                gov: {
                    bg:     '#ffffff',   // Page background (light)
                    card:   '#ffffff',   // Card surfaces (light)
                    text:   '#0f172a',   // Primary text (slate-900 — near-black, not pure black)
                    'text-secondary': '#64748b', // Secondary text (slate-500)
                    border: '#e2e8f0',   // Borders & dividers (slate-200)
                    surface: '#f1f5f9',  // Elevated surfaces, sidebars (slate-100)
                },

                /* ─── Chart/Visualization Palette (CVD-accessible) ─── */
                chart: {
                    blue:   '#2563eb',
                    violet: '#8b5cf6',
                    pink:   '#ec4899',
                    amber:  '#f59e0b',
                    emerald:'#10b981',
                    cyan:   '#06b6d4',
                },
            },
            fontFamily: {
                sans: ['Inter', 'Public Sans', 'sans-serif'],
                serif: ['Merriweather', 'serif'],
            },
            boxShadow: {
                'gov': '0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)',
                'gov-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
                'gov-dark': '0 1px 3px rgba(0, 0, 0, 0.3), 0 1px 2px rgba(0, 0, 0, 0.2)',
            }
        },
    },
    plugins: [],
}
