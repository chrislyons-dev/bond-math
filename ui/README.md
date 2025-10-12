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

# Open http://localhost:4321 (or https://localhost:4321 if HTTPS is configured)
```

#### HTTPS Setup (Local Development)

For end-to-end testing with Auth0 and secure contexts, configure HTTPS for local development:

**1. Generate SSL Certificates**

```bash
cd ui
mkdir -p certs
cd certs

# Generate self-signed certificate (valid for 1 year)
openssl req -x509 -newkey rsa:2048 \
  -keyout localhost-key.pem \
  -out localhost-cert.pem \
  -days 365 \
  -nodes \
  -subj "//C=US/ST=State/L=City/O=Development/CN=localhost"
```

**2. Trust the Certificate (Optional)**

To avoid browser warnings:

- **Windows:** Double-click `localhost-cert.pem` → Install Certificate → Local Machine → Place in "Trusted Root Certification Authorities"
- **macOS:** `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain localhost-cert.pem`
- **Linux:** `sudo cp localhost-cert.pem /usr/local/share/ca-certificates/localhost.crt && sudo update-ca-certificates`

**3. Start Dev Server**

```bash
npm run dev

# Now accessible at https://localhost:4321
```

The Astro config automatically detects certificates in the `certs/` directory and enables HTTPS.

**Note:** Certificates are git-ignored and must be generated on each development machine.

#### Auth0 Configuration

The UI uses Auth0 for authentication and authorization. Configure the following environment variables:

**1. Copy Environment Template**

```bash
cp .env.example .env
```

**2. Update Auth0 Variables**

Edit `.env` with your Auth0 configuration:

```bash
# Auth0 Configuration
PUBLIC_AUTH0_DOMAIN=auth.bondmath.chrislyons.dev
PUBLIC_AUTH0_CLIENT_ID=your_client_id_here
PUBLIC_AUTH0_AUDIENCE=https://bond-math.api
PUBLIC_AUTH0_REDIRECT_URI=https://localhost:4321/callback

# API Configuration
PUBLIC_API_BASE_URL=https://bondmath.chrislyons.dev
PUBLIC_SITE_URL=https://bondmath.chrislyons.dev
```

**Environment Variables:**

| Variable                    | Description                                   | Example                            |
| --------------------------- | --------------------------------------------- | ---------------------------------- |
| `PUBLIC_AUTH0_DOMAIN`       | Your Auth0 tenant domain                      | `auth.bondmath.chrislyons.dev`     |
| `PUBLIC_AUTH0_CLIENT_ID`    | Auth0 application client ID                   | `CmvF4tGV7zqTfEk6MRAXXGkQBNPDO9Bu` |
| `PUBLIC_AUTH0_AUDIENCE`     | API identifier for access token audience      | `https://bond-math.api`            |
| `PUBLIC_AUTH0_REDIRECT_URI` | Callback URL after authentication             | `https://localhost:4321/callback`  |
| `PUBLIC_API_BASE_URL`       | Backend Gateway API base URL                  | `https://bondmath.chrislyons.dev`  |
| `PUBLIC_SITE_URL`           | Frontend site URL for canonical links and SEO | `https://bondmath.chrislyons.dev`  |

**Note:** `.env` is git-ignored. The `.env.example` file contains the production values for reference.

**Authentication Flow:**

1. User clicks "Log In" → Redirected to Auth0 Universal Login
2. After authentication → Redirected to `/callback` with authorization code
3. Callback page shows "Completing Login..." message
4. Auth0 SDK exchanges code for tokens using PKCE
5. User redirected to home page (or original page they were viewing)
6. Access token stored in localStorage (with refresh token support)
7. Profile page displays user info and access token for API calls

See [docs/reference/authentication.md](../../docs/reference/authentication.md) for complete Auth0 setup instructions.

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

### Authentication Components

**Auth0ProviderWithNavigate:** Wraps the app with Auth0 authentication context using the official `@auth0/auth0-react` SDK.

**AuthButton:** Smart button that displays "Log In" when unauthenticated or "Profile/Log Out" when authenticated.

**ProfileContent:** Protected component displaying user profile information, access token, and account details.

**Features:**

- Auth0 Universal Login integration
- PKCE-based authorization code flow
- Refresh token support with localStorage persistence
- Access token retrieval for API calls
- Profile page with user information and debugging tools

### ThemeToggle

React component for dark mode toggle with localStorage persistence and system preference detection.

### BaseLayout

Main Astro layout component with:

- Auth0Provider wrapping all content
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
