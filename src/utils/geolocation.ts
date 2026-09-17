import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { User, GeoTrackingInfo, LocationAuditEntry, LocationAnomalyInfo } from '../types';

// Known VPN / Proxy / Datacenter ISP and Org keywords
const SUSPICIOUS_HOSTING_KEYWORDS = [
  'vpn', 'proxy', 'tor', 'exit', 'relay', 'datacenter', 'hosting', 'cloud', 'server',
  'digitalocean', 'amazon', 'aws', 'ovh', 'hetzner', 'linode', 'vultr', 'm247',
  'choopa', 'leaseweb', 'cogent', 'nordvpn', 'expressvpn', 'surfshark', 'cyberghost',
  'private internet access', 'ipvanish', 'protonvpn', 'fastly', 'cloudflare warp',
  'akamai', 'alibaba cloud', 'tencent cloud', 'google cloud', 'microsoft azure', 'oracle cloud'
];

/**
 * Calculate distance between two lat/lng points in Kilometers (Haversine formula)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 100) / 100;
}

/**
 * Detect device, browser, and OS information
 */
export function getDeviceInfo(): { deviceInfo: string; browserInfo: string; osInfo: string } {
  if (typeof window === 'undefined' || !navigator) {
    return { deviceInfo: 'Unknown Device', browserInfo: 'Unknown Browser', osInfo: 'Unknown OS' };
  }

  const ua = navigator.userAgent;
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let device = 'Desktop';

  // Device
  if (/Android/i.test(ua)) {
    device = 'Android Device';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    device = 'iOS Device';
  } else if (/Mobile/i.test(ua)) {
    device = 'Mobile Device';
  } else if (/Tablet/i.test(ua)) {
    device = 'Tablet';
  }

  // OS
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Linux/i.test(ua)) os = 'Linux';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

  // Browser
  if (/Edg/i.test(ua)) browser = 'Microsoft Edge';
  else if (/Chrome/i.test(ua)) browser = 'Google Chrome';
  else if (/Firefox/i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Safari/i.test(ua)) browser = 'Apple Safari';
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera';

  return {
    deviceInfo: `${device} (${os})`,
    browserInfo: browser,
    osInfo: os
  };
}

/**
 * Check if IP info corresponds to a known VPN/Proxy/Datacenter
 */
export function checkIsVpnOrProxy(data: any): { isVpn: boolean; threatScore: number; reason?: string } {
  if (!data) return { isVpn: false, threatScore: 0 };

  const org = (data.org || data.as || data.isp || '').toLowerCase();
  const isp = (data.isp || '').toLowerCase();
  const combined = `${org} ${isp}`;

  let isVpn = false;
  let threatScore = 0;
  let reason = '';

  for (const keyword of SUSPICIOUS_HOSTING_KEYWORDS) {
    if (combined.includes(keyword)) {
      isVpn = true;
      threatScore = 85;
      reason = `Datacenter / Hosting / VPN Network Detected (${keyword.toUpperCase()})`;
      break;
    }
  }

  if (data.proxy === true || data.hosting === true || data.vpn === true) {
    isVpn = true;
    threatScore = 95;
    reason = reason || 'Proxy / VPN Flag Detected in IP Registry';
  }

  return { isVpn, threatScore, reason: isVpn ? reason : 'Clean Residential / Cellular Network' };
}

