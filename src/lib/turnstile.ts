import { fetch } from 'node-fetch'; // Ensure fetch is available

export async function verifyCaptchaToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) {
    throw new Error('Turnstile secret not configured');
  }

  const body = new URLSearchParams();
  body.append('secret', secret);
  body.append('response', token);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: body.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  if (!response.ok) {
    return false;
  }

  const data = await response.json();
  return data.success === true;
}