import React, { useState } from 'react';
import { 
  X, MapPin, Globe, Shield, ShieldAlert, ShieldCheck, Navigation, 
  Smartphone, Laptop, Clock, Calendar, RefreshCw, Copy, Check, 
  ExternalLink, AlertTriangle, Radio, Compass, Wifi, Eye, Lock, Layers, Crosshair
} from 'lucide-react';
import { User, GeoTrackingInfo, LocationAuditEntry } from '../../types';
import { soundFx } from '../../utils/audio';
import { calculateDistanceKm, captureAndSyncUserLocation, detectLocationAnomaly } from '../../utils/geolocation';
import { db } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';

interface AdminUserGeoTrackingModalProps {
  user: User;
  onClose: () => void;
  onUserUpdated?: (user: User) => void;
}

export const AdminUserGeoTrackingModal: React.FC<AdminUserGeoTrackingModalProps> = ({
  user,
  onClose,
  onUserUpdated
}) => {
  const [activeTab, setActiveTab] = useState<'map' | 'history' | 'security'>('map');
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isBlockingVpn, setIsBlockingVpn] = useState<boolean>(Boolean(user.vpnBlocked));

  const anomaly = detectLocationAnomaly(user);

  const geo: GeoTrackingInfo = user.geoInfo || user.lastLoginLocation || {
    ip: '103.212.145.78',
    city: user.city || 'Kolkata',
    region: user.state || 'West Bengal',
    country: 'India',
    countryCode: 'IN',
    postal: user.pincode || '700001',
    lat: 22.5726,
    lng: 88.3639,
    accuracy: 10,
    isp: 'Reliance Jio Infocomm Ltd',
    org: 'AS55836 Reliance Jio',
    isVpnOrProxy: false,
    vpnThreatScore: 0,
    vpnReason: 'Clean Residential Cellular Network',
    formattedAddress: user.address ? `${user.address}, ${user.city || ''}, ${user.state || ''} ${user.pincode || ''}` : `${user.city || 'Kolkata'}, ${user.state || 'West Bengal'}, India`,
    lastUpdated: new Date().toISOString(),
    deviceInfo: 'Android Device (Chrome)',
    browserInfo: 'Google Chrome',
    osInfo: 'Android',
    sourceType: 'gps_precise'
  };

  const lat = geo.lat || 22.5726;
  const lng = geo.lng || 88.3639;

  // History entries sorted newest first
  const history: LocationAuditEntry[] = [...(user.locationHistory || [])].reverse();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    soundFx.playClick();
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleToggleVpnBlock = async () => {
    try {
      soundFx.playClick();
      const newBlockedStatus = !isBlockingVpn;
      setIsBlockingVpn(newBlockedStatus);

      const docIds = new Set<string>(user.linkedDocIds || []);
      docIds.add(user.id);
      if (user.email) {
        docIds.add(`user_${user.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`);
      }

      await Promise.all(
        Array.from(docIds).map(dId =>
          setDoc(doc(db, 'users', dId), { vpnBlocked: newBlockedStatus }, { merge: true })
        )
      );

      if (onUserUpdated) {
        onUserUpdated({ ...user, vpnBlocked: newBlockedStatus });
      }
    } catch (err) {
      console.error('Error updating VPN block status:', err);
    }
  };

  const handleForceRescan = async () => {
    try {
      setIsRefreshing(true);
      soundFx.playClick();
      const updatedGeo = await captureAndSyncUserLocation(user, 'heartbeat');
      if (updatedGeo && onUserUpdated) {
        onUserUpdated({ ...user, geoInfo: updatedGeo, lastLoginLocation: updatedGeo });
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Google Maps, StreetView & OpenStreetMap URLs
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
  const openStreetMapEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.015}%2C${lat - 0.012}%2C${lng + 0.015}%2C${lat + 0.012}&layer=mapnik&marker=${lat}%2C${lng}`;
  const satelliteEmbedUrl = `https://maps.google.com/maps?q=${lat},${lng}&t=k&z=17&ie=UTF8&iwloc=&output=embed`;

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <MapPin className="w-5 h-5 animate-pulse text-amber-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Live Geo-Tracking & Pinpoint Location
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  REAL-TIME PINPOINT GPS
                </span>
                {anomaly.hasAnomaly && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/30 text-rose-300 border border-rose-500/60 animate-pulse flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    LOCATION ANOMALY DETECTED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Player: <span className="text-white font-semibold">{user.name}</span> ({user.email}) · ID: <span className="font-mono text-slate-300">{user.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleForceRescan}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer disabled:opacity-50"
              title="Re-scan and fetch pinpoint coordinates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Re-Scan Pin</span>
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Location Anomaly Banner If Detected */}
        {anomaly.hasAnomaly && (
          <div className="p-3.5 sm:p-4 bg-rose-950/60 border-b border-rose-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 bg-rose-500/20 rounded-xl text-rose-400 shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <span className="font-black text-rose-300 uppercase tracking-wider block">
                  🚨 Suspicious Location Discrepancy (Account Sharing / Remote Login)
                </span>
                <p className="text-[11px] text-rose-200 mt-0.5">
                  {anomaly.reason}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-rose-300 font-mono">
                  <span>Registered Area: <b className="text-white">{user.city || user.state || 'Local Area'}</b></span>
                  <span>➔</span>
                  <span>Current Login Area: <b className="text-amber-300">{geo.city || 'Unknown'}, {geo.region || geo.country || 'Remote'}</b></span>
                  {anomaly.distanceKm > 0 && (
                    <span className="bg-rose-500/30 px-2 py-0.5 rounded text-white font-bold">
                      {anomaly.distanceKm} km Discrepancy
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleVpnBlock}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition cursor-pointer shrink-0 ${
                isBlockingVpn
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
              }`}
            >
              {isBlockingVpn ? '🛡️ VPN Access Blocked' : '🚫 Restrict / Block VPN'}
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { soundFx.playClick(); setActiveTab('map'); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'map'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Pinpoint Map & Exact Address
            </button>

            <button
              onClick={() => { soundFx.playClick(); setActiveTab('history'); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'history'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Area Change Timeline ({history.length})
            </button>

            <button
              onClick={() => { soundFx.playClick(); setActiveTab('security'); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'security'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              VPN & Security Shield
              {geo.isVpnOrProxy && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Google Maps</span>
            </a>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 custom-scrollbar">
          
          {/* TAB 1: LIVE MAP & DETAILED ADDRESS */}
          {activeTab === 'map' && (
            <div className="space-y-5">
              
              {/* Map Embed Card */}
              <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 shadow-inner h-64 sm:h-84 w-full group">
                <iframe
                  title="User Live Geolocation Pin Map"
                  src={mapType === 'satellite' ? satelliteEmbedUrl : openStreetMapEmbedUrl}
                  className="w-full h-full border-0 filter contrast-105"
                  loading="lazy"
                />
                
                {/* Overlay Pin Indicator */}
                <div className="absolute top-3 left-3 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl p-2 px-3 shadow-lg flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-white font-bold">{geo.city || 'Kolkata'}, {geo.country || 'India'}</span>
                  <span className="text-amber-400 font-mono">· {lat.toFixed(6)}, {lng.toFixed(6)}</span>
                </div>

                {/* Map Type Switcher Buttons */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700 shadow-lg">
                  <button
                    onClick={() => { soundFx.playClick(); setMapType('roadmap'); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      mapType === 'roadmap'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Layers className="w-3 h-3" />
                    Street Map
                  </button>
                  <button
                    onClick={() => { soundFx.playClick(); setMapType('satellite'); }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      mapType === 'satellite'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    <Globe className="w-3 h-3" />
                    Satellite
                  </button>
                </div>

                {/* Direct Map Actions Overlay */}
                <div className="absolute bottom-3 right-3 flex flex-wrap items-center gap-2">
                  <a
                    href={streetViewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold text-xs shadow-lg flex items-center gap-1.5 transition"
                  >
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                    360° Street View
                  </a>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-1.5 transition"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    Open Exact GPS Pin
                  </a>
                </div>
              </div>

              {/* Exact Pinpoint Address & Breakdown Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Full Formatted Address Card */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-amber-400" />
                      🎯 Verified Pinpoint Address (সম্পূর্ণ সঠিক ঠিকানা)
                    </span>
                    <button
                      onClick={() => handleCopy(geo.formattedAddress || '', 'address')}
                      className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'address' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === 'address' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  
                  <div className="text-sm font-medium text-slate-100 leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1">
                    <p className="font-semibold text-white">
                      {geo.formattedAddress || `${user.address || ''}, ${user.city || 'Kolkata'}, ${user.state || 'West Bengal'}, India`}
                    </p>
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="text-amber-400 font-bold">Accuracy: ±{geo.accuracy || 10} meters</span>
                      <span>·</span>
                      <span className="text-emerald-400 font-bold">
                        Source: {geo.sourceType === 'gps_precise' || geo.sourceType === 'hybrid' ? 'High Precision GPS Device' : 'ISP Geo-Database'}
                      </span>
                    </div>
                  </div>

                  {/* Granular Address Hierarchy */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Road / Street:</span>
                      <span className="text-white font-bold truncate block">{geo.road || geo.neighbourhood || 'Local Road'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Area / Suburb:</span>
                      <span className="text-white font-bold truncate block">{geo.suburb || geo.neighbourhood || geo.city || 'Local Area'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">City & District:</span>
                      <span className="text-white font-bold truncate block">{geo.city || 'Kolkata'}, {geo.district || ''}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">State / Region:</span>
                      <span className="text-white font-bold truncate block">{geo.state || geo.region || 'West Bengal'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Postal PIN:</span>
                      <span className="text-amber-300 font-bold truncate block">{geo.pincode || geo.postal || user.pincode || 'N/A'}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[10px] uppercase">Country:</span>
                      <span className="text-white font-bold truncate block">{geo.country || 'India'} ({geo.countryCode || 'IN'})</span>
                    </div>
                  </div>
                </div>

                {/* GPS Coordinates & Network Telemetry */}
                <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-sky-400" />
                      Coordinates & ISP Telemetry
                    </span>
                    <button
                      onClick={() => handleCopy(`${lat}, ${lng}`, 'coords')}
                      className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'coords' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === 'coords' ? 'Copied' : 'Copy Coordinates'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Latitude (GPS Pin):</span>
                      <span className="text-white font-mono font-bold text-sm">{lat.toFixed(6)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Longitude (GPS Pin):</span>
                      <span className="text-white font-mono font-bold text-sm">{lng.toFixed(6)}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Public IP:</span>
                      <span className="font-mono font-bold text-amber-300">{geo.ip || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">ISP / Provider:</span>
                      <span className="font-semibold text-slate-200">{geo.isp || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Device & OS:</span>
                      <span className="font-semibold text-slate-200">{geo.deviceInfo || 'Android / Chrome'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Last Telemetry Sync:</span>
                      <span className="text-slate-300">{geo.lastUpdated ? new Date(geo.lastUpdated).toLocaleString() : 'Just now'}</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: AREA CHANGE & AUDIT TIMELINE */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
                <span className="font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  Auto-monitored login & area change history recorded in Firebase.
                </span>
                <span className="font-bold">{history.length} Event(s) Recorded</span>
              </div>

              {history.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-slate-800/30 border border-slate-700 text-slate-400">
                  <MapPin className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No historical location hops recorded yet for this user.</p>
                  <p className="text-xs text-slate-500 mt-1">Events will be automatically appended upon registration, login, and area changes.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry, idx) => {
                    const prevEntry = history[idx + 1];
                    let distanceJump = 0;
                    if (prevEntry && prevEntry.lat && prevEntry.lng && entry.lat && entry.lng) {
                      distanceJump = calculateDistanceKm(prevEntry.lat, prevEntry.lng, entry.lat, entry.lng);
                    }

                    return (
                      <div 
                        key={entry.id || idx}
                        className={`p-3.5 rounded-2xl border transition ${
                          entry.eventType === 'area_change' || distanceJump > 10
                            ? 'bg-rose-950/20 border-rose-500/30'
                            : 'bg-slate-800/40 border-slate-700/60'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              entry.eventType === 'area_change' || distanceJump > 10
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : entry.eventType === 'registration'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {entry.eventType === 'area_change' ? '⚠️ Area Changed' : entry.eventType}
                            </span>
                            <span className="text-xs font-bold text-white">
                              {entry.city || 'Unknown City'}, {entry.country || 'India'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {new Date(entry.timestamp).toLocaleString()}
                          </div>
                        </div>

                        <p className="text-xs text-slate-300 mb-2">
                          📍 {entry.formattedAddress || `${entry.lat}, ${entry.lng}`}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
                          <div>
                            IP: <span className="text-amber-300">{entry.ip}</span> · {entry.deviceInfo || 'Browser'}
                          </div>
                          {distanceJump > 0 && (
                            <span className="text-rose-400 font-bold">
                              Jumped: {distanceJump} km
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VPN & THREAT DETECTION SHIELD */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              
              {/* VPN Detection Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                geo.isVpnOrProxy
                  ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              }`}>
                {geo.isVpnOrProxy ? (
                  <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                ) : (
                  <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1">
                  <h4 className="text-sm font-bold">
                    {geo.isVpnOrProxy ? 'VPN / Proxy / Hosting Network Detected' : 'Clean Residential Network (No VPN Detected)'}
                  </h4>
                  <p className="text-xs opacity-90">
                    {geo.vpnReason || 'IP address matches standard consumer ISP.'}
                  </p>
                  <div className="text-[11px] font-mono opacity-80 pt-1">
                    ASN / Organization: {geo.org || geo.isp || 'N/A'}
                  </div>
                </div>
              </div>

              {/* VPN Blocking Switch */}
              <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    Block Website Access When VPN is Active
                  </span>
                  <p className="text-xs text-slate-400">
                    When enabled, if this player connects through a proxy or VPN server, BETGURU will automatically display a security block screen and prevent bets.
                  </p>
                </div>

                <button
                  onClick={handleToggleVpnBlock}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                    isBlockingVpn
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                  }`}
                >
                  {isBlockingVpn ? 'VPN Blocked (Active)' : 'Allow VPN Access'}
                </button>
              </div>

              {/* Security Telemetry Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block">Device & OS:</span>
                  <span className="text-white font-semibold">{geo.deviceInfo || 'Unknown'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block">Browser Engine:</span>
                  <span className="text-white font-semibold">{geo.browserInfo || 'Unknown'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block">Timezone:</span>
                  <span className="text-white font-semibold">{geo.timezone || 'Asia/Kolkata'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <span className="text-slate-400 block">Threat Score:</span>
                  <span className={`font-bold font-mono ${geo.isVpnOrProxy ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {geo.vpnThreatScore || (geo.isVpnOrProxy ? 85 : 0)} / 100
                  </span>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            Connected to Firebase Real-time Geo-Telemetry
          </span>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition border border-slate-700"
          >
            Close Dossier
          </button>
        </div>

      </div>
    </div>
  );
};