export interface DetailedAddressResult {
  formattedAddress: string;
  houseNumber?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  village?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

/**
 * Reverse geocode Coordinates to an exact, pinpoint human-readable address
 * with multi-source fallback (Nominatim + BigDataCloud)
 */
export async function reverseGeocodeDetailed(lat: number, lng: number): Promise<DetailedAddressResult> {
  if (!lat || !lng) {
    return { formattedAddress: 'Coordinates Unavailable' };
  }

  // Method 1: OpenStreetMap Nominatim with full address detail resolution (zoom 18)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal
      }
    );
    clearTimeout(timeoutId);
    if (resp.ok) {
      const json = await resp.json();
      if (json && json.address) {
        const a = json.address;
        const houseNumber = a.house_number || a.building || a.house_name || '';
        const road = a.road || a.street || a.pedestrian || a.footway || a.path || '';
        const neighbourhood = a.neighbourhood || a.suburb || a.residential || a.quarter || '';
        const suburb = a.suburb || a.city_district || '';
        const village = a.village || a.hamlet || a.town || '';
        const city = a.city || a.town || a.municipality || a.village || a.county || '';
        const district = a.state_district || a.county || a.district || '';
        const state = a.state || a.region || '';
        const pincode = a.postcode || '';
        const country = a.country || 'India';

        // Construct high-precision address line
        const parts: string[] = [];
        if (houseNumber) parts.push(houseNumber);
        if (road) parts.push(road);
        if (neighbourhood && neighbourhood !== road) parts.push(neighbourhood);
        if (suburb && suburb !== neighbourhood) parts.push(suburb);
        if (village && village !== city) parts.push(village);
        if (city) parts.push(city);
        if (district && district !== city && district !== state) parts.push(district);
        if (state) parts.push(pincode ? `${state} - ${pincode}` : state);
        if (country) parts.push(country);

        const customFormatted = parts.length > 0 ? parts.join(', ') : json.display_name;

        return {
          formattedAddress: customFormatted,
          houseNumber,
          road,
          suburb,
          neighbourhood,
          village,
          city,
          district,
          state,
          pincode,
          country
        };
      } else if (json && json.display_name) {
        return { formattedAddress: json.display_name };
      }
    }
  } catch (_) {
    // Try method 2
  }

  // Method 2: BigDataCloud Reverse Geocoding API
  try {
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 3500);
    const resp2 = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller2.signal }
    );
    clearTimeout(timeoutId2);
    if (resp2.ok) {
      const d2 = await resp2.json();
      if (d2) {
        const locality = d2.locality || d2.localityInfo?.administrative?.[3]?.name || '';
        const city = d2.city || d2.principalSubdivision || '';
        const state = d2.principalSubdivision || '';
        const country = d2.countryName || 'India';
        const pincode = d2.postcode || '';

        const parts = [locality, city, state ? (pincode ? `${state} - ${pincode}` : state) : '', country].filter(Boolean);
        const formatted = parts.join(', ');

        return {
          formattedAddress: formatted || `Pinpoint Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          city,
          state,
          pincode,
          country
        };
      }
    }
  } catch (_) {}

  return { formattedAddress: `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}` };
}

/**
 * Backward compatible reverse geocode
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const result = await reverseGeocodeDetailed(lat, lng);
  return result.formattedAddress;
}

/**
 * Forward geocode a registered address string to exact coordinates
 */
export async function forwardGeocodeAddress(query: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
  if (!query || query.trim().length < 3) return null;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: c.signal
      }
    );
    clearTimeout(t);
    if (resp.ok) {
      const results = await resp.json();
      if (results && results.length > 0) {
        return {
          lat: parseFloat(results[0].lat),
          lng: parseFloat(results[0].lon),
          displayName: results[0].display_name
        };
      }
    }
  } catch (_) {}
  return null;
}

/**
 * Request Real GPS Position from Browser Geolocation API
 */
export function requestGpsPosition(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0)
        });
      },
      () => {
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

/**
 * Fetch IP & Geo Data from multiple reliable fallback providers
 */
export async function fetchIpGeoData(): Promise<any> {
  // Provider 1: ipapi.co
  try {
    const c1 = new AbortController();
    const t1 = setTimeout(() => c1.abort(), 3500);
    const r1 = await fetch('https://ipapi.co/json/', { signal: c1.signal });
    clearTimeout(t1);
    if (r1.ok) {
      const d1 = await r1.json();
      if (d1 && (d1.ip || d1.city)) {
        return {
          ip: d1.ip,
          city: d1.city,
          region: d1.region || d1.region_code,
          country: d1.country_name,
          countryCode: d1.country_code,
          postal: d1.postal,
          lat: d1.latitude,
          lng: d1.longitude,
          isp: d1.org,
          org: d1.org,
          asNumber: d1.asn,
          timezone: d1.timezone
        };
      }
    }
  } catch (_) {}

  // Provider 2: ipwho.is (No API key needed, high reliability)
  try {
    const c2 = new AbortController();
    const t2 = setTimeout(() => c2.abort(), 3500);
    const r2 = await fetch('https://ipwho.is/', { signal: c2.signal });
    clearTimeout(t2);
    if (r2.ok) {
      const d2 = await r2.json();
      if (d2 && d2.success) {
        return {
          ip: d2.ip,
          city: d2.city,
          region: d2.region,
          country: d2.country,
          countryCode: d2.country_code,
          postal: d2.postal,
          lat: d2.latitude,
          lng: d2.longitude,
          isp: d2.connection?.isp || d2.connection?.org,
          org: d2.connection?.org,
          asNumber: d2.connection?.asn ? `AS${d2.connection.asn}` : '',
          timezone: d2.timezone?.id,
          isVpn: Boolean(d2.security?.vpn || d2.security?.proxy || d2.security?.tor || d2.security?.hosting)
        };
      }
    }
  } catch (_) {}

  // Provider 3: freeipapi.com
  try {
    const c3 = new AbortController();
    const t3 = setTimeout(() => c3.abort(), 3500);
    const r3 = await fetch('https://freeipapi.com/api/json', { signal: c3.signal });
    clearTimeout(t3);
    if (r3.ok) {
      const d3 = await r3.json();
      if (d3 && d3.ipAddress) {
        return {
          ip: d3.ipAddress,
          city: d3.cityName,
          region: d3.regionName,
          country: d3.countryName,
          countryCode: d3.countryCode,
          postal: d3.zipCode,
          lat: d3.latitude,
          lng: d3.longitude,
          timezone: d3.timeZone,
          isVpn: Boolean(d3.isProxy)
        };
      }
    }
  } catch (_) {}

  return null;
}

/**
 * Detect Location Anomaly: Checks if the user's last login location differs
 * significantly from their primary registered area or previous location
 */
export function detectLocationAnomaly(user: User): LocationAnomalyInfo {
  if (!user) {
    return {
      hasAnomaly: false,
      severity: 'none',
      reason: '',
      distanceKm: 0,
      registeredLocation: '',
      currentLocation: '',
      isDifferentState: false,
      isDifferentCountry: false,
      isVpnActive: false
    };
  }

  const currentLoc = user.lastLoginLocation || user.geoInfo;
  const isVpnActive = Boolean(user.isVpnDetected || user.vpnBlocked || currentLoc?.isVpnOrProxy);

  // Determine registered location string
  const regParts = [user.address, user.city, user.state, user.pincode].filter(Boolean);
  const regCity = (user.city || '').trim().toLowerCase();
  const regState = (user.state || '').trim().toLowerCase();
  const registeredLocation = regParts.length > 0 ? regParts.join(', ') : 'Not Specified';

  // If no login telemetry has been recorded yet, check VPN or basic state
  if (!currentLoc) {
    return {
      hasAnomaly: isVpnActive,
      severity: isVpnActive ? 'high' : 'none',
      reason: isVpnActive ? 'VPN / Proxy Network Active' : '',
      distanceKm: 0,
      registeredLocation,
      currentLocation: 'No Telemetry Logged',
      isDifferentState: false,
      isDifferentCountry: false,
      isVpnActive
    };
  }

  const curCity = (currentLoc.city || '').trim().toLowerCase();
  const curRegion = (currentLoc.region || currentLoc.state || '').trim().toLowerCase();
  const curCountry = (currentLoc.country || 'India').trim().toLowerCase();
  const currentLocation = currentLoc.formattedAddress || [currentLoc.city, currentLoc.region, currentLoc.country].filter(Boolean).join(', ');

  let distanceKm = 0;
  if (currentLoc.lat && currentLoc.lng) {
    // If registration audit entry exists with coordinates, calculate distance
    const regAudit = (user.locationHistory || []).find(h => h.eventType === 'registration');
    if (regAudit && regAudit.lat && regAudit.lng) {
      distanceKm = calculateDistanceKm(regAudit.lat, regAudit.lng, currentLoc.lat, currentLoc.lng);
    }
  }

  const isDifferentCountry = Boolean(curCountry && curCountry !== 'india' && !curCountry.includes('ind'));
  
  // Check if state is different (ignoring empty registered states)
  let isDifferentState = false;
  if (regState && curRegion) {
    const s1 = regState.replace(/[^a-z]/g, '');
    const s2 = curRegion.replace(/[^a-z]/g, '');
    if (s1.length > 2 && s2.length > 2 && !s1.includes(s2) && !s2.includes(s1)) {
      isDifferentState = true;
    }
  }

  // Check if city is different
  let isDifferentCity = false;
  if (regCity && curCity) {
    const c1 = regCity.replace(/[^a-z]/g, '');
    const c2 = curCity.replace(/[^a-z]/g, '');
    if (c1.length > 2 && c2.length > 2 && !c1.includes(c2) && !c2.includes(c1)) {
      isDifferentCity = true;
    }
  }

  // Check location history jumps > 100km
  let hasHistoryJump = false;
  let maxJump = 0;
  const history = user.locationHistory || [];
  if (history.length >= 2) {
    for (let i = 0; i < history.length - 1; i++) {
      const e1 = history[i];
      const e2 = history[i + 1];
      if (e1.lat && e1.lng && e2.lat && e2.lng) {
        const d = calculateDistanceKm(e1.lat, e1.lng, e2.lat, e2.lng);
        if (d > maxJump) maxJump = d;
        if (d > 100) hasHistoryJump = true;
      }
    }
  }

  if (distanceKm === 0 && maxJump > 0) {
    distanceKm = maxJump;
  }

  // Evaluate Anomaly
  if (isDifferentCountry) {
    return {
      hasAnomaly: true,
      severity: 'critical',
      reason: `Foreign Login Detected (${currentLoc.country || 'Overseas'}) - Registered in ${user.state || user.city || 'India'}`,
      distanceKm: distanceKm || 2500,
      registeredLocation,
      currentLocation,
      isDifferentState: true,
      isDifferentCountry: true,
      isVpnActive
    };
  }

  if (isVpnActive) {
    return {
      hasAnomaly: true,
      severity: 'high',
      reason: `VPN / Proxy Tunnel Active: ${currentLoc.vpnReason || 'Datacenter IP Routing'}`,
      distanceKm,
      registeredLocation,
      currentLocation,
      isDifferentState,
      isDifferentCountry: false,
      isVpnActive: true
    };
  }

  if (isDifferentState || distanceKm > 300) {
    return {
      hasAnomaly: true,
      severity: 'high',
      reason: `State Mismatch: Registered in ${user.state || user.city || 'Home Area'} · Logged in from ${currentLoc.region || currentLoc.city} (${distanceKm ? distanceKm + ' km away' : 'Different State'})`,
      distanceKm,
      registeredLocation,
      currentLocation,
      isDifferentState: true,
      isDifferentCountry: false,
      isVpnActive
    };
  }

  if (isDifferentCity || distanceKm > 60 || hasHistoryJump) {
    return {
      hasAnomaly: true,
      severity: 'medium',
      reason: `Area Discrepancy: Registered in ${user.city || user.state || 'Local Area'} · Logged in from ${currentLoc.city || currentLoc.region} (${distanceKm ? distanceKm + ' km away' : 'Different City'})`,
      distanceKm,
      registeredLocation,
      currentLocation,
      isDifferentState: false,
      isDifferentCountry: false,
      isVpnActive
    };
  }

  return {
    hasAnomaly: false,
    severity: 'none',
    reason: 'Location matches registered residential area',
    distanceKm,
    registeredLocation,
    currentLocation,
    isDifferentState: false,
    isDifferentCountry: false,
    isVpnActive: false
  };
}

/**
 * Capture full real-time user location, check VPN, detect area changes,
 * and seamlessly sync to Firestore
 */
export async function captureAndSyncUserLocation(
  user: User,
  eventType: 'registration' | 'login' | 'area_change' | 'bet' | 'deposit' | 'withdrawal' | 'heartbeat' = 'login'
): Promise<GeoTrackingInfo | null> {
  if (!user || !user.id || user.id === 'anonymous') return null;

  try {
    const [ipData, gpsPos] = await Promise.all([
      fetchIpGeoData(),
      requestGpsPosition()
    ]);

    if (!ipData && !gpsPos) return null;

    const dev = getDeviceInfo();
    const vpnCheck = checkIsVpnOrProxy(ipData || {});

    const finalLat = gpsPos?.lat ?? ipData?.lat ?? 0;
    const finalLng = gpsPos?.lng ?? ipData?.lng ?? 0;

    let addressResult: DetailedAddressResult = { formattedAddress: '' };
    if (finalLat && finalLng) {
      addressResult = await reverseGeocodeDetailed(finalLat, finalLng);
    }

    if (!addressResult.formattedAddress && ipData) {
      addressResult.formattedAddress = [ipData.city, ipData.region, ipData.postal, ipData.country].filter(Boolean).join(', ');
    }

    const geoInfo: GeoTrackingInfo = {
      ip: ipData?.ip || 'N/A',
      city: addressResult.city || ipData?.city || '',
      region: addressResult.state || ipData?.region || '',
      country: addressResult.country || ipData?.country || 'India',
      countryCode: ipData?.countryCode || 'IN',
      postal: addressResult.pincode || ipData?.postal || '',
      lat: finalLat,
      lng: finalLng,
      accuracy: gpsPos?.accuracy || (gpsPos ? 10 : 800),
      isp: ipData?.isp || ipData?.org || 'Standard ISP',
      org: ipData?.org || '',
      asNumber: ipData?.asNumber || '',
      timezone: ipData?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      isVpnOrProxy: vpnCheck.isVpn || ipData?.isVpn === true,
      vpnThreatScore: vpnCheck.threatScore,
      vpnReason: vpnCheck.reason,
      gpsLatitude: gpsPos?.lat,
      gpsLongitude: gpsPos?.lng,
      gpsAccuracy: gpsPos?.accuracy,
      hasGps: Boolean(gpsPos),
      lastUpdated: new Date().toISOString(),
      formattedAddress: addressResult.formattedAddress || 'Location detected via IP Geolocation',
      houseNumber: addressResult.houseNumber,
      road: addressResult.road,
      suburb: addressResult.suburb,
      neighbourhood: addressResult.neighbourhood,
      village: addressResult.village,
      district: addressResult.district,
      state: addressResult.state,
      pincode: addressResult.pincode,
      sourceType: gpsPos ? 'gps_precise' : 'ip_network',
      deviceInfo: dev.deviceInfo,
      browserInfo: dev.browserInfo,
      osInfo: dev.osInfo
    };

    // Check if Area has changed significantly compared to previous location (> 10 km or different city)
    let actualEventType = eventType;
    const prevLoc = user.lastLoginLocation || user.geoInfo;
    if (prevLoc && prevLoc.lat && prevLoc.lng && finalLat && finalLng) {
      const distKm = calculateDistanceKm(prevLoc.lat, prevLoc.lng, finalLat, finalLng);
      const isCityChanged = prevLoc.city && geoInfo.city && prevLoc.city.toLowerCase() !== geoInfo.city.toLowerCase();
      if (distKm > 10 || isCityChanged) {
        actualEventType = 'area_change';
      }
    }

    const auditEntry: LocationAuditEntry = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      eventType: actualEventType,
      ip: geoInfo.ip || 'N/A',
      city: geoInfo.city,
      region: geoInfo.region,
      country: geoInfo.country,
      lat: geoInfo.lat,
      lng: geoInfo.lng,
      formattedAddress: geoInfo.formattedAddress,
      isVpnOrProxy: geoInfo.isVpnOrProxy,
      vpnReason: geoInfo.vpnReason,
      deviceInfo: `${dev.deviceInfo} · ${dev.browserInfo}`
    };

    // Prepare update payload for Firestore
    const userUpdatePayload: any = {
      geoInfo,
      lastLoginLocation: geoInfo,
      isVpnDetected: geoInfo.isVpnOrProxy,
      lastActiveTime: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to Firestore strictly for the single primary user ID (prevents duplicate alias documents)
    await setDoc(
      doc(db, 'users', user.id),
      {
        ...userUpdatePayload,
        locationHistory: arrayUnion(auditEntry)
      },
      { merge: true }
    ).catch(() => {});

    return geoInfo;
  } catch (err) {
    console.warn('[GeoTracking Notice]:', err);
    return null;
  }
}

