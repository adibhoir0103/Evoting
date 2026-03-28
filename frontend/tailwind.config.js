/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#162a5c', // Official Gov Navy Blue
                    100: '#e0f2fe',
                    800: '#1e3a8a',
                    900: '#172554',
                },
                accent: {
                    saffron: '#FF9933', // India Saffron
                    green: '#138808',   // India Green
                    red: '#D0242B',     // National Red
                },
                gov: {
                    bg: '#f8fafc',
                    card: '#FFFFFF',
                    text: '#111827',
                    border: '#e2e8f0',
                }
            },
            fontFamily: {
                sans: ['Inter', 'Public Sans', 'sans-serif'],
                serif: ['Merriweather', 'serif'],
            },
            boxShadow: {
                'gov': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                'gov-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            }
        },
    },
    plugins: [],
}
