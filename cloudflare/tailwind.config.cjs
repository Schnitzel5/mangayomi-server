/** @type {import('tailwindcss').Config} */
export default {
    content: ["./src/**/*.{ts,html,css}", "./public/index.html"],
    theme: {
        extend: {
            fontFamily: {
                sans: [
                    "Inter",
                    "ui-sans-serif",
                    "system-ui",
                    "-apple-system",
                    "Segoe UI",
                    "Roboto",
                    "sans-serif",
                ],
                mono: [
                    "ui-monospace",
                    "SFMono-Regular",
                    "Menlo",
                    "Monaco",
                    "Consolas",
                    "monospace",
                ],
            },
        },
    },
    plugins: [require("daisyui")],
    daisyui: {
        themes: ["night", "dark"],
        darkTheme: "dark",
        base: true,
        styled: true,
        utils: true,
        logs: false,
    },
};
