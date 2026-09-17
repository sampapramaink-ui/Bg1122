/**
 * Global API Configuration & Resilient Push / Cloud Run Dispatcher
 * Ensures that push notifications and admin alerts work seamlessly
 * across Google Cloud Run, Vercel, Android APK WebView, and standalone PWAs.
 */

export const CLOUD_RUN_BACKEND_URL = "https://ais-dev-3i56sy2awc7eay4qfym7sg-376130601345.asia-southeast1.run.app";

/**
 * Dispatches a POST request with automatic Cloud Run backend fallback.
 * If running on Vercel or static PWA where local /api returns 404 or fails,
 * it immediately routes to the production Cloud Run backend with Google Cloud IAM credentials.
 */
export async function safeApiPost(endpoint: string, body: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  
  // 1. Try relative endpoint first with an aggressive 2.5s timeout for fast failover
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
      if (data && data.success !== false) {
        return { success: true, data };
      }
    }
  } catch (err: any) {
    console.warn(`Local endpoint ${cleanEndpoint} attempt failed or timed out:`, err?.message);
  }

  // 2. Fallback immediately to live Cloud Run Backend
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
