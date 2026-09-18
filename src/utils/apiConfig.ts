/**
 * Global API Configuration & Resilient Push / Cloud Run Dispatcher
 * Ensures that push notifications and admin alerts work seamlessly
 * across Google Cloud Run, Vercel, Android APK WebView, and standalone PWAs.
 */

export const PRIMARY_USER_PANEL_URL = "https://betguruprime.vercel.app";
export const BACKUP_PUSH_RELAY_URL = "https://betguruvip-hot.vercel.app";
export const CLOUD_RUN_BACKEND_URL = "https://ais-dev-3i56sy2awc7eay4qfym7sg-376130601345.asia-southeast1.run.app";

/**
 * Dispatches a POST request with zero-delay parallel racing and automatic fallback.
 * Ensures transactions and admin push notifications are delivered to Android devices in 0s,
 * regardless of whether the user is on betguruprime.vercel.app, Android WebView, or standalone PWA.
 */
export async function safeApiPost(endpoint: string, body: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // 🚀 CRITICAL FOR 0-SEC LATENCY: Admin Order / Push Notifications
  if (cleanEndpoint.includes('notify-admin') || cleanEndpoint.includes('push')) {
    // Construct endpoints to race concurrently
    const candidateUrls: string[] = [cleanEndpoint];

    if (typeof window !== 'undefined') {
      const currentHost = window.location.host;
      if (!currentHost.includes('betguruprime')) {
        candidateUrls.push(`${PRIMARY_USER_PANEL_URL}${cleanEndpoint}`);
      }
    } else {
      candidateUrls.push(`${PRIMARY_USER_PANEL_URL}${cleanEndpoint}`);
    }

    // Always include the ultra-fast active FCM relay
    candidateUrls.push(`${BACKUP_PUSH_RELAY_URL}${cleanEndpoint}`);

    // Deduplicate candidate URLs
    const uniqueTargets = Array.from(new Set(candidateUrls));

    try {
      const sendToTarget = async (url: string) => {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 3500);
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(body),
            signal: ctrl.signal,
          });
          clearTimeout(tid);

          if (res.ok) {
            const data = await res.json().catch(() => null);
            // Must be actually delivered (not skipped)
            if (data && data.success !== false && data.delivered !== false) {
              return { success: true, data };
            }
          }
          throw new Error(`Target ${url} did not deliver`);
        } catch (e: any) {
          clearTimeout(tid);
          throw e;
        }
      };

      // The fastest endpoint that successfully delivers to FCM resolves in 0s
      const fastestSuccess = await Promise.any(uniqueTargets.map(sendToTarget));
      return fastestSuccess;
    } catch (err: any) {
      console.warn('Concurrent dispatch fallback initiated:', err?.message);
    }
  }

  // Standard safeApiPost for other endpoints
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(cleanEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => ({ success: true }));
      if (data && data.success !== false && data.delivered !== false) {
        return { success: true, data };
      }
    }
  } catch (err: any) {
    console.warn(`Local endpoint ${cleanEndpoint} attempt failed or timed out:`, err?.message);
  }

  // Fallback to active relay
  try {
    const relayRes = await fetch(`${BACKUP_PUSH_RELAY_URL}${cleanEndpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (relayRes.ok) {
      const data = await relayRes.json().catch(() => ({ success: true }));
      if (data && data.delivered !== false) {
        return { success: true, data };
      }
    }
  } catch (_) {}

  // Fallback to Cloud Run Backend
  try {
    const targetUrl = `${CLOUD_RUN_BACKEND_URL}${cleanEndpoint}`;
    const fallbackRes = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (fallbackRes.ok) {
      const data = await fallbackRes.json().catch(() => ({ success: true }));
      return { success: true, data };
    }
    const errText = await fallbackRes.text().catch(() => 'Unknown error');
    return { success: false, error: errText };
  } catch (fallbackErr: any) {
    console.warn(`Cloud Run fallback for ${cleanEndpoint} failed:`, fallbackErr?.message);
    return { success: false, error: fallbackErr?.message };
  }
}
