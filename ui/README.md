# Bond Math UI

Modern, accessible user interface for the Bond Math project, built with Astro 5.x, React 19.x, and Tailwind CSS 4.x.

## Features

- ✨ **Blazing Fast** - Static site generation with minimal JavaScript
- 🎨 **Beautiful Design** - Modern, responsive UI with Tailwind CSS
- 🌓 **Dark Mode** - System-aware theme with manual toggle
- ♿ **Accessible** - WCAG 2.1 AA compliant with keyboard navigation and screen reader support
- 🔍 **SEO Optimized** - Complete meta tags, sitemap, and structured data
- 📱 **Mobile First** - Responsive design that scales beautifully

## Tech Stack

- **Astro 5.x** - Static site framework for blazing fast performance
- **React 19.x** - Interactive components for the calculator
- **Tailwind CSS 4.x** - Utility-first CSS framework
- **TypeScript** - Type-safe development
- **Vite** - Lightning-fast build tool

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev

# Open http://localhost:4321
```

### Build

```bash
# Type check
npm run typecheck

# Build for production
npm run build

# Preview production build
npm run preview
```

### Linting & Formatting

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
ui/
├── public/              # Static assets (favicon, robots.txt)
├── src/
│   ├── components/      # React and Astro components
│   │   ├── ThemeToggle.tsx
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   └── DayCountCalculator.tsx
│   ├── layouts/         # Page layouts
│   │   └── BaseLayout.astro
│   ├── lib/            # Utilities and API clients
│   │   ├── api/
│   │   │   └── client.ts
│   │   └── utils/
│   │       └── validation.ts
│   ├── pages/          # Routes
│   │   ├── index.astro
│   │   ├── day-count.astro
│   │   └── about.astro
│   ├── styles/         # Global styles
│   │   └── global.css
│   └── env.d.ts        # Type definitions
├── astro.config.mjs    # Astro configuration
├── tailwind.config.mjs # Tailwind configuration
├── tsconfig.json       # TypeScript configuration
└── package.json
```

## Key Components

### DayCountCalculator

Interactive React component for calculating year fractions using various day count conventions.

**Features:**

- Multiple date pair support
- Real-time validation
- Error handling with user feedback
- Accessibility compliant (ARIA labels, keyboard navigation)
- Responsive design

### ThemeToggle

React component for dark mode toggle with localStorage persistence and system preference detection.

### BaseLayout

Main Astro layout component with:

- SEO optimization (meta tags, Open Graph, Twitter Card)
- Theme flash prevention
- Responsive header and footer
- Accessibility features

## API Integration

The UI communicates with the Bond Math backend services via the Gateway API:

- **Base URL (Production):** `https://bondmath.chrislyons.dev`
- **Base URL (Development):** `http://localhost:8787`

API client is located at `src/lib/api/client.ts`.

## Deployment

### Cloudflare Pages

The UI is deployed to Cloudflare Pages with automatic deployments from GitHub.

**Build Configuration:**

- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 18.x

**Environment Variables:**

- `PUBLIC_API_BASE_URL` - Backend API base URL
- `PUBLIC_SITE_URL` - Frontend site URL

### Manual Deployment

```bash
# Build and deploy to Cloudflare Pages
npm run deploy
```

## Accessibility

This project follows WCAG 2.1 AA guidelines:

- ✅ Semantic HTML
- ✅ ARIA labels and roles
- ✅ Keyboard navigation
- ✅ Focus indicators
- ✅ Screen reader support
- ✅ Color contrast ratios
- ✅ Reduced motion support

## Browser Support

- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile browsers (iOS Safari, Chrome Android)

## Contributing

See the main [CONTRIBUTING.md](../contributing.md) in the project root.

## License

MIT - See [LICENSE](../LICENSE) for details.
