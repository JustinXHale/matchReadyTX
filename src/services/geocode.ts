/**
 * Address helpers.
 * Demo: city-stub geocode from composed `homeAddress`.
 * Production: Google Address Validation / Places (street + unit + city/region/postal).
 */

import { demoGeocode } from '@/domain/economics';

export type LatLng = { lat: number; lng: number };

export async function resolveAddressToLatLng(
  address: string,
): Promise<LatLng | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  return demoGeocode(trimmed);
}
