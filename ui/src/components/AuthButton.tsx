/**
 * Authentication Button - Login/Logout control with user menu
 *
 * @component AuthButton
 * @layer presentation
 * @description Displays login button (unauthenticated) or user menu (authenticated)
 * @owner platform-team
 * @dependencies @auth0/auth0-react
 * @security-model auth0-oidc
 *
 * Provides:
 * - Login button that redirects to Auth0 Universal Login
 * - User profile display with picture and name
 * - Logout button that clears session
 */

import { useAuth0, Auth0Provider } from '@auth0/auth0-react';
import { useState, useRef, useEffect } from 'react';

/**
 * Inner component that uses Auth0 context.
 *
 * Renders:
 * - Avatar button (user picture or icon)
 * - Dropdown menu with Profile link and Logout button (authenticated)
 * - Dropdown menu with Login button (unauthenticated)
 *
 * Includes click-outside detection to close dropdown.
 */
function AuthButtonInner() {
  const { isAuthenticated, isLoading, user, loginWithRedirect, logout } = useAuth0();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = async () => {
    await loginWithRedirect({
      appState: {
        returnTo: window.location.pathname,
      },
    });
  };

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  if (isLoading) {
    return <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse" />;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Avatar/Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950 transition-all"
        aria-label={isAuthenticated ? 'User menu' : 'Login menu'}
        aria-expanded={isOpen}
      >
        {isAuthenticated && user?.picture ? (
          <img
            src={user.picture}
            alt="User avatar"
            className="w-10 h-10 rounded-full border-2 border-gray-300 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-400 transition-colors"
          />
        ) : (
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isAuthenticated
                ? 'bg-primary-100 dark:bg-primary-900 border-2 border-primary-300 dark:border-primary-700'
                : 'bg-gray-200 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
              className={`w-6 h-6 ${
                isAuthenticated
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
              />
            </svg>
          </div>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1" role="menu" aria-orientation="vertical">
            {isAuthenticated ? (
              <>
                <a
                  href="/profile"
                  className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="w-5 h-5"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                    Profile
                  </div>
                </a>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleLogout();
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  role="menuitem"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="1.5"
                      stroke="currentColor"
                      className="w-5 h-5"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                      />
                    </svg>
                    Log Out
                  </div>
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setIsOpen(false);
                  handleLogin();
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                role="menuitem"
              >
                <div className="flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="w-5 h-5"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                    />
                  </svg>
                  Log In
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Smart authentication button that shows login or logout based on auth state.
 *
 * Wraps AuthButtonInner with Auth0Provider to provide authentication context.
 * Falls back to static "Log In" link if Auth0 configuration is missing.
 *
 * @returns {JSX.Element} Auth button with Auth0 provider or fallback link
 *
 * @example
 * ```tsx
 * <Header>
 *   <AuthButton />
 * </Header>
 * ```
 */
export function AuthButton() {
  const domain = import.meta.env.PUBLIC_AUTH0_DOMAIN;
  const clientId = import.meta.env.PUBLIC_AUTH0_CLIENT_ID;
  const audience = import.meta.env.PUBLIC_AUTH0_AUDIENCE;
  const redirectUri =
    import.meta.env.PUBLIC_AUTH0_REDIRECT_URI || `${window.location.origin}/callback`;

  if (!domain || !clientId || !audience) {
    console.error('Auth0 configuration missing:', { domain, clientId, audience });
    return (
      <a href="/profile" className="btn-primary">
        Log In
      </a>
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
      <AuthButtonInner />
    </Auth0Provider>
  );
}
