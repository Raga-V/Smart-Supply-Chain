/**
 * LocationSearchInput — Google Places Autocomplete with worldwide geocoding.
 * Falls back to manual lat/lng entry if no API key.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, X, Loader } from 'lucide-react';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function LocationSearchInput({ value, onChange, placeholder = 'Search any location worldwide…', id, required }) {
  const [query, setQuery]         = useState(value?.name || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [open, setOpen]           = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const wrapRef   = useRef(null);
  const debounce  = useRef(null);

  // Init session token once Maps loads
  useEffect(() => {
    if (window.google?.maps?.places?.AutocompleteSessionToken) {
      setSessionToken(new window.google.maps.places.AutocompleteSessionToken());
    }
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
  }, [value?.name]);

  const fetchSuggestions = useCallback((q) => {
    if (!q || q.length < 3) { setSuggestions([]); setOpen(false); return; }
    if (!window.google?.maps?.places) {
      // Fallback: return nothing — user can still type any free text
      setSuggestions([]);
      return;
    }

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
          setSuggestions([]);
        }
      }
    );
  }, [sessionToken]);

  const handleInput = (e) => {
    const q = e.target.value;
    setQuery(q);
    // Immediately propagate as free text (lat/lng = null until selected)
    onChange({ name: q, lat: null, lng: null, formatted_address: q });
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchSuggestions(q), 350);
  };

  const selectPlace = (prediction) => {
    setOpen(false);
    const name = prediction.structured_formatting?.main_text || prediction.description;
    setQuery(prediction.description);
    setSuggestions([]);

    // Geocode to get lat/lng
    if (!window.google?.maps?.Geocoder) {
      onChange({ name, lat: null, lng: null, formatted_address: prediction.description });
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
        // Reset session token after selection
        if (window.google?.maps?.places?.AutocompleteSessionToken) {
          setSessionToken(new window.google.maps.places.AutocompleteSessionToken());
        }
      } else {
        onChange({ name, lat: null, lng: null, formatted_address: prediction.description });
      }
    });
  };

  const clear = (e) => {
    e.stopPropagation();
    setQuery('');
    setSuggestions([]);
    setOpen(false);
    onChange({ name: '', lat: null, lng: null });
  };

  return (
    <div className="location-search-wrap" ref={wrapRef}>
      <div className="input-icon-wrap" style={{ position: 'relative' }}>
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
