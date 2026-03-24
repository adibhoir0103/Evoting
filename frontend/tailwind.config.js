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
                    DEFAULT: '#000080', // Official Navy Blue
                    100: '#E6E6F2',
                    800: '#000066',
                    900: '#000033',
                },
                accent: {
                    saffron: '#FF9933', // India Saffron
                    green: '#138808',   // India Green
                },
                gov: {
                    bg: '#F5F7FA',
                    card: '#FFFFFF',
                    text: '#333333',
                    border: '#E2E8F0',
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
