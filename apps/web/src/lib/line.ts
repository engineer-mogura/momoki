const LINE_CLIENT_ID =
  process.env.NEXT_PUBLIC_LINE_CHANNEL_ID || process.env.NEXT_PUBLIC_LINE_CLIENT_ID || '';
const LINE_REDIRECT_URI =
  process.env.NEXT_PUBLIC_LINE_REDIRECT_URI || 'http://localhost:3000/auth/line/callback';

const PKCE_STORAGE_KEY = 'momoki_line_pkce';
const PKCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Generate random string for state and code_verifier
function generateRandomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  const values = crypto.getRandomValues(new Uint8Array(length));
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

// Generate code_challenge from code_verifier (PKCE)
async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function startLineLogin(): Promise<void> {
  return startLineLoginWithRedirect('/');
}

export function startAdminLineLogin(): Promise<void> {
  return startLineLoginWithRedirect('/admin');
}

export async function startLineLoginWithRedirect(postLoginRedirect: string): Promise<void> {
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  localStorage.setItem(
    PKCE_STORAGE_KEY,
    JSON.stringify({
      state,
      codeVerifier,
      createdAt: Date.now(),
      postLoginRedirect,
    })
  );

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINE_CLIENT_ID,
    redirect_uri: LINE_REDIRECT_URI,
    state: state,
    scope: 'profile openid',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

export function getStoredAuthParams(): { state: string; codeVerifier: string; postLoginRedirect: string } | null {
  const raw = localStorage.getItem(PKCE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      state?: string;
      codeVerifier?: string;
      createdAt?: number;
      postLoginRedirect?: string;
    };

    if (!parsed.state || !parsed.codeVerifier || !parsed.createdAt) return null;
    if (Date.now() - parsed.createdAt > PKCE_TTL_MS) {
      localStorage.removeItem(PKCE_STORAGE_KEY);
      return null;
    }

    return {
      state: parsed.state,
      codeVerifier: parsed.codeVerifier,
      postLoginRedirect: parsed.postLoginRedirect || '/',
    };
  } catch {
    return null;
  }
}

export function clearStoredAuthParams(): void {
  localStorage.removeItem(PKCE_STORAGE_KEY);
}
