/**
 * Browser storage utilities for saving and loading journeys
 */

import type { JourneyConfig } from '../types/journey';

const STORAGE_KEY = 'sonic-journey-saved-journeys';
const MAX_SAVED_JOURNEYS = 50;

export interface SavedJourney {
  id: string;
  journey: JourneyConfig;
  createdAt: number;
  updatedAt: number;
}

/**
 * Get all saved journeys from localStorage
 */
export function getSavedJourneys(): SavedJourney[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error loading saved journeys:', error);
    return [];
  }
}

/**
 * Save a journey to localStorage
 */
export function saveJourney(journey: JourneyConfig): string {
  const saved = getSavedJourneys();
  const id = `custom-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const now = Date.now();
  
  const savedJourney: SavedJourney = {
    id,
    journey,
    createdAt: now,
    updatedAt: now,
  };
  
  // Add to beginning of array
  saved.unshift(savedJourney);
  
  // Limit to MAX_SAVED_JOURNEYS
  if (saved.length > MAX_SAVED_JOURNEYS) {
    saved.splice(MAX_SAVED_JOURNEYS);
  }
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    return id;
  } catch (error) {
    console.error('Error saving journey:', error);
    throw new Error('Failed to save journey to browser storage');
  }
}

/**
 * Update an existing saved journey
 */
export function updateSavedJourney(id: string, journey: JourneyConfig): void {
  const saved = getSavedJourneys();
  const index = saved.findIndex((j) => j.id === id);
  
  if (index === -1) {
    throw new Error('Journey not found');
  }
  
  saved[index] = {
    ...saved[index],
    journey,
    updatedAt: Date.now(),
  };
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch (error) {
    console.error('Error updating journey:', error);
    throw new Error('Failed to update journey');
  }
}

/**
 * Delete a saved journey
 */
export function deleteSavedJourney(id: string): void {
  const saved = getSavedJourneys();
  const filtered = saved.filter((j) => j.id !== id);
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting journey:', error);
    throw new Error('Failed to delete journey');
  }
}

/**
 * Get a specific saved journey by ID
 */
export function getSavedJourney(id: string): SavedJourney | undefined {
  const saved = getSavedJourneys();
  return saved.find((j) => j.id === id);
}

/**
 * Check if a journey is already saved (by name and duration)
 */
export function findExistingJourney(journey: JourneyConfig): SavedJourney | undefined {
  const saved = getSavedJourneys();
  return saved.find(
    (s) =>
      s.journey.name === journey.name &&
      s.journey.duration_minutes === journey.duration_minutes
  );
}
