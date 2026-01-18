#!/usr/bin/env node
/**
 * Script to add melody_layer and melody configuration to all preset JSON files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const presetsDir = path.join(__dirname, '..', 'src', 'presets');

// Get melody style based on phase characteristics
function getMelodyStyle(phase) {
  const rhythmMode = phase.rhythm_mode || phase.entrainment_mode || 'breathing';
  const phaseName = (phase.name || '').toLowerCase();
  
  // Deep/meditative phases
  if (rhythmMode === 'theta' || rhythmMode === 'delta' || 
      phaseName.includes('deep') || phaseName.includes('rest') || 
      phaseName.includes('sleep') || phaseName.includes('settle')) {
    return 'drone';
  }
  
  // Active/energizing phases
  if (rhythmMode === 'alpha' || rhythmMode === 'beta' || 
      phaseName.includes('engage') || phaseName.includes('flow') || 
      phaseName.includes('peak') || phaseName.includes('rise')) {
    return 'arpeggio';
  }
  
  // Transition phases
  if (phaseName.includes('wind') || phaseName.includes('return') || 
      phaseName.includes('integration') || phaseName.includes('grounding')) {
    return 'mixed';
  }
  
  // Default to evolving for dynamic phases
  return 'evolving';
}

// Get melody scale based on phase mood
function getMelodyScale(phase) {
  const rhythmMode = phase.rhythm_mode || phase.entrainment_mode || 'breathing';
  const phaseName = (phase.name || '').toLowerCase();
  
  // Minor scales for deeper/meditative phases
  if (rhythmMode === 'theta' || rhythmMode === 'delta' || 
      phaseName.includes('deep') || phaseName.includes('rest')) {
    return 'pentatonic_minor';
  }
  
  // Major scales for uplifting/energizing phases
  return 'pentatonic_major';
}

// Get melody intensity based on phase amplitude
function getMelodyIntensity(phase) {
  const avgAmp = ((phase.amplitude?.start || 0) + (phase.amplitude?.end || 0)) / 2;
  // Scale amplitude (0-0.8) to melody intensity (0.2-0.4)
  return Math.max(0.2, Math.min(0.4, avgAmp * 0.5));
}

// Get melody density based on phase rhythm
function getMelodyDensity(phase) {
  const rhythmMode = phase.rhythm_mode || phase.entrainment_mode || 'breathing';
  
  if (rhythmMode === 'theta' || rhythmMode === 'delta') {
    return 'sparse';
  }
  if (rhythmMode === 'alpha' || rhythmMode === 'beta') {
    return 'moderate';
  }
  return 'sparse';
}

// Process a single preset file
function processPreset(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const preset = JSON.parse(content);
  
  let modified = false;
  
  // Add melody_layer to layers if not present
  if (!preset.layers) {
    preset.layers = {};
  }
  if (preset.layers.melody_layer === undefined) {
    preset.layers.melody_layer = true;
    modified = true;
  }
  
  // Add melody config to each phase
  if (preset.phases && Array.isArray(preset.phases)) {
    preset.phases.forEach((phase) => {
      if (phase.melody_enabled === undefined) {
        phase.melody_enabled = true;
        phase.melody_style = getMelodyStyle(phase);
        phase.melody_scale = getMelodyScale(phase);
        phase.melody_intensity = getMelodyIntensity(phase);
        phase.melody_density = getMelodyDensity(phase);
        modified = true;
      }
    });
  }
  
  if (modified) {
    // Write back with proper formatting
    fs.writeFileSync(filePath, JSON.stringify(preset, null, 2) + '\n', 'utf8');
    console.log(`Updated: ${path.basename(filePath)}`);
    return true;
  }
  
  return false;
}

// Main execution
const files = fs.readdirSync(presetsDir)
  .filter(f => f.endsWith('.json') && f !== 'index.json')
  .map(f => path.join(presetsDir, f));

let updatedCount = 0;
files.forEach(filePath => {
  if (processPreset(filePath)) {
    updatedCount++;
  }
});

console.log(`\nUpdated ${updatedCount} preset files.`);
