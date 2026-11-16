'use client';

import { useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Alert } from '@/components/ui';

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function getClientAuthToken(): Promise<string | null> {
  try {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    if (auth.currentUser) {
      return await auth.currentUser.getIdToken();
    }
  } catch (_e) {
    // If running in environment without client firebase
  }
  return null;
}

export interface RazorpayCheckoutProps {
  planId?: string;
  planName?: string;
  amountPaise?: number;
  buttonText?: string;
  className?: string;
  variant?: 'primary' | 'secondary' | 'marker';
  onSuccess?: (result: { paymentId: string; orderId: string; signature: string }) => void;
  onError?: (error: string) => void;
  children?: ReactNode;
}

export function RazorpayCheckout({
  planId = 'plan-pyq-premium-pack',
  planName = 'UGC NET Paper 1 — Premium PYQ Pack',
  amountPaise = 49900,
  buttonText = 'Pay ₹499 (Test Mode)',
  className,
  variant = 'marker',
  onSuccess,
  onError,
  children,
}: RazorpayCheckoutProps) {
  const auth = useAuth();
  const [status, setStatus] = useState<'idle' | 'loading' | 'paying' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ paymentId: string } | null>(null);

  const startCheckout = useCallback(async () => {
    setErrorMessage(null);
    setSuccessInfo(null);

    // 1. Session requirement check
    if (auth.status !== 'in' || !auth.user) {
      const msg = 'Please log in to purchase the mock test pack.';
      setErrorMessage(msg);
      onError?.(msg);
      return;
    }

    setStatus('loading');

    try {
      // 2. Load the official Razorpay Web SDK script
      const sdkReady = await loadRazorpayScript();
      if (!sdkReady || !window.Razorpay) {
        throw new Error('Could not load the Razorpay checkout SDK. Please check your internet connection.');
      }

      // 3. Acquire valid user token
      const token = await getClientAuthToken();
      if (!token) {
        throw new Error('Could not verify your session. Please refresh the page and try again.');
      }

      // 4. Generate Order ID via backend API
      const orderRes = await fetch('/api/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ planId }),
      });

      const orderData = (await orderRes.json()) as {
        success?: boolean;
        orderId?: string;
        razorpayOrderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        message?: string;
      };

      if (!orderRes.ok || !orderData.razorpayOrderId) {
        throw new Error(orderData.message || 'Failed to create order. Please try again.');
      }

      const activeKeyId = orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
      if (!activeKeyId) {
        throw new Error('Razorpay Key ID is missing. Ensure RAZORPAY_KEY_ID or NEXT_PUBLIC_RAZORPAY_KEY_ID is configured.');
      }

      // 5. Configure Razorpay modal options
      setStatus('paying');

      const options: RazorpayOptions = {
        key: activeKeyId,
        amount: orderData.amount ?? amountPaise,
        currency: orderData.currency ?? 'INR',
        name: 'UrEducator 2.0',
        description: planName,
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: auth.user.displayName || '',
          email: auth.user.email || '',
        },
        theme: {
          color: '#1e3a8a',
        },
        handler: async (response: RazorpaySuccessResponse) => {
          setStatus('verifying');
          try {
            // 6. Secure Signature Verification via backend API
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                orderId: orderData.orderId,
              }),
            });

            const verifyData = (await verifyRes.json()) as {
              success?: boolean;
              message?: string;
              paymentId?: string;
            };

            if (!verifyRes.ok || !verifyData.success) {
              throw new Error(verifyData.message || 'Payment signature verification failed.');
            }

            // 7. Entitlements granted and verified
            setStatus('success');
            setSuccessInfo({ paymentId: response.razorpay_payment_id });
            await auth.refresh(); // Refresh user claims/session
            onSuccess?.({
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
            });
          } catch (err: unknown) {
            const errText = err instanceof Error ? err.message : 'Signature verification failed.';
            setStatus('error');
            setErrorMessage(errText);
            onError?.(errText);
          }
        },
        modal: {
          ondismiss: () => {
            setStatus((prev) => (prev === 'paying' ? 'idle' : prev));
          },
        },
      };

      const rzpInstance = new window.Razorpay(options);
      rzpInstance.open();
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Checkout initiation failed.';
      setStatus('error');
      setErrorMessage(errText);
      onError?.(errText);
    }
  }, [auth, planId, planName, amountPaise, onSuccess, onError]);

  const isBusy = status === 'loading' || status === 'verifying';

  return (
    <div className="flex flex-col gap-3">
      {errorMessage && (
        <Alert tone="error" title="Checkout Error">
          {errorMessage}
        </Alert>
      )}

      {status === 'success' && (
        <Alert tone="ok" title="Payment Successful!">
          Your plan has been activated. Access to Paper 1 and PYQs is now unlocked.
          {successInfo?.paymentId && (
            <span className="block mt-1 font-mono text-xs text-muted">
              Payment ID: {successInfo.paymentId}
            </span>
          )}
        </Alert>
      )}

      {status !== 'success' && (
        <Button
          type="button"
          variant={variant}
          busy={isBusy}
          onClick={startCheckout}
          className={className}
        >
          {children || (status === 'verifying' ? 'Verifying payment...' : isBusy ? 'Preparing checkout...' : buttonText)}
        </Button>
      )}
    </div>
  );
}
export default RazorpayCheckout;
