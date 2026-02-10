import { Link } from 'react-router-dom';

export function PrivacyPage() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0f0f1a]/80 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/favicon.png" alt="Sonic Journey" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold text-[var(--color-text)]">Sonic Journey</span>
          </Link>
          <a
            href="https://apps.apple.com/app/sonic-journey/id6759010177"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Get the App
          </a>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-text)] mb-2">
          Privacy Policy
        </h1>
        <p className="text-[var(--color-text-muted)] mb-10">
          Last updated: February 10, 2026
        </p>

        <div className="space-y-8 text-[var(--color-text)]/90 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">Overview</h2>
            <p>
              Sonic Journey is developed by Humandalas Ltd. We are committed to protecting your privacy. This privacy policy explains how we handle information when you use the Sonic Journey application ("App") available on the web and iOS App Store.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">Data Collection</h2>
            <p className="mb-3">
              <strong className="text-[var(--color-text)]">We do not collect any personal data.</strong> Sonic Journey is designed to work entirely on your device. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-2 text-[var(--color-text-muted)]">
              <li>We do not collect personal information (name, email, phone number, etc.)</li>
              <li>We do not collect usage analytics or tracking data</li>
              <li>We do not use cookies for tracking purposes</li>
              <li>We do not collect device identifiers or location data</li>
              <li>We do not have user accounts or sign-in functionality</li>
              <li>We do not use third-party analytics, advertising, or tracking SDKs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">How the App Works</h2>
            <p>
              All audio generation in Sonic Journey happens locally on your device using the Web Audio API. Journey presets, saved journeys, and your settings are stored only in your device's local storage (browser localStorage or iOS app sandbox). This data never leaves your device.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">AI Journey Generation</h2>
            <p>
              When you use the "Create Journey with AI" feature, the text description you enter is sent to our server to generate journey parameters. This text is processed in real-time and is not stored, logged, or associated with any identifying information. No personal data is transmitted with these requests.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">Bass Track Generator</h2>
            <p>
              When you use the Bass Track Generator feature, audio files you upload are sent to our server for processing. These files are processed in real-time, stored temporarily during processing, and automatically deleted afterward. We do not retain or analyze your audio files.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">Third-Party Services</h2>
            <p>
              The iOS version of Sonic Journey is distributed through the Apple App Store. Apple may collect certain data as part of their App Store services. Please refer to <a href="https://www.apple.com/legal/privacy/" className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer">Apple's Privacy Policy</a> for more information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">Data Storage</h2>
            <p>
              All user-generated content (saved journeys, preferences) is stored locally on your device. If you clear your browser data or uninstall the app, this data will be permanently deleted. We have no ability to recover locally stored data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">Children's Privacy</h2>
            <p>
              Sonic Journey does not knowingly collect any information from children under the age of 13. The App is rated 9+ on the App Store.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">Changes to This Policy</h2>
            <p>
              We may update this privacy policy from time to time. Any changes will be posted on this page with an updated revision date. Continued use of the App after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-[var(--color-text)] mb-3">Contact</h2>
            <p>
              If you have questions about this privacy policy, please contact us at:
            </p>
            <p className="mt-2">
              <strong className="text-[var(--color-text)]">Humandalas Ltd</strong>
              <br />
              <a href="mailto:me@dnalevity.com" className="text-[var(--color-primary)] hover:underline">
                me@dnalevity.com
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-[var(--color-text-muted)]">
            &copy; 2026 Humandalas Ltd. All rights reserved.
          </span>
          <div className="flex items-center gap-6">
            <Link to="/" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Home
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
