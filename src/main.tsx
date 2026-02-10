import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { LandingPage } from './pages/LandingPage.tsx'
import { PrivacyPage } from './pages/PrivacyPage.tsx'
import { Capacitor } from '@capacitor/core';

// Initialize native platform features
if (Capacitor.isNativePlatform()) {
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark });
  });
  import('@capacitor/splash-screen').then(({ SplashScreen }) => {
    SplashScreen.hide();
  });
}

// On native iOS, skip the landing page and go straight to the app
const isNative = Capacitor.isNativePlatform();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isNative ? (
      <App />
    ) : (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/app" element={<App />} />
          <Route path="/privacy" element={<PrivacyPage />} />
        </Routes>
      </BrowserRouter>
    )}
  </StrictMode>,
)
