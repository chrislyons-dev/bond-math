/**
 * Auth0 Provider - OAuth2/OIDC authentication wrapper
 *
 * @component Auth0ProviderWithNavigate
 * @layer security
 * @description Wraps application with Auth0Provider for PKCE authentication flow
 * @owner platform-team
 * @dependencies @auth0/auth0-react
 * @security-model pkce-flow
 *
 * Configures Auth0 SDK for SPA authentication with:
 * - Authorization Code Flow with PKCE (RFC 7636)
 * - Refresh token rotation (localStorage)
 * - Automatic token renewal
 *
 * Environment variables required:
 * - PUBLIC_AUTH0_DOMAIN: Auth0 tenant domain
 * - PUBLIC_AUTH0_CLIENT_ID: Auth0 application client ID
 * - PUBLIC_AUTH0_AUDIENCE: API audience identifier
 */

import { Auth0Provider } from '@auth0/auth0-react';
import type { ReactNode } from 'react';

interface Auth0ProviderWithNavigateProps {
  children: ReactNode;
}

/**
 * Auth0Provider wrapper that handles authentication flow.
 *
 * Configured for SPA application with Authorization Code Flow + PKCE.
 * Uses refresh tokens stored in localStorage for persistent sessions.
 *
 * @param {Auth0ProviderWithNavigateProps} props - Component props
 * @param {ReactNode} props.children - Child components to wrap
 * @returns {JSX.Element} Auth0Provider wrapper or fallback div if config missing
 *
 * @example
 * ```tsx
 * <Auth0ProviderWithNavigate>
 *   <App />
 * </Auth0ProviderWithNavigate>
 * ```
 */
export function Auth0ProviderWithNavigate({ children }: Auth0ProviderWithNavigateProps) {
  const domain = import.meta.env.PUBLIC_AUTH0_DOMAIN;
  const clientId = import.meta.env.PUBLIC_AUTH0_CLIENT_ID;
  const audience = import.meta.env.PUBLIC_AUTH0_AUDIENCE;
  const redirectUri =
    import.meta.env.PUBLIC_AUTH0_REDIRECT_URI || `${window.location.origin}/callback`;

  if (!domain || !clientId || !audience) {
    console.error('Auth0 configuration missing:', { domain, clientId, audience });
    return <div>{children}</div>;
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: audience,
        scope: 'openid profile email',
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
}
