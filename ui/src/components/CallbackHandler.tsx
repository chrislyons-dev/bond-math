import { useAuth0, Auth0Provider } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

/**
 * Inner callback handler that uses Auth0 context
 */
function CallbackHandlerInner() {
  const { isLoading, error, isAuthenticated, user } = useAuth0();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    console.log('Callback state:', { isLoading, isAuthenticated, hasError: !!error, hasUser: !!user });

    // Redirect to home after successful authentication
    if (!isLoading && isAuthenticated && user && !error && !redirecting) {
      console.log('Redirecting to home page...');
      setRedirecting(true);

      // Immediate redirect
      window.location.replace('/');
    }
  }, [isLoading, isAuthenticated, user, error, redirecting]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card p-8 max-w-md text-center">
          <div className="mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className="w-16 h-16 mx-auto text-red-600 dark:text-red-400"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Authentication Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error.message || 'An error occurred during authentication.'}
          </p>
          <a href="/" className="btn-primary inline-block">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <svg
          className="animate-spin h-12 w-12 mx-auto mb-4 text-primary-600 dark:text-primary-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {redirecting ? 'Redirecting...' : 'Completing Login'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {redirecting
            ? 'Taking you to your dashboard...'
            : 'Please wait while we authenticate your account...'}
        </p>
        {!isLoading && !isAuthenticated && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-4">
            Authentication did not complete. <a href="/" className="text-primary-600 dark:text-primary-400 hover:underline">Return home</a>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Callback handler component that processes Auth0 redirect
 * Shows loading state while authentication completes
 */
export function CallbackHandler() {
  const domain = import.meta.env.PUBLIC_AUTH0_DOMAIN;
  const clientId = import.meta.env.PUBLIC_AUTH0_CLIENT_ID;
  const audience = import.meta.env.PUBLIC_AUTH0_AUDIENCE;
  const redirectUri = import.meta.env.PUBLIC_AUTH0_REDIRECT_URI || `${window.location.origin}/callback`;

  if (!domain || !clientId || !audience) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
            Configuration Error
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Auth0 configuration is missing. Please check your environment variables.
          </p>
          <a href="/" className="btn-primary inline-block">
            Return Home
          </a>
        </div>
      </div>
    );
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
      <CallbackHandlerInner />
    </Auth0Provider>
  );
}
