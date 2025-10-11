/**
 * Version utilities - Extract version numbers from package.json
 */

import packageJson from '../../../package.json';

/**
 * Extracts major version from a semver string
 * Examples: "^5.0.5" -> "5", "~3.4.17" -> "3", "18.3.1" -> "18"
 */
function getMajorVersion(versionStr: string): string {
  const match = versionStr.match(/(\d+)/);
  return match ? match[1] : versionStr;
}

/**
 * Extracts major.minor version from a semver string
 * Examples: "^5.0.5" -> "5.0", "~3.4.17" -> "3.4", "18.3.1" -> "18.3"
 */
function _getMajorMinorVersion(versionStr: string): string {
  const match = versionStr.match(/(\d+\.\d+)/);
  return match ? match[1] : versionStr;
}

export interface TechVersions {
  astro: string;
  react: string;
  tailwind: string;
  typescript: string;
  cloudflare: string; // This is conceptual, not from package.json
}

/**
 * Get technology versions from package.json
 * Versions are extracted at build time and baked into the static HTML
 */
export function getTechVersions(): TechVersions {
  const deps = packageJson.dependencies;
  const devDeps = packageJson.devDependencies;

  return {
    astro: getMajorVersion(deps.astro),
    react: getMajorVersion(deps.react),
    tailwind: getMajorVersion(deps.tailwindcss),
    typescript: getMajorVersion(devDeps.typescript),
    cloudflare: 'Workers', // Conceptual - Cloudflare doesn't have a version
  };
}

/**
 * Get detailed version info for display
 */
export function getDetailedVersions() {
  const deps = packageJson.dependencies;
  const devDeps = packageJson.devDependencies;

  return {
    astro: {
      name: 'Astro',
      version: getMajorVersion(deps.astro),
      fullVersion: deps.astro,
      description: 'Static Site',
    },
    react: {
      name: 'React',
      version: getMajorVersion(deps.react),
      fullVersion: deps.react,
      description: 'Interactive UI',
    },
    tailwind: {
      name: 'Tailwind CSS',
      version: getMajorVersion(deps.tailwindcss),
      fullVersion: deps.tailwindcss,
      description: 'Styling',
    },
    typescript: {
      name: 'TypeScript',
      version: getMajorVersion(devDeps.typescript),
      fullVersion: devDeps.typescript,
      description: 'Type Safety',
    },
    cloudflare: {
      name: 'Cloudflare',
      version: 'Workers',
      fullVersion: 'Workers & Pages',
      description: 'Edge Platform',
    },
  };
}
