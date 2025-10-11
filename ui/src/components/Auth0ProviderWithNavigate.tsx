import { Auth0Provider } from '@auth0/auth0-react';
import type { ReactNode } from 'react';

interface Auth0ProviderWithNavigateProps {
  children: ReactNode;
}

/**
 * Auth0Provider wrapper that handles authentication flow
 * Configured for SPA application with code flow + PKCE
 */
export function Auth0ProviderWithNavigate({
  children,
}: Auth0ProviderWithNavigateProps) {
  const domain = import.meta.env.PUBLIC_AUTH0_DOMAIN;
  const clientId = import.meta.env.PUBLIC_AUTH0_CLIENT_ID;
  const audience = import.meta.env.PUBLIC_AUTH0_AUDIENCE;
  const redirectUri = import.meta.env.PUBLIC_AUTH0_REDIRECT_URI || `${window.location.origin}/callback`;

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
