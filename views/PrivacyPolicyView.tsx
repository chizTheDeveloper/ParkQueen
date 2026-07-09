import React from 'react';
import { ChevronLeft } from 'lucide-react';

export const PrivacyPolicyView = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} aria-label="Back" className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Privacy Policy</h1>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-3xl p-5 shadow-xl text-[var(--color-text-secondary)] text-xs space-y-4">
        <h3 className="text-lg font-bold text-[var(--color-text)]">Privacy Policy for ParkQueen</h3>
        <p className="leading-relaxed">
          <strong>Effective Date:</strong> May 11, 2026<br/>
          <strong>Last Updated:</strong> May 11, 2026
        </p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">1. Introduction</h4>
        <p className="leading-relaxed">ParkQueen ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application and services in compliance with the Personal Information Protection and Electronic Documents Act (PIPEDA) in Canada and applicable US state laws.</p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">2. Information We Collect</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li className="leading-relaxed"><strong>Personal Information:</strong> Name, email address, and phone number provided during registration.</li>
          <li className="leading-relaxed"><strong>Geolocation Data:</strong> We collect precise real-time location data to show nearby parking spots and decode signs relevant to your position. This is only collected with your express consent.</li>
          <li className="leading-relaxed"><strong>Visual Data (Photos):</strong> When you use the AI Sign Decoder, we process the images you upload.</li>
          <li className="leading-relaxed"><strong>Peer-to-Peer Data:</strong> Messages between users regarding parking spots and details about private driveways or garages listed for rent.</li>
          <li className="leading-relaxed"><strong>Usage Data:</strong> Information on how you interact with the app, including "pings," searches, and reputation points.</li>
        </ul>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">3. How We Use Your Information</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li className="leading-relaxed"><strong>AI Processing:</strong> Images of parking signs are processed via the Google Gemini API to provide instant "Yes/No" parking verdicts.</li>
          <li className="leading-relaxed"><strong>Predictive Modeling:</strong> Anonymized location and ping data are used to train our internal predictive models to forecast parking availability.</li>
          <li className="leading-relaxed"><strong>Service Delivery:</strong> To facilitate P2P rentals and manage your host dashboard and earnings.</li>
          <li className="leading-relaxed"><strong>Safety & Trust:</strong> To maintain our community reputation system and prevent fraudulent listings.</li>
        </ul>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">4. Data Sharing & Third Parties</h4>
        <p className="leading-relaxed">We do not sell your personal data. We share information only with:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li className="leading-relaxed"><strong>Google Cloud / Gemini API:</strong> For image analysis and AI-generated replies (handled according to Google's Enterprise Privacy standards).</li>
          <li className="leading-relaxed"><strong>Firebase:</strong> For secure data storage, authentication, and real-time database management.</li>
          <li className="leading-relaxed"><strong>Mapbox/Leaflet:</strong> To provide navigation and interactive mapping services.</li>
        </ul>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">5. Your Rights & Choices</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li className="leading-relaxed"><strong>Location Permissions:</strong> You can opt-out of location tracking at any time through your device settings, though this will limit the app's core functionality.</li>
          <li className="leading-relaxed"><strong>Access & Deletion:</strong> Under PIPEDA, you have the right to request access to the personal data we hold or request its permanent deletion from our Firebase servers.</li>
          <li className="leading-relaxed"><strong>Data Portability:</strong> You may request a copy of your listing and transaction history in a machine-readable format.</li>
        </ul>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">6. Data Security & Retention</h4>
        <p className="leading-relaxed">We use industry-standard encryption (AES-256) for data at rest and TLS for data in transit. We retain your personal data only as long as necessary to provide services or as required by law.</p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">7. Changes to This Policy</h4>
        <p className="leading-relaxed">We may update this policy to reflect changes in our AI features or legal requirements. We will notify you of significant changes via in-app notification.</p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">8. Contact Us</h4>
        <p className="leading-relaxed">
          For questions regarding your privacy, please contact our Privacy Officer at:<br/>
          Email: <a href="mailto:privacy@parkqueen.app" className="text-[#38bdf8] hover:underline">privacy@parkqueen.app</a>
        </p>
      </div>
    </div>
  );
};
