const LINE_CLIENT_ID = process.env.NEXT_PUBLIC_LINE_CLIENT_ID || '';
const LINE_REDIRECT_URI = process.env.NEXT_PUBLIC_LINE_REDIRECT_URI || 'http://localhost:3000/auth/line/callback';

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
  const state = generateRandomString(32);
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store state and code_verifier in sessionStorage
  sessionStorage.setItem('line_state', state);
  sessionStorage.setItem('line_code_verifier', codeVerifier);

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

export function getStoredAuthParams(): { state: string; codeVerifier: string } | null {
  const state = sessionStorage.getItem('line_state');
  const codeVerifier = sessionStorage.getItem('line_code_verifier');

  if (!state || !codeVerifier) {
    return null;
  }

  return { state, codeVerifier };
}

export function clearStoredAuthParams(): void {
  sessionStorage.removeItem('line_state');
  sessionStorage.removeItem('line_code_verifier');
}
