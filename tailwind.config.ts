/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,html}", // Correctly points into the src directory
    "./src/index.html" // Specifically include index.html if classes are there
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}