/**
 * Commitlint configuration for Bond Math
 *
 * Enforces Conventional Commits format with project-specific scopes and types.
 * See contributing.md for detailed commit message standards.
 */

export default {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // Type enum - must match one of these
    'type-enum': [
      2,
      'always',
      [
        'feat',      // New feature
        'fix',       // Bug fix
        'docs',      // Documentation only
        'style',     // Code style (formatting, etc.)
        'refactor',  // Code refactoring
        'perf',      // Performance improvement
        'test',      // Adding/updating tests
        'build',     // Build system or dependencies
        'ci',        // CI/CD configuration
        'chore',     // Other changes
        'arch',      // Architecture changes (diagrams, ADRs)
        'revert',    // Revert a previous commit
      ],
    ],

    // Scope enum - must match one of these (optional)
    'scope-enum': [
      2,
      'always',
      [
        // Services
        'gateway',
        'daycount',
        'valuation',
        'metrics',
        'pricing',

        // Infrastructure
        'iac',
        'deploy',

        // Cross-cutting
        'auth',
        'docs',
        'testing',
        'api',

        // UI
        'ui',

        // Other
        'deps',
        'release',
      ],
    ],

    // Subject must be lowercase
    'subject-case': [2, 'always', 'lower-case'],

    // Subject must not end with period
    'subject-full-stop': [2, 'never', '.'],

    // Subject must not be empty
    'subject-empty': [2, 'never'],

    // Type must be lowercase
    'type-case': [2, 'always', 'lower-case'],

    // Type must not be empty
    'type-empty': [2, 'never'],

    // Scope must be lowercase (when provided)
    'scope-case': [2, 'always', 'lower-case'],

    // Header (first line) max length
    'header-max-length': [2, 'always', 100],

    // Body max line length
    'body-max-line-length': [2, 'always', 100],

    // Footer max line length
    'footer-max-line-length': [2, 'always', 100],
  },
};
