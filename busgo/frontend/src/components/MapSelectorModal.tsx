import { useState, useEffect, useRef } from "react";
import { Search, MapPin, X, Loader2, Compass } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (point: { name: string; address: string; lat: number; lng: number }) => void;
  initialValue?: { name: string; address: string; lat: number; lng: number };
  variant?: "boarding" | "dropping";
}

export function MapSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  initialValue,
  variant = "boarding",
}: MapSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<{
    name: string;
    address: string;
    lat: number;
    lng: number;
  } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const isBoarding = variant === "boarding";
  const themeColor = isBoarding ? "emerald" : "orange";

  // Bangladesh bounds/center
  const BD_CENTER: [number, number] = [23.6850, 90.3563];
  const INITIAL_ZOOM = 7;

  // Initialize selected point from initialValue
  useEffect(() => {
    if (initialValue && initialValue.name) {
      setSelectedPoint(initialValue);
    } else {
      setSelectedPoint(null);
    }
  }, [initialValue, isOpen]);

  // Handle Search using OpenStreetMap Nominatim Geocoding API
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);
    try {
      // Limit search to Bangladesh by adding countrycode=bd
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        searchQuery
      )}&format=json&limit=5&addressdetails=1&countrycodes=bd`;
      
      const response = await fetch(url, {
        headers: {
          "Accept-Language": "en",
        },
      });
      const data = await response.json();
      setSearchResults(data);
    } catch (err) {
      console.error("Geocoding search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  // Reverse Geocoding when user clicks on map
  const performReverseGeocode = async (lat: number, lng: number): Promise<{ name: string; address: string }> => {
    setLoading(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
      const response = await fetch(url, {
        headers: {
          "Accept-Language": "en",
        },
      });
      const data = await response.json();
      
      const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const name = data.name || 
                   data.address.amenity || 
                   data.address.road || 
                   data.address.suburb || 
                   data.address.city || 
                   "Selected Location";
      
      return { name, address };
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
      return { name: "Selected Location", address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    } finally {
      setLoading(false);
    }
  };

  // Move marker and map view to a specific location
  const selectLocation = (lat: number, lng: number, name: string, address: string, zoom: number = 15) => {
    setSelectedPoint({ name, address, lat, lng });
    
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], zoom);
      
      // Update Marker
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const svgIcon = L.divIcon({
          html: `<div class="text-${themeColor}-600 filter drop-shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5" class="w-8 h-8">
              <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3" fill="white"/>
            </svg>
          </div>`,
          className: "custom-div-icon",
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });
        
        markerRef.current = L.marker([lat, lng], { icon: svgIcon }).addTo(mapRef.current);
      }
    }
  };

  // Click on search result item
  const handleResultClick = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    
    // Extract readable name & address
    const name = result.name || result.display_name.split(",")[0] || "Selected Location";
    const address = result.display_name;
    
    selectLocation(lat, lng, name, address, 15);
    setSearchResults([]);
    setSearchQuery("");
  };

  // Initialize Map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    // Destroy existing map if any
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }

    // Initialize Map Instance
    const map = L.map(mapContainerRef.current, {
      center: selectedPoint ? [selectedPoint.lat, selectedPoint.lng] : BD_CENTER,
      zoom: selectedPoint ? 14 : INITIAL_ZOOM,
      zoomControl: false,
    });
    
    mapRef.current = map;

    // Add Zoom Control to bottom-right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Add Tile Layer (OpenStreetMap)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Drop Marker if initial point is present
    if (selectedPoint) {
      const svgIcon = L.divIcon({
        html: `<div class="text-${themeColor}-600 filter drop-shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="white" stroke-width="1.5" class="w-8 h-8">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3" fill="white"/>
          </svg>
        </div>`,
        className: "custom-div-icon",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      markerRef.current = L.marker([selectedPoint.lat, selectedPoint.lng], { icon: svgIcon }).addTo(map);
    }

    // Map Click Handler: Click on map to place pin
    map.on("click", async (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Plop marker immediately
      selectLocation(lat, lng, "Loading location name...", "Reverse geocoding coordinates...", map.getZoom());
      
      // Perform Reverse Geocoding
      const geoData = await performReverseGeocode(lat, lng);
      
      // Update with final name and address
      selectLocation(lat, lng, geoData.name, geoData.address, map.getZoom());
    });

    // Cleanup map on unmount/close
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  // Adjust map size on container resize / load
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 200);
    }
  }, [isOpen, searchResults]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-99 flex items-center justify-center p-4 bg-surface-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-elevation-3 overflow-hidden flex flex-col h-[85vh] animate-scale-in">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-lg text-surface-900 flex items-center gap-2">
              <Compass className={`w-5 h-5 text-${themeColor}-600`} />
              Choose {isBoarding ? "Boarding" : "Dropping"} Point on Map
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Search any place in Bangladesh or click anywhere on the map to set a precise terminal point.
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 hover:bg-surface-50 rounded-xl text-surface-400 hover:text-surface-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* Map Area */}
          <div className="flex-1 h-full relative min-h-[300px]">
            <div ref={mapContainerRef} className="w-full h-full z-10" />
            
            {/* Float Search Bar */}
            <div className="absolute top-4 left-4 right-4 z-20 max-w-md bg-white rounded-2xl shadow-lg border border-surface-100 p-2 flex flex-col gap-1.5">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search place, city, counter name..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-surface-200 text-sm focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 transition-all"
                  />
                  {searchQuery && (
                    <button 
                      type="button" 
                      onClick={() => setSearchQuery("")} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-surface-50 rounded text-surface-400"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className={`btn-primary px-4 py-2.5 flex items-center justify-center gap-1.5 text-sm shrink-0`}
                >
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </button>
              </form>

              {/* Search Results List */}
              {searchResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto border-t border-surface-100 pt-2 flex flex-col divide-y divide-surface-50 bg-white">
                  {searchResults.map((result, idx) => (
                    <button
                      key={`res-${idx}`}
                      type="button"
                      onClick={() => handleResultClick(result)}
                      className="w-full text-left px-3 py-2.5 hover:bg-surface-50 flex items-start gap-2.5 transition-colors text-xs first:rounded-t-lg last:rounded-b-lg"
                    >
                      <MapPin className={`w-4 h-4 shrink-0 mt-0.5 text-${themeColor}-500`} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-surface-900 truncate">
                          {result.name || result.display_name.split(",")[0]}
                        </p>
                        <p className="text-[10px] text-surface-500 mt-0.5 truncate">
                          {result.display_name}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Side Info Panel */}
          <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-surface-100 p-5 flex flex-col bg-surface-50">
            <h4 className="font-bold text-sm text-surface-950 mb-3 flex items-center gap-1.5">
              <MapPin className={`w-4.5 h-4.5 text-${themeColor}-600`} /> Location Details
            </h4>
            
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-xs text-surface-500">
                <Loader2 className="w-6 h-6 animate-spin text-brand-600 mb-2" />
                <span>Geocoding coordinates...</span>
              </div>
            ) : selectedPoint ? (
              <div className="flex-1 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-2xl border border-surface-150 shadow-sm flex flex-col gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wide">Point Name</label>
                    <input
                      type="text"
                      value={selectedPoint.name}
                      onChange={(e) => setSelectedPoint({ ...selectedPoint, name: e.target.value })}
                      placeholder="e.g. Sayedabad Counter A"
                      className="w-full mt-1 px-3 py-2 border border-surface-200 rounded-xl text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-surface-400 uppercase tracking-wide">Detailed Address</label>
                    <textarea
                      value={selectedPoint.address}
                      onChange={(e) => setSelectedPoint({ ...selectedPoint, address: e.target.value })}
                      placeholder="Enter detailed landmarks or roads..."
                      rows={3}
                      className="w-full mt-1 px-3 py-2 border border-surface-200 rounded-xl text-xs focus:outline-none focus:border-brand-500 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-surface-500 pt-1 border-t border-surface-50">
                    <div>
                      <span className="font-semibold text-surface-400 block">Latitude</span>
                      <code className="text-xs font-mono">{selectedPoint.lat.toFixed(5)}</code>
                    </div>
                    <div>
                      <span className="font-semibold text-surface-400 block">Longitude</span>
                      <code className="text-xs font-mono">{selectedPoint.lng.toFixed(5)}</code>
                    </div>
                  </div>
                </div>
                
                <p className="text-[10px] text-surface-400 text-center leading-relaxed">
                  You can edit the Name and Address values directly in the fields above if you want to make them shorter or more descriptive before saving.
                </p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center text-xs text-surface-400">
                <MapPin className="w-10 h-10 stroke-1 mb-2 opacity-40 text-surface-500" />
                <p className="px-4">No point selected yet. Click on the map or search to pick a counter point.</p>
              </div>
            )}
            
            {/* Footer Buttons */}
            <div className="mt-5 pt-4 border-t border-surface-200 flex flex-col gap-2 shrink-0">
              <button
                type="button"
                onClick={() => selectedPoint && onConfirm(selectedPoint)}
                disabled={!selectedPoint || loading}
                className={`btn-primary w-full py-2.5 text-xs font-bold ${
                  !selectedPoint || loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                Confirm Counter Point
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary w-full py-2.5 text-xs font-bold text-center border border-surface-200 text-surface-700 hover:bg-surface-100"
              >
                Cancel
              </button>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
