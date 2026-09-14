import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: '#0d2d6b',
          'blue-light': '#1a4fbe',
          orange: '#e8601a',
          'orange-light': '#f07840',
        },
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #0d2d6b 0%, #1a4fbe 100%)',
      },
    },
  },
  plugins: [],
}

export default config
