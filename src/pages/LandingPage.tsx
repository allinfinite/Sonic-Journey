import { Link } from 'react-router-dom';

const features = [
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 18v-6a9 9 0 0118 0v6" />
        <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
      </svg>
    ),
    title: '48 Therapeutic Journeys',
    description: 'Expertly crafted presets for relaxation, focus, sleep, meditation, energy, and healing.',
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    title: 'Custom Journey Builder',
    description: 'Design your own multi-phase journeys with precise frequency, amplitude, and rhythm control.',
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2v20M2 12h20" />
        <path d="M12 2a10 10 0 0110 10" />
        <path d="M12 2a10 10 0 00-10 10" />
      </svg>
    ),
    title: 'AI Journey Generation',
    description: 'Describe your desired experience and let AI craft the perfect therapeutic sound journey.',
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 10s3-3 5-3 5 5 7 5 5-3 5-3V3s-3 3-5 3-5-5-7-5-5 3-5 3z" />
        <path d="M2 22s3-3 5-3 5 5 7 5 5-3 5-3v-7s-3 3-5 3-5-5-7-5-5 3-5 3z" />
      </svg>
    ),
    title: 'Binaural Beats',
    description: 'Built-in binaural beat engine with adjustable carrier frequency, beat frequency, and waveforms.',
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    ),
    title: 'Export WAV & MP3',
    description: 'Export your journeys as high-quality audio files for offline playback on any device.',
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
        <path d="M19 10v2a7 7 0 01-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
    title: 'Listen Mode',
    description: 'Plays your own music and Sonic Journey adds a therapeutic bass layer that follows the key and tempo in real-time.',
  },
  {
    icon: (
      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <circle cx="15.5" cy="8.5" r="1.5" />
        <circle cx="8.5" cy="15.5" r="1.5" />
        <circle cx="15.5" cy="15.5" r="1.5" />
      </svg>
    ),
    title: 'Bass Pad & Generator',
    description: 'Interactive touch pad and AI bass track generator for vibroacoustic tables.',
  },
];

const categories = [
  { emoji: '🌊', name: 'Relaxation & Calm' },
  { emoji: '🧘', name: 'Deep Meditation' },
  { emoji: '🌿', name: 'Grounding & Stability' },
  { emoji: '☀️', name: 'Energy & Uplift' },
  { emoji: '🎯', name: 'Focus & Clarity' },
  { emoji: '🌙', name: 'Sleep & Rest' },
  { emoji: '💜', name: 'Emotional Release' },
  { emoji: '✨', name: 'Bliss & Joy' },
  { emoji: '🔮', name: 'Therapeutic Sessions' },
  { emoji: '💗', name: 'Intimacy & Connection' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0f0f1a]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Sonic Journey" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold text-[var(--color-text)]">Sonic Journey</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/privacy"
              className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors hidden sm:block"
            >
              Privacy
            </Link>
            <a
              href="https://apps.apple.com/app/sonic-journey/id6759010177"
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Get the App
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--color-primary)]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-[var(--color-accent)]/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/20 text-[var(--color-primary)] text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
            Vibroacoustic Sound Therapy
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-[var(--color-text)] mb-6 leading-tight tracking-tight">
            Transform Your
            <br />
            <span className="bg-gradient-to-r from-[var(--color-primary)] via-purple-400 to-[var(--color-accent)] bg-clip-text text-transparent">
              Sound Experience
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto mb-10 leading-relaxed">
            48 expertly crafted therapeutic sound journeys for deep relaxation, focused meditation, restful sleep, and holistic wellness. Powered by real-time audio synthesis and brainwave entrainment.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://apps.apple.com/app/sonic-journey/id6759010177"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-[var(--color-primary)]/25 flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Download on the App Store
            </a>
          </div>
        </div>
      </section>

      {/* Categories Strip */}
      <section className="py-12 px-4 sm:px-6 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-wrap justify-center gap-3">
            {categories.map((cat) => (
              <span
                key={cat.name}
                className="px-4 py-2 rounded-full bg-[var(--color-surface-light)]/50 text-sm text-[var(--color-text-muted)] border border-white/5"
              >
                {cat.emoji} {cat.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-4">
              Everything You Need for Sound Therapy
            </h2>
            <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
              Professional-grade vibroacoustic tools in a beautiful, intuitive interface.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-2xl bg-[var(--color-surface)]/50 border border-white/5 hover:border-[var(--color-primary)]/20 transition-colors group"
              >
                <div className="w-14 h-14 rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center mb-4 group-hover:bg-[var(--color-primary)]/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-text)] mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 px-4 sm:px-6 bg-[var(--color-surface)]/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-4">
              Sound Science, Made Simple
            </h2>
            <p className="text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
              Each journey uses carefully tuned frequencies and modulation patterns based on established principles of sound therapy and brainwave entrainment.
            </p>
          </div>

          <div className="space-y-8">
            {[
              {
                step: '01',
                title: 'Choose Your Journey',
                description: 'Browse 48 curated presets or create a custom journey with AI. Each is designed for a specific therapeutic purpose.',
              },
              {
                step: '02',
                title: 'Customize & Play',
                description: 'Fine-tune frequency, amplitude, rhythm patterns, and binaural beats. Hit play for real-time audio synthesis.',
              },
              {
                step: '03',
                title: 'Relax & Heal',
                description: 'Let the therapeutic sound guide you through multi-phase journeys. Background audio keeps playing even when you lock your screen.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="flex items-start gap-6 p-6 rounded-2xl bg-[var(--color-surface)]/50 border border-white/5"
              >
                <div className="text-3xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--color-text)] mb-1">
                    {item.title}
                  </h3>
                  <p className="text-[var(--color-text-muted)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[var(--color-primary)]/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-4">
            Begin Your Sonic Journey
          </h2>
          <p className="text-lg text-[var(--color-text-muted)] mb-8">
            Available exclusively on iOS. No subscription, no ads — just pure therapeutic sound.
          </p>
          <a
            href="https://apps.apple.com/app/sonic-journey/id6759010177"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white font-semibold text-lg hover:opacity-90 transition-opacity shadow-lg shadow-[var(--color-primary)]/25"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            $9.99 on the App Store
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="Sonic Journey" className="w-6 h-6 rounded" />
            <span className="text-sm text-[var(--color-text-muted)]">
              &copy; 2026 Humandalas Ltd. All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Privacy Policy
            </Link>
            <a href="https://apps.apple.com/app/sonic-journey/id6759010177" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              App Store
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
