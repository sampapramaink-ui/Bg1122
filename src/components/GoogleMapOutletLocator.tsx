import React, { useState, useMemo, useCallback } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow, 
  useAdvancedMarkerRef 
} from '@vis.gl/react-google-maps';
import { 
  X, 
  MapPin, 
  Navigation, 
  Phone, 
  Clock, 
  ShieldCheck, 
  Search, 
  Sparkles, 
  ExternalLink, 
  Key, 
  Compass, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { soundFx } from '../utils/audio';

// Verified authorized outlet locations with precise geographic coordinates
export interface OutletLocation {
  id: string;
  name: string;
  bengaliName: string;
  address: string;
  city: 'Dhaka' | 'Chittagong' | 'Sylhet' | 'Kolkata' | 'Rajshahi' | 'Khulna';
  lat: number;
  lng: number;
  phone: string;
  hours: string;
  type: 'VIP Hub' | 'Prize Claim' | 'Cash Agent' | '24/7 Kiosk';
  services: string[];
  verified: boolean;
}

export const AUTHORIZED_OUTLETS: OutletLocation[] = [
  {
    id: 'outlet-dhk-01',
    name: 'BetGuru Central VIP Claim Lounge - Gulshan 2',
    bengaliName: 'বেটগুরু সেন্ট্রাল ভিআইপি ক্লেইম লাউঞ্জ - গুলশান ২',
    address: 'Road 90, Gulshan 2, Dhaka 1212',
    city: 'Dhaka',
    lat: 23.7925,
    lng: 90.4152,
    phone: '+880 1711-009988',
    hours: '10:00 AM - 10:00 PM (Daily)',
    type: 'VIP Hub',
    services: ['Super Car Prize Handover', 'Instant Cash In/Out', 'VIP Member Card'],
    verified: true
  },
  {
    id: 'outlet-dhk-02',
    name: 'Motijheel Financial District Agent Counter',
    bengaliName: 'মতিঝিল বাণিজ্যিক এলাকা এজেন্ট কাউন্টার',
    address: 'City Centre Tower, Motijheel C/A, Dhaka 1000',
    city: 'Dhaka',
    lat: 23.7315,
    lng: 90.4172,
    phone: '+880 1822-334455',
    hours: '09:00 AM - 09:00 PM (Sat-Thu)',
    type: 'Cash Agent',
    services: ['Fast Deposit Verification', 'Lottery Ticket Purchase', 'Wallet Topup'],
    verified: true
  },
  {
    id: 'outlet-dhk-03',
    name: 'Uttara Sector 7 24/7 Service Point',
    bengaliName: 'উত্তরা সেক্টর ৭ সার্বক্ষণিক সেবা পয়েন্ট',
    address: 'Sector 7, Rabindra Sarani, Uttara, Dhaka 1230',
    city: 'Dhaka',
    lat: 23.8688,
    lng: 90.3986,
    phone: '+880 1933-778899',
    hours: '24 Hours Open',
    type: '24/7 Kiosk',
    services: ['24/7 Instant Cashier', 'Live Ticket Print', 'Customer Support'],
    verified: true
  },
  {
    id: 'outlet-ctg-01',
    name: 'Chittagong GEC Circle Regional Center',
    bengaliName: 'চট্টগ্রাম জিইসি মোড় আঞ্চলিক কেন্দ্র',
    address: 'CDA Avenue, GEC Circle, Chittagong 4000',
    city: 'Chittagong',
    lat: 22.3587,
    lng: 91.8215,
    phone: '+880 1644-556677',
    hours: '10:00 AM - 09:00 PM',
    type: 'Prize Claim',
    services: ['Lottery Prize Claim', 'bKash/Nagad Cash Desk', 'KYC Verification'],
    verified: true
  },
  {
    id: 'outlet-syl-01',
    name: 'Sylhet Zindabazar Authorized Kiosk',
    bengaliName: 'সিলেট জিন্দাবাজার অনুমোদিত কিয়স্ক',
    address: 'City Center Mall, Zindabazar, Sylhet 3100',
    city: 'Sylhet',
    lat: 24.8969,
    lng: 91.8703,
    phone: '+880 1755-667788',
    hours: '10:00 AM - 08:30 PM',
    type: 'Cash Agent',
    services: ['Cash Deposit', 'Ticket Printing', 'Direct Support'],
    verified: true
  },
  {
    id: 'outlet-kol-01',
    name: 'Kolkata Park Street Partner Hub',
    bengaliName: 'কলকাতা পার্ক স্ট্রিট পার্টনার হাব',
    address: 'Park Street, Kolkata, West Bengal 700016',
    city: 'Kolkata',
    lat: 22.5513,
    lng: 88.3526,
    phone: '+91 98300-11223',
    hours: '11:00 AM - 09:00 PM',
    type: 'VIP Hub',
    services: ['UPI Cashier', 'VIP Concierge', 'International Claims'],
    verified: true
  },
  {
    id: 'outlet-raj-01',
    name: 'Rajshahi Shaheb Bazar Agent Office',
    bengaliName: 'রাজশাহী সাহেব বাজার এজেন্ট অফিস',
    address: 'Shaheb Bazar Zero Point, Rajshahi 6000',
    city: 'Rajshahi',
    lat: 24.3636,
    lng: 88.6283,
    phone: '+880 1766-990011',
    hours: '09:30 AM - 08:30 PM',
    type: 'Cash Agent',
    services: ['Nagad/Rocket Cash-in', 'Draw Ticket Verification'],
    verified: true
  },
  {
    id: 'outlet-khl-01',
    name: 'Khulna Dakbangla Square Service Hub',
    bengaliName: 'খুলনা ডাকবাংলো মোড় সার্ভিস হাব',
    address: 'KDA Avenue, Dakbangla, Khulna 9100',
    city: 'Khulna',
    lat: 22.8157,
    lng: 89.5672,
    phone: '+880 1988-223344',
    hours: '10:00 AM - 09:00 PM',
    type: 'Prize Claim',
    services: ['Prize Claim Desk', 'VIP Support Desk', 'Cash In Desk'],
    verified: true
  }
];

interface GoogleMapOutletLocatorProps {
  isOpen: boolean;
  onClose: () => void;
}

// Marker component with attached InfoWindow for an outlet
const OutletMarkerItem: React.FC<{
  outlet: OutletLocation;
  isSelected: boolean;
  onSelect: (outlet: OutletLocation) => void;
  onCloseInfo: () => void;
}> = ({ outlet, isSelected, onSelect, onCloseInfo }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  const getPinColors = (type: OutletLocation['type']) => {
    switch (type) {
      case 'VIP Hub':
        return { bg: '#f59e0b', border: '#78350f', glyph: '#0f172a' };
      case 'Prize Claim':
        return { bg: '#10b981', border: '#064e3b', glyph: '#ffffff' };
      case '24/7 Kiosk':
        return { bg: '#06b6d4', border: '#164e63', glyph: '#ffffff' };
      default:
        return { bg: '#eab308', border: '#854d0e', glyph: '#0f172a' };
    }
  };

  const colors = getPinColors(outlet.type);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: outlet.lat, lng: outlet.lng }}
        title={outlet.name}
        onClick={() => onSelect(outlet)}
      >
        <Pin
          background={colors.bg}
          borderColor={colors.border}
          glyphColor={colors.glyph}
          scale={isSelected ? 1.3 : 1.1}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          onCloseClick={onCloseInfo}
          maxWidth={320}
        >
          <div className="p-2 text-slate-900 font-sans space-y-2">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                {outlet.type}
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified
              </span>
            </div>

            <div>
              <h4 className="font-extrabold text-sm text-slate-900 leading-snug">
                {outlet.name}
              </h4>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {outlet.bengaliName}
              </p>
            </div>

            <div className="text-[11px] text-slate-600 space-y-1 pt-1">
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>{outlet.address}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>{outlet.hours}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <a href={`tel:${outlet.phone}`} className="text-blue-700 font-bold hover:underline">
                  {outlet.phone}
                </a>
              </div>
            </div>

            <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${outlet.lat},${outlet.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>দিকনির্দেশনা পান (Get Directions)</span>
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export const GoogleMapOutletLocator: React.FC<GoogleMapOutletLocatorProps> = ({
  isOpen,
  onClose
}) => {
  // Load API key from env or localStorage fallback
  const [apiKey, setApiKey] = useState<string>(() => {
    return (
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
      localStorage.getItem('bg_gmp_api_key') ||
      ''
    );
  });
  const [customKeyInput, setCustomKeyInput] = useState<string>('');
  const [isKeyConfigOpen, setIsKeyConfigOpen] = useState<boolean>(false);

  // Search, city filter, and selection
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedOutlet, setSelectedOutlet] = useState<OutletLocation | null>(AUTHORIZED_OUTLETS[0]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Default center at Dhaka, Bangladesh
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: 23.7925,
    lng: 90.4152
  });
  const [mapZoom, setMapZoom] = useState<number>(11);

  // User location marker ref
  const [userMarkerRef] = useAdvancedMarkerRef();

  // Filtered outlets
  const filteredOutlets = useMemo(() => {
    return AUTHORIZED_OUTLETS.filter((outlet) => {
      const matchesCity = selectedCity === 'All' || outlet.city === selectedCity;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        outlet.name.toLowerCase().includes(q) ||
        outlet.bengaliName.toLowerCase().includes(q) ||
        outlet.address.toLowerCase().includes(q) ||
        outlet.city.toLowerCase().includes(q);
      return matchesCity && matchesSearch;
    });
  }, [selectedCity, searchQuery]);

  // Handle location request
  const handleLocateMe = useCallback(() => {
    soundFx.playClick();
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        setUserLocation(coords);
        setMapCenter(coords);
        setMapZoom(13);
        soundFx.playChime();

        // Find nearest outlet
        let nearest: OutletLocation = AUTHORIZED_OUTLETS[0];
        let minDist = Infinity;
        AUTHORIZED_OUTLETS.forEach((o) => {
          const d = Math.hypot(o.lat - coords.lat, o.lng - coords.lng);
          if (d < minDist) {
            minDist = d;
            nearest = o;
          }
        });
        setSelectedOutlet(nearest);
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }, []);

  const handleSelectOutlet = (outlet: OutletLocation) => {
    soundFx.playClick();
    setSelectedOutlet(outlet);
    setMapCenter({ lat: outlet.lat, lng: outlet.lng });
    setMapZoom(14);
  };

  const handleSaveApiKey = () => {
    soundFx.playClick();
    if (customKeyInput.trim()) {
      localStorage.setItem('bg_gmp_api_key', customKeyInput.trim());
      setApiKey(customKeyInput.trim());
      setIsKeyConfigOpen(false);
      soundFx.playChime();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 font-mono animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-5xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-amber-500/40 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20">
              <MapPin className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  অফিসিয়াল আউটলেট ও পার্টনার ম্যাপ
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  GOOGLE MAPS
                </span>
              </div>
              <p className="text-xs text-slate-400">
                নিকটস্থ ক্যাশ কাউন্টার, ভাউচার পয়েন্ট ও সুপার কার ক্লেইম লাউঞ্জ
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playClick();
                setIsKeyConfigOpen(!isKeyConfigOpen);
              }}
              title="Google Maps API Key Settings"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            >
              <Key className="w-4 h-4" />
              <span className="hidden sm:inline">API Key</span>
            </button>
            <button
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API KEY CONFIG ACCORDION (If user wishes to configure their own Google Maps Platform Key) */}
        {isKeyConfigOpen && (
          <div className="p-4 bg-amber-950/20 border-b border-amber-500/30 text-xs text-slate-300 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <span className="font-bold text-amber-300 flex items-center gap-1.5">
                  <Key className="w-4 h-4 text-amber-400" />
                  Google Maps Platform API Key Configuration
                </span>
                <p className="text-[11px] text-slate-400">
                  You can use a production key or generate a free Maps Demo Key for prototyping.
                </p>
              </div>
              <a
                href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 shrink-0"
              >
                <span>Get Demo Key</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customKeyInput}
                onChange={(e) => setCustomKeyInput(e.target.value)}
                placeholder="Enter Google Maps API Key (AIzaSy...)"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-400 outline-none"
              />
              <button
                onClick={handleSaveApiKey}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black rounded-xl hover:from-amber-400 hover:to-yellow-400 transition"
              >
                Save Key
              </button>
            </div>
          </div>
        )}

        {/* MAIN BODY: SPLIT VIEW (MAP + SIDEBAR LIST) */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* MAP CANVAS CONTAINER */}
          <div className="flex-1 relative min-h-[280px] sm:min-h-[400px] bg-slate-950 flex flex-col">
            {apiKey ? (
              <APIProvider apiKey={apiKey} libraries={['marker']}>
                <div className="w-full h-full relative">
                  <Map
                    mapId="DEMO_MAP_ID"
                    center={mapCenter}
                    zoom={mapZoom}
                    onCenterChanged={(ev) => setMapCenter(ev.detail.center)}
                    onZoomChanged={(ev) => setMapZoom(ev.detail.zoom)}
                    gestureHandling="greedy"
                    disableDefaultUI={false}
                    internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                    style={{ width: '100%', height: '100%' }}
                  >
                    {/* Authorized Outlet Markers */}
                    {filteredOutlets.map((outlet) => (
                      <OutletMarkerItem
                        key={outlet.id}
                        outlet={outlet}
                        isSelected={selectedOutlet?.id === outlet.id}
                        onSelect={handleSelectOutlet}
                        onCloseInfo={() => setSelectedOutlet(null)}
                      />
                    ))}

                    {/* User's current location marker if available */}
                    {userLocation && (
                      <AdvancedMarker
                        ref={userMarkerRef}
                        position={userLocation}
                        title="Your Location"
                      >
                        <div className="relative flex items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-sky-400 opacity-75" />
                          <div className="relative w-4 h-4 rounded-full bg-sky-500 border-2 border-white shadow-lg" />
                        </div>
                      </AdvancedMarker>
                    )}
                  </Map>

                  {/* FLOATING QUICK ACTIONS ON MAP */}
                  <div className="absolute top-3 right-3 flex flex-col gap-2 z-10">
                    <button
                      onClick={handleLocateMe}
                      disabled={isLocating}
                      className="px-3 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-900 text-amber-400 border border-amber-500/40 shadow-xl backdrop-blur-md flex items-center gap-2 text-xs font-bold transition hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Locate Nearest Outlet"
                    >
                      <Compass className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                      <span>{isLocating ? 'খোঁজা হচ্ছে...' : 'আমার অবস্থান (Locate Me)'}</span>
                    </button>
                  </div>
                </div>
              </APIProvider>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4 bg-slate-950">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div className="max-w-md space-y-2">
                  <h4 className="text-base font-black text-white">Google Maps API Key প্রয়োজন</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Google Maps Platform প্রদর্শনের জন্য একটি API Key প্রয়োজন। আপনি গুগল ক্লাউড কনসোল বা ফ্রি Maps Demo Key ব্যবহার করতে পারেন।
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={() => setIsKeyConfigOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs hover:from-amber-400 hover:to-yellow-400 transition shadow-lg shadow-amber-500/20 cursor-pointer flex items-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    <span>API Key যুক্ত করুন</span>
                  </button>
                  <a
                    href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <span>ফ্রি ডেমো কি তৈরি করুন</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* SIDEBAR: SEARCH, CITY TABS, & OUTLET CARDS */}
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950 flex flex-col max-h-[350px] lg:max-h-none overflow-hidden">
            {/* SEARCH & FILTER CONTROLS */}
            <div className="p-3.5 border-b border-slate-800 space-y-2.5 bg-slate-900/50">
              {/* Search bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="আউটলেট বা এলাকা খুঁজুন..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 outline-none"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* City Pill Selector */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {['All', 'Dhaka', 'Chittagong', 'Sylhet', 'Kolkata', 'Rajshahi', 'Khulna'].map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      soundFx.playClick();
                      setSelectedCity(city);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                      selectedCity === city
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {city === 'All' ? 'সব শহর' : city}
                  </button>
                ))}
              </div>
            </div>

            {/* LIST OF OUTLETS */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  অনুমোদিত আউটলেট ({filteredOutlets.length})
                </span>
                <span className="text-[10px] text-amber-400 font-bold">
                  24/7 কাস্টমার সহায়তা
                </span>
              </div>

              {filteredOutlets.map((outlet) => {
                const isSelected = selectedOutlet?.id === outlet.id;
                return (
                  <div
                    key={outlet.id}
                    onClick={() => handleSelectOutlet(outlet)}
                    className={`p-3 rounded-2xl border transition cursor-pointer group ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-900 border-amber-400 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                              outlet.type === 'VIP Hub'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : outlet.type === 'Prize Claim'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {outlet.type}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {outlet.city}
                          </span>
                        </div>
                        <h5 className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">
                          {outlet.name}
                        </h5>
                        <p className="text-[11px] text-slate-400">
                          {outlet.bengaliName}
                        </p>
                      </div>
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    </div>

                    <div className="mt-2 text-[10px] text-slate-400 space-y-1 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">{outlet.address}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{outlet.hours}</span>
                      </div>
                    </div>

                    {/* Services Tags */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {outlet.services.map((srv, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] px-1.5 py-0.2 rounded bg-slate-950 text-slate-300 border border-slate-800"
                        >
                          {srv}
                        </span>
                      ))}
                    </div>

                    {/* Action button */}
                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${outlet.lat},${outlet.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 hover:underline"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>দিকনির্দেশনা (Directions)</span>
                      </a>
                      <a
                        href={`tel:${outlet.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{outlet.phone}</span>
                      </a>
                    </div>
                  </div>
                );
              })}

              {filteredOutlets.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-500">
                  কোনো আউটলেট খুঁজে পাওয়া যায়নি।
                </div>
              )}
            </div>

            {/* FOOTER NOTICE */}
            <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Google Maps Platform Integration</span>
              <a
                href="https://cloud.google.com/maps-platform/terms?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline flex items-center gap-0.5"
              >
                <span>Terms of Service</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
