/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  presets: [require("nativewind/preset")],
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['SpaceGrotesk_700Bold', 'Space Grotesk', 'sans-serif'],
        space: ['SpaceGrotesk_600SemiBold', 'Space Grotesk', 'sans-serif'],
        sans: ['DMSans_400Regular', 'DM Sans', 'sans-serif'],
        dm: ['DMSans_400Regular', 'DM Sans', 'sans-serif'],
      },
      colors: {
        brand: {
          blue: '#2B6BFF',
          dark: '#000000',
          card: '#090A0F',
          border: '#151821',
          emergency: '#FF4D4D',
        },
      },
    },
  },
  plugins: [],
};
