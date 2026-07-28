/**
 * Build a URL that opens the venue in the device maps / navigation app.
 * Uses Google Maps directions; mobile browsers hand off to the installed maps app.
 */

export function mapsDirectionsUrl(opts: {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}): string | null {
  const { address, lat, lng } = opts;
  // Prefer coordinates, then street/venue address only — do not append
  // venue/team names (abbrs like "UNT" skew Maps away from the real field).
  let destination: string;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    destination = `${lat},${lng}`;
  } else if (address?.trim()) {
    destination = address.trim();
  } else {
    return null;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}
