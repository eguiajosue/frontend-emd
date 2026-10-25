/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",

    // Or if using `src` directory:
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    // Clases de color por estado viven en el paquete compartido (statusColors.ts).
    "../../packages/business/src/**/*.{ts,tsx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			sans: ['var(--font-body)', 'ui-sans-serif', 'system-ui', 'sans-serif']
  		},
  		boxShadow: {
  			'soft-xs': '0 1px 2px 0 hsl(var(--shadow-color) / 0.05)',
  			soft: '0 1px 2px -1px hsl(var(--shadow-color) / 0.06), 0 2px 10px -4px hsl(var(--shadow-color) / 0.08)',
  			'soft-md': '0 2px 4px -2px hsl(var(--shadow-color) / 0.08), 0 12px 28px -8px hsl(var(--shadow-color) / 0.16)',
  			'soft-lg': '0 4px 8px -4px hsl(var(--shadow-color) / 0.10), 0 24px 48px -12px hsl(var(--shadow-color) / 0.22)',
  			'glow-magenta': '0 6px 20px -6px hsl(var(--magenta) / 0.55)',
  			'glow-primary': '0 6px 18px -8px hsl(var(--primary) / 0.5)'
  		},
  		transitionDuration: {
  			fast: '150ms',
  			base: '200ms',
  			slow: '250ms'
  		},
  		transitionTimingFunction: {
  			'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
  			'in-out-soft': 'cubic-bezier(0.4, 0, 0.2, 1)'
  		},
  		backgroundImage: {
  			'brand-gradient': 'var(--gradient-brand)',
  			'accent-gradient': 'var(--gradient-accent)',
  			'spectrum-gradient': 'var(--gradient-spectrum)',
  			'hero-gradient': 'var(--gradient-hero)'
  		},
  		borderRadius: {
  			'2xl': 'calc(var(--radius) + 4px)',
  			xl: 'calc(var(--radius) + 0px)',
  			lg: 'calc(var(--radius) - 4px)',
  			md: 'calc(var(--radius) - 6px)',
  			sm: 'calc(var(--radius) - 8px)'
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
  			ink: {
  				DEFAULT: 'hsl(var(--ink))',
  				foreground: 'hsl(var(--ink-foreground))'
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
  			navy: {
  				DEFAULT: 'hsl(var(--navy-800))',
  				'50': 'hsl(var(--navy-50))',
  				'100': 'hsl(var(--navy-100))',
  				'200': 'hsl(var(--navy-200))',
  				'300': 'hsl(var(--navy-300))',
  				'400': 'hsl(var(--navy-400))',
  				'500': 'hsl(var(--navy-500))',
  				'600': 'hsl(var(--navy-600))',
  				'700': 'hsl(var(--navy-700))',
  				'800': 'hsl(var(--navy-800))',
  				'900': 'hsl(var(--navy-900))',
  				'950': 'hsl(var(--navy-950))'
  			},
  			magenta: {
  				DEFAULT: 'hsl(var(--magenta))',
  				strong: 'hsl(var(--magenta-strong))',
  				ink: 'hsl(var(--magenta-ink))',
  				soft: 'hsl(var(--magenta-soft))',
  				foreground: 'hsl(var(--magenta-foreground, 0 0% 100%))'
  			},
  			cyan: {
  				DEFAULT: 'hsl(var(--cyan))',
  				strong: 'hsl(var(--cyan-strong))',
  				ink: 'hsl(var(--cyan-ink))',
  				soft: 'hsl(var(--cyan-soft))',
  				foreground: 'hsl(var(--cyan-foreground, 240 31% 12%))'
  			},
  			lime: {
  				DEFAULT: 'hsl(var(--lime))',
  				strong: 'hsl(var(--lime-strong))',
  				ink: 'hsl(var(--lime-ink))',
  				soft: 'hsl(var(--lime-soft))',
  				foreground: 'hsl(var(--lime-foreground, 240 31% 12%))'
  			},
  			success: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
  			warning: { DEFAULT: 'hsl(var(--warning))', soft: 'hsl(var(--warning-soft))' },
  			info: { DEFAULT: 'hsl(var(--info))', soft: 'hsl(var(--info-soft))' },
  			sunken: 'hsl(var(--surface-sunken))',
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
  		},
  		keyframes: {
  			'status-pop': {
  				'0%': { transform: 'scale(0.85)', boxShadow: '0 0 0 0 currentColor' },
  				'60%': { transform: 'scale(1.06)', boxShadow: '0 0 0 4px transparent' },
  				'100%': { transform: 'scale(1)' }
  			},
  			shimmer: {
  				'100%': { transform: 'translateX(100%)' }
  			}
  		},
  		animation: {
  			'status-pop': 'status-pop 420ms cubic-bezier(0.16, 1, 0.3, 1)',
  			shimmer: 'shimmer 1.6s infinite'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
}
