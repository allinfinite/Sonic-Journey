# Sonic Journey Creator

A web application for creating therapeutic vibroacoustic audio journeys with live playback and export to WAV/MP3.

## Features

- **Live Playback**: Real-time audio synthesis using Web Audio API
- **Visual Timeline**: Interactive canvas-based journey visualization
- **Phase Editor**: Adjust frequency, amplitude, rhythm, and modulation
- **Multiple Layers**: Foundation, Harmony, and Atmosphere audio layers
- **Entrainment Patterns**: Breathing, heartbeat, theta, and alpha wave patterns
- **Export to WAV/MP3**: Client-side audio rendering and encoding
- **Preset Library**: 16 pre-designed therapeutic journeys

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Development

The app runs at `http://localhost:5173` in development mode.

## Architecture

This is a fully client-side application with no backend required. All audio synthesis and encoding happens in the browser.

### Key Technologies

- **Vite** - Build tool and dev server
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Zustand** - State management
- **Tailwind CSS v4** - Styling
- **Web Audio API** - Real-time synthesis
- **OfflineAudioContext** - Export rendering
- **lamejs** - MP3 encoding

### Project Structure

```
src/
├── audio/
│   ├── SynthEngine.ts      # Real-time playback engine
│   ├── OfflineRenderer.ts  # Export rendering
│   ├── Oscillator.ts       # FM synthesis, entrainment
│   ├── Envelope.ts         # Amplitude envelopes
│   ├── SafetyProcessor.ts  # Limiting, normalization
│   └── encoders/
│       ├── wav.ts          # WAV file encoding
│       └── mp3.ts          # MP3 encoding via lamejs
├── components/
│   ├── Timeline/           # Canvas-based visualization
│   ├── Controls/           # Phase parameter sliders
│   ├── Transport/          # Play/pause/stop bar
│   ├── PresetBrowser/      # Journey preset library
│   └── ExportDialog/       # Export options & progress
├── stores/
│   └── journeyStore.ts     # Zustand state management
├── presets/                # JSON journey configurations
├── types/
│   └── journey.ts          # TypeScript interfaces
└── App.tsx                 # Main application
```

## Usage

1. **Browse Journeys**: Click "Browse Journeys" to load a preset
2. **Edit Phases**: Click phase tabs to select, adjust sliders to modify
3. **Play**: Click the play button for live preview
4. **Export**: Click "Export" to render to WAV or MP3

## Vibroacoustic Audio

This app generates low-frequency audio (28-90 Hz) optimized for vibroacoustic therapy systems. The audio is designed to be felt through transducer-based systems rather than just heard.

### Safety Features

- Maximum RMS limiting (-12 dB)
- True peak limiting (-1 dB) 
- Bandpass filtering (20-120 Hz)
- Fade in/out to prevent clicks
- No harsh transients

## Deployment

The built app (`dist/` folder) can be deployed to any static hosting:

- Vercel
- Netlify
- GitHub Pages
- Any CDN/static host

No server-side code required.

## License

MIT
