// Razorpay integration utilities for Supabase Edge Functions (Deno)

export async function createRazorpayOrder(options: {
  amountInPaise: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}) {
  const keyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials not configured (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET missing in Supabase secrets)');
  }

  const authHeader = 'Basic ' + btoa(`${keyId}:${keySecret}`);

  const payload = {
    amount: options.amountInPaise,
    currency: options.currency || 'INR',
    receipt: options.receipt,
    notes: options.notes || {},
  };

  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Razorpay API error (${response.status}): ${errorBody}`);
  }

  return await response.json();
}

export async function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> {
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
  if (!keySecret) return false;

  const data = `${orderId}|${paymentId}`;
  return await verifyHmacSha256(data, signature, keySecret);
}

export async function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string
): Promise<boolean> {
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || Deno.env.get('RAZORPAY_KEY_SECRET') || '';
  if (!webhookSecret) return false;

  return await verifyHmacSha256(rawBody, signature, webhookSecret);
}

async function verifyHmacSha256(data: string, expectedHexSignature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const signatureBytes = new Uint8Array(signatureBuffer);
  const calculatedHex = Array.from(signatureBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return calculatedHex.toLowerCase() === expectedHexSignature.toLowerCase();
}
