/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",

    // Or if using `src` directory:
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			heading: ['var(--font-heading)', 'ui-serif', 'Georgia', 'serif']
  		},
  		boxShadow: {
  			soft: '0 1px 2px -1px hsl(var(--foreground) / 0.06), 0 4px 16px -4px hsl(var(--foreground) / 0.08)',
  			'soft-md': '0 2px 4px -2px hsl(var(--foreground) / 0.08), 0 12px 28px -8px hsl(var(--foreground) / 0.14)',
  			'soft-lg': '0 4px 8px -4px hsl(var(--foreground) / 0.10), 0 24px 48px -12px hsl(var(--foreground) / 0.18)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			brand: {
  				'50': 'hsl(var(--brand-50))',
  				'100': 'hsl(var(--brand-100))',
  				'200': 'hsl(var(--brand-200))',
  				'300': 'hsl(var(--brand-300))',
  				'400': 'hsl(var(--brand-400))',
  				'500': 'hsl(var(--brand-500))',
  				'600': 'hsl(var(--brand-600))',
  				'700': 'hsl(var(--brand-700))',
  				'800': 'hsl(var(--brand-800))',
  				'900': 'hsl(var(--brand-900))',
  				'950': 'hsl(var(--brand-950))'
  			},
  			accent2: {
  				'50': 'hsl(var(--accent2-50))',
  				'100': 'hsl(var(--accent2-100))',
  				'200': 'hsl(var(--accent2-200))',
  				'300': 'hsl(var(--accent2-300))',
  				'400': 'hsl(var(--accent2-400))',
  				'500': 'hsl(var(--accent2-500))',
  				'600': 'hsl(var(--accent2-600))',
  				'700': 'hsl(var(--accent2-700))',
  				'800': 'hsl(var(--accent2-800))',
  				'900': 'hsl(var(--accent2-900))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
