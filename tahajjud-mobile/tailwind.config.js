/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Content paths are relative to the project root.
    content: ["./App.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                background: "#020617", // slate-950
                foreground: "#f8fafc", // slate-50
                primary: "#f8fafc",
                secondary: "#334155",
                accent: "#334155",
                muted: "#334155",
                "muted-foreground": "#94a3b8",
            }
        },
    },
    plugins: [],
}
