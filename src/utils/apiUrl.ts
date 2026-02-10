/**
 * Centralized API URL resolution for native (Capacitor) and web contexts.
 *
 * In a Capacitor iOS app, window.location.origin returns "capacitor://localhost"
 * which cannot reach the Vercel API. We detect this and point to the private API.
 *
 * The public domain (journey.dnalevity.com) is a promo landing page.
 * The API lives at the Vercel project URL (sonic-journey.vercel.app).
 */
import { Capacitor } from '@capacitor/core';

const API_URL = 'https://sonic-journey.vercel.app';

export function getApiUrl(): string {
  // Explicit env var (highest priority)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Runtime override
  if (typeof window !== 'undefined' && (window as any).__API_URL__) {
    return (window as any).__API_URL__;
  }

  // Native app — use private Vercel deployment URL
  if (Capacitor.isNativePlatform()) {
    return API_URL;
  }

  // Web production — same origin (Vercel API routes)
  if (import.meta.env.PROD) {
    return window.location.origin;
  }

  // Development fallback
  return 'http://localhost:3002';
}
