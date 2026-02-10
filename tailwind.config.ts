import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'cp-dark': '#040B4D',
        'cp-blue': '#1F31D8',
        'cp-cyan': '#0693e3',
        'cp-purple': '#9b51e0',
        'cp-gray': '#4C4C51',
        'cp-light': '#EFEFEF',
      },
    },
  },
  plugins: [],
};
export default config;
