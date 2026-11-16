export type NavigationTab =
  | 'dashboard'
  | 'leads'
  | 'lists'
  | 'campaigns'
  | 'mailboxes'
  | 'inbox'
  | 'deliverability'
  | 'warmup'
  | 'analytics'
  | 'crm'
  | 'automations'
  | 'ai'
  | 'integrations'
  | 'settings';

const VALID_TABS: ReadonlySet<string> = new Set<NavigationTab>([
  'dashboard',
  'leads',
  'lists',
  'campaigns',
  'mailboxes',
  'inbox',
  'deliverability',
  'warmup',
  'analytics',
  'crm',
  'automations',
  'ai',
  'integrations',
  'settings',
]);

export interface ParsedHashRoute {
  tab: NavigationTab | null;
  connected?: string;
  email?: string;
  error?: string;
}

export interface OAuthFeedback {
  type: 'success' | 'error';
  message: string;
}

export function parseOAuthHashRoute(hash: string): ParsedHashRoute {
  if (!hash) return { tab: null };
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  const [rawTab, rawQuery] = cleaned.split('?');
  const normalizedTab = (rawTab || '').replace(/^\/+/, '').trim();
  const tab = VALID_TABS.has(normalizedTab) ? (normalizedTab as NavigationTab) : null;

  if (!rawQuery) {
    return { tab };
  }

  const params = new URLSearchParams(rawQuery);
  const connected = params.get('connected') || undefined;
  const email = params.get('email') || undefined;
  const error = params.get('error') || undefined;

  return { tab, connected, email, error };
}

export function getGoogleOAuthFeedback(params: {
  connected?: string;
  email?: string;
  error?: string;
}): OAuthFeedback | null {
  if (params.connected === 'google') {
    return {
      type: 'success',
      message: params.email
        ? `Google account ${params.email} connected and offline refresh token stored securely in SQLite.`
        : 'Google account connected and offline refresh token stored securely in SQLite.',
    };
  }

  if (params.error) {
    switch (params.error) {
      case 'oauth_config_missing':
      case 'oauth_env_not_configured':
        return {
          type: 'error',
          message:
            'Google OAuth is not configured yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your local .env file and restart the server.',
        };
      case 'oauth_code_missing':
        return {
          type: 'error',
          message: 'Google did not return an authorization code. Please try reconnecting again.',
        };
      case 'access_denied':
        return {
          type: 'error',
          message: 'Google sign-in was cancelled before permissions were granted.',
        };
      case 'token_exchange_failed':
        return {
          type: 'error',
          message:
            'Google OAuth token exchange failed. Check that GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI match your Google Cloud Console client.',
        };
      default:
        return {
          type: 'error',
          message: `Google OAuth could not complete (${params.error}).`,
        };
    }
  }

  return null;
}
