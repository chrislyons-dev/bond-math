import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

/**
 * Profile content component displaying user information and permissions
 */
function ProfileContentInner() {
  const { user, isAuthenticated, isLoading, getAccessTokenSilently } = useAuth0();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [_role, setRole] = useState<string>('');
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    const getTokenClaims = async () => {
      try {
        const token = await getAccessTokenSilently({
          authorizationParams: {
            audience: import.meta.env.PUBLIC_AUTH0_AUDIENCE,
            scope: 'openid profile email',
          },
        });

        // Decode JWT to extract permissions
        const payload = JSON.parse(atob(token.split('.')[1]));
        const namespace = 'https://bondmath.chrislyons.dev';

        setPermissions(payload.permissions || payload[`${namespace}/permissions`] || []);
        setRole(payload[`${namespace}/role`] || 'Unknown');
      } catch (error) {
        console.error('Error getting token claims:', error);
        setTokenError(error instanceof Error ? error.message : 'Failed to get permissions');
      }
    };

    if (isAuthenticated) {
      getTokenClaims();
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-lg text-gray-600 dark:text-gray-400">Loading profile...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Authentication Required
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Please log in to view your profile.</p>
        <a href="/" className="btn-primary inline-block">
          Go Home
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* User Info Card */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          Profile Information
        </h2>
        <div className="flex items-start gap-6">
          {user.picture && (
            <img
              src={user.picture}
              alt={user.name || 'User avatar'}
              className="w-24 h-24 rounded-full border-2 border-gray-200 dark:border-gray-700"
            />
          )}
          <div className="flex-1 space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</div>
              <p className="text-lg text-gray-900 dark:text-white">{user.name || 'N/A'}</p>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</div>
              <p className="text-lg text-gray-900 dark:text-white">{user.email || 'N/A'}</p>
              {user.email_verified !== undefined && (
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    user.email_verified
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                  }`}
                >
                  {user.email_verified ? 'Verified' : 'Not Verified'}
                </span>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">User ID</div>
              <p className="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">
                {user.sub}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Permissions Card */}
      <div className="card p-6">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Permissions</h3>
        {tokenError ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-700 dark:text-red-400 text-sm">{tokenError}</p>
          </div>
        ) : permissions.length > 0 ? (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                Your Permissions ({permissions.length})
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Permission
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Service
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      >
                        Access Level
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {permissions.map((permission) => {
                      const [service, access] = permission.split(':');
                      return (
                        <tr key={permission}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                            {permission}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 capitalize">
                            {service}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                access === 'read'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                  : access === 'write'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                              }`}
                            >
                              {access}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-600 dark:text-gray-400">Loading permissions...</div>
        )}
      </div>

      {/* Raw User Object (for debugging) */}
      <details className="card p-6">
        <summary className="text-lg font-semibold text-gray-900 dark:text-white cursor-pointer">
          Raw User Object (Debug)
        </summary>
        <pre className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-auto text-xs">
          <code className="text-gray-700 dark:text-gray-300">{JSON.stringify(user, null, 2)}</code>
        </pre>
      </details>
    </div>
  );
}

export function ProfileContent() {
  const domain = import.meta.env.PUBLIC_AUTH0_DOMAIN;
  const clientId = import.meta.env.PUBLIC_AUTH0_CLIENT_ID;
  const audience = import.meta.env.PUBLIC_AUTH0_AUDIENCE;
  const redirectUri =
    import.meta.env.PUBLIC_AUTH0_REDIRECT_URI || `${window.location.origin}/callback`;

  if (!domain || !clientId || !audience) {
    console.error('Auth0 configuration missing:', { domain, clientId, audience });
    return (
      <div className="card p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
          Configuration Error
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Auth0 configuration is missing. Please check your environment variables.
        </p>
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
      <ProfileContentInner />
    </Auth0Provider>
  );
}
