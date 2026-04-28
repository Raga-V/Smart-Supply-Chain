/**
 * LocationSearchInput — Google Places Autocomplete with worldwide geocoding.
 * Falls back to manual lat/lng entry if no API key or if geolocation denied.
 * Supports "Use My Location" via browser geolocation.
 * Falls back to Indian city database when Google Maps not available.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, X, Loader, Navigation, Edit3, Globe } from 'lucide-react';

// Fallback city database for when Google Maps is unavailable
const INDIAN_CITIES = {
  'Mumbai': { lat: 19.0760, lng: 72.8777 },
  'Delhi': { lat: 28.6139, lng: 77.2090 },
  'New Delhi': { lat: 28.6139, lng: 77.2090 },
  'Bangalore': { lat: 12.9716, lng: 77.5946 },
  'Bengaluru': { lat: 12.9716, lng: 77.5946 },
  'Chennai': { lat: 13.0827, lng: 80.2707 },
  'Kolkata': { lat: 22.5726, lng: 88.3639 },
  'Hyderabad': { lat: 17.3850, lng: 78.4867 },
  'Pune': { lat: 18.5204, lng: 73.8567 },
  'Ahmedabad': { lat: 23.0225, lng: 72.5714 },
  'Jaipur': { lat: 26.9124, lng: 75.7873 },
  'Lucknow': { lat: 26.8467, lng: 80.9462 },
  'Surat': { lat: 21.1702, lng: 72.8311 },
  'Nagpur': { lat: 21.1458, lng: 79.0882 },
  'Coimbatore': { lat: 11.0168, lng: 76.9558 },
  'Kochi': { lat: 9.9312, lng: 76.2673 },
  'Bhopal': { lat: 23.2599, lng: 77.4126 },
  'Indore': { lat: 22.7196, lng: 75.8577 },
  'Patna': { lat: 25.5941, lng: 85.1376 },
  'Chandigarh': { lat: 30.7333, lng: 76.7794 },
  'Guwahati': { lat: 26.1445, lng: 91.7362 },
  'Visakhapatnam': { lat: 17.6868, lng: 83.2185 },
  'Thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
  'Mangalore': { lat: 12.9141, lng: 74.8560 },
  'Mysore': { lat: 12.2958, lng: 76.6394 },
  'Madurai': { lat: 9.9252, lng: 78.1198 },
  'Varanasi': { lat: 25.3176, lng: 82.9739 },
  'Agra': { lat: 27.1767, lng: 78.0081 },
  'Nashik': { lat: 19.9975, lng: 73.7898 },
  'Vijayawada': { lat: 16.5062, lng: 80.6480 },
  'Rajkot': { lat: 22.3039, lng: 70.8022 },
  'Vadodara': { lat: 22.3072, lng: 73.1812 },
  'Goa': { lat: 15.2993, lng: 74.1240 },
  'Raipur': { lat: 21.2514, lng: 81.6296 },
  'Ranchi': { lat: 23.3441, lng: 85.3096 },
  'Dehradun': { lat: 30.3165, lng: 78.0322 },
  'Amritsar': { lat: 31.6340, lng: 74.8723 },
};

export default function LocationSearchInput({ value, onChange, placeholder = 'Search any location worldwide…', id, required }) {
  const [query, setQuery]         = useState(value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [open, setOpen]           = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [showManual, setShowManual] = useState(false);
  const [manualLat, setManualLat] = useState(value?.lat || '');
  const [manualLng, setManualLng] = useState(value?.lng || '');
  const [geoError, setGeoError]   = useState('');
  const wrapRef   = useRef(null);
  const debounce  = useRef(null);

  // Init session token once Maps loads
  useEffect(() => {
    const init = () => {
      if (window.google?.maps?.places?.AutocompleteSessionToken) {
        setSessionToken(new window.google.maps.places.AutocompleteSessionToken());
      }
    };
    init();
    const t = setTimeout(init, 1500);
    return () => clearTimeout(t);
  }, []);

  // Close on outside click
  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Sync external value
  useEffect(() => {
    if (value?.name && value.name !== query) setQuery(value.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.name]);

  // Fallback search using Indian city database
  const searchFallbackCities = useCallback((q) => {
    const lower = q.toLowerCase();
    const matches = Object.entries(INDIAN_CITIES)
      .filter(([name]) => name.toLowerCase().includes(lower))
      .slice(0, 6)
      .map(([name, coords]) => ({
        place_id: `fallback_${name}`,
        description: `${name}, India`,
        structured_formatting: {
          main_text: name,
          secondary_text: 'India',
        },
        _fallback: true,
        _coords: coords,
      }));
    return matches;
  }, []);

  const fetchSuggestions = useCallback((q) => {
    if (!q || q.length < 3) { setSuggestions([]); setOpen(false); return; }

    // Try Google Places first
    if (window.google?.maps?.places) {
      setLoading(true);
      const svc = new window.google.maps.places.AutocompleteService();
      svc.getPlacePredictions(
        { input: q, sessionToken, types: [] },
        (results, status) => {
          setLoading(false);
          if (status === 'OK' && results) {
            setSuggestions(results.slice(0, 6));
            setOpen(true);
          } else {
            // Fallback to city database
            const fallback = searchFallbackCities(q);
            setSuggestions(fallback);
            setOpen(fallback.length > 0);
          }
        }
      );
    } else {
      // Google Maps not available — use fallback
      const fallback = searchFallbackCities(q);
      setSuggestions(fallback);
      setOpen(fallback.length > 0);
    }
  }, [sessionToken, searchFallbackCities]);

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    onChange({ name: q, lat: null, lng: null, formatted_address: q });
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchSuggestions(q), 350);
  };

  const selectPlace = (prediction) => {
    setOpen(false);
    setSuggestions([]);

    // Handle fallback city selection
    if (prediction._fallback) {
      const name = prediction.structured_formatting?.main_text || prediction.description;
      setQuery(prediction.description);
      onChange({
        name,
        lat: prediction._coords.lat,
        lng: prediction._coords.lng,
        formatted_address: prediction.description,
      });
      return;
    }

    const name = prediction.structured_formatting?.main_text || prediction.description;
    setQuery(prediction.description);

    if (!window.google?.maps?.Geocoder) {
      // Attempt to find in fallback cities
      const fallback = INDIAN_CITIES[name];
      if (fallback) {
        onChange({ name, lat: fallback.lat, lng: fallback.lng, formatted_address: prediction.description });
      } else {
        onChange({ name, lat: null, lng: null, formatted_address: prediction.description });
      }
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ placeId: prediction.place_id }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        onChange({
          name,
          lat: loc.lat(),
          lng: loc.lng(),
          formatted_address: results[0].formatted_address,
          place_id: prediction.place_id,
        });
        if (window.google?.maps?.places?.AutocompleteSessionToken) {
          setSessionToken(new window.google.maps.places.AutocompleteSessionToken());
        }
      } else {
        onChange({ name, lat: null, lng: null, formatted_address: prediction.description });
      }
    });
  };

  // Use browser geolocation → reverse geocode
  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (!window.google?.maps?.Geocoder) {
          const name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setQuery(name);
          onChange({ name, lat, lng, formatted_address: name });
          setGeoLoading(false);
          return;
        }
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setGeoLoading(false);
          if (status === 'OK' && results[0]) {
            const addr = results[0].formatted_address;
            const shortName = results[0].address_components?.[2]?.long_name ||
                              results[0].address_components?.[1]?.long_name ||
                              addr;
            setQuery(addr);
            onChange({ name: shortName, lat, lng, formatted_address: addr });
          } else {
            const name = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            setQuery(name);
            onChange({ name, lat, lng });
          }
        });
      },
      (err) => {
        setGeoLoading(false);
        if (err.code === 1) {
          setGeoError('Location permission denied. Use the search box or enter coordinates manually.');
          setShowManual(true); // Auto-show manual entry on denial
        } else if (err.code === 2) {
          setGeoError('Position unavailable. Please type a location or enter coordinates.');
        } else {
          setGeoError('Location request timed out. Please type a location.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleManualApply = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) {
      setGeoError('Please enter valid latitude and longitude numbers.');
      return;
    }
    if (lat < -90 || lat > 90) { setGeoError('Latitude must be between -90 and 90.'); return; }
    if (lng < -180 || lng > 180) { setGeoError('Longitude must be between -180 and 180.'); return; }

    const name = query || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    onChange({ name, lat, lng, formatted_address: name });
    setGeoError('');

    // Try reverse geocoding if Google Maps available
    if (window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const addr = results[0].formatted_address;
          const shortName = results[0].address_components?.[2]?.long_name ||
                            results[0].address_components?.[1]?.long_name || addr;
          setQuery(addr);
          onChange({ name: shortName, lat, lng, formatted_address: addr });
        }
      });
    }
  };

  const clear = (e) => {
    e.stopPropagation();
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    setManualLat('');
    setManualLng('');
    setGeoError('');
    onChange({ name: '', lat: null, lng: null });
  };

  return (
    <div className="location-search-wrap" ref={wrapRef}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div className="input-icon-wrap" style={{ position: 'relative', flex: 1 }}>
          <MapPin size={15} className="input-icon" />
          <input
            id={id}
            className="form-input"
            type="text"
            value={query}
            onChange={handleInput}
            onFocus={() => { if (suggestions.length) setOpen(true); }}
            placeholder={placeholder}
            autoComplete="off"
            required={required}
            style={{ paddingRight: query ? '2.5rem' : '0.875rem' }}
          />
          {loading && <Loader size={14} style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', animation:'spin 0.8s linear infinite' }} />}
          {!loading && query && (
            <button onClick={clear} type="button" style={{ position:'absolute', right:'0.75rem', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:0, display:'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>
        {/* Use My Location button */}
        <button
          type="button"
          onClick={useMyLocation}
          disabled={geoLoading}
          title="Use my current location"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 'var(--radius-md)',
            border: '1.5px solid var(--border-color-light)',
            background: geoLoading ? 'var(--bg-tertiary)' : '#fff',
            color: 'var(--accent-primary)', cursor: geoLoading ? 'not-allowed' : 'pointer',
            flexShrink: 0, transition: 'all 0.15s',
          }}
        >
          {geoLoading
            ? <Loader size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
            : <Navigation size={15} />}
        </button>
        {/* Manual coordinates toggle */}
        <button
          type="button"
          onClick={() => setShowManual(!showManual)}
          title="Enter coordinates manually"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 38, height: 38, borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${showManual ? 'var(--accent-primary)' : 'var(--border-color-light)'}`,
            background: showManual ? 'rgba(79,70,229,0.08)' : '#fff',
            color: showManual ? 'var(--accent-primary)' : 'var(--text-muted)',
            cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
          }}
        >
          <Globe size={15} />
        </button>
      </div>

      {/* Geo error message */}
      {geoError && (
        <div style={{ marginTop: '0.375rem', fontSize: '0.6875rem', color: 'var(--risk-high)', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
          ⚠ {geoError}
        </div>
      )}

      {/* Manual coordinate entry */}
      {showManual && (
        <div style={{
          marginTop: '0.5rem', padding: '0.625rem', background: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color-light)',
          display: 'flex', gap: '0.5rem', alignItems: 'flex-end',
        }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Latitude</label>
            <input
              className="form-input"
              type="number"
              step="any"
              value={manualLat}
              onChange={e => setManualLat(e.target.value)}
              placeholder="e.g. 19.0760"
              style={{ marginTop: '0.125rem', fontSize: '0.8125rem' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Longitude</label>
            <input
              className="form-input"
              type="number"
              step="any"
              value={manualLng}
              onChange={e => setManualLng(e.target.value)}
              placeholder="e.g. 72.8777"
              style={{ marginTop: '0.125rem', fontSize: '0.8125rem' }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleManualApply}
            style={{ whiteSpace: 'nowrap', height: 36 }}
          >
            Apply
          </button>
        </div>
      )}

      {open && suggestions.length > 0 && (
        <div className="location-suggestions">
          {suggestions.map(s => (
            <div key={s.place_id} className="location-suggestion-item" onMouseDown={() => selectPlace(s)}>
              <strong style={{ color:'var(--text-primary)' }}>{s.structured_formatting?.main_text}</strong>
              {s.structured_formatting?.secondary_text && (
                <span style={{ color:'var(--text-muted)', marginLeft:'0.375rem', fontSize:'0.75rem' }}>
                  {s.structured_formatting.secondary_text}
                </span>
              )}
              {s._fallback && (
                <span style={{ marginLeft: '0.375rem', fontSize: '0.625rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                  (built-in)
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {/* Show lat/lng badge when resolved */}
      {value?.lat && (
        <div style={{ marginTop: '0.25rem', fontSize: '0.6875rem', color: 'var(--risk-low)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={9} /> Verified: {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
        </div>
      )}
    </div>
  );
}
