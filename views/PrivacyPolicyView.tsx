import React from 'react';
import { ChevronLeft } from 'lucide-react';

export const PrivacyPolicyView = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="bg-gray-100 dark:bg-dark-900 font-sans text-gray-800 dark:text-white min-h-full">
      <div className="bg-white dark:bg-dark-800 shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Privacy Policy</h1>
        </div>
      </div>
      <div className="p-6">
        <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 max-w-none">
          <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Privacy Policy for ParkQueen</h3>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
            <strong>Effective Date:</strong> May 11, 2026<br/>
            <strong>Last Updated:</strong> May 11, 2026
          </p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">1. Introduction</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">ParkQueen ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application and services in compliance with the Personal Information Protection and Electronic Documents Act (PIPEDA) in Canada and applicable US state laws.</p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">2. Information We Collect</h4>
          <ul className="list-disc pl-6 space-y-3 mb-6 text-gray-600 dark:text-gray-300">
            <li className="leading-relaxed"><strong>Personal Information:</strong> Name, email address, and phone number provided during registration.</li>
            <li className="leading-relaxed"><strong>Geolocation Data:</strong> We collect precise real-time location data to show nearby parking spots and decode signs relevant to your position. This is only collected with your express consent.</li>
            <li className="leading-relaxed"><strong>Visual Data (Photos):</strong> When you use the AI Sign Decoder, we process the images you upload.</li>
            <li className="leading-relaxed"><strong>Peer-to-Peer Data:</strong> Messages between users regarding parking spots and details about private driveways or garages listed for rent.</li>
            <li className="leading-relaxed"><strong>Usage Data:</strong> Information on how you interact with the app, including "pings," searches, and reputation points.</li>
          </ul>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">3. How We Use Your Information</h4>
          <ul className="list-disc pl-6 space-y-3 mb-6 text-gray-600 dark:text-gray-300">
            <li className="leading-relaxed"><strong>AI Processing:</strong> Images of parking signs are processed via the Google Gemini API to provide instant "Yes/No" parking verdicts.</li>
            <li className="leading-relaxed"><strong>Predictive Modeling:</strong> Anonymized location and ping data are used to train our internal predictive models to forecast parking availability.</li>
            <li className="leading-relaxed"><strong>Service Delivery:</strong> To facilitate P2P rentals and manage your host dashboard and earnings.</li>
            <li className="leading-relaxed"><strong>Safety & Trust:</strong> To maintain our community reputation system and prevent fraudulent listings.</li>
          </ul>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">4. Data Sharing & Third Parties</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">We do not sell your personal data. We share information only with:</p>
          <ul className="list-disc pl-6 space-y-3 mb-6 text-gray-600 dark:text-gray-300">
            <li className="leading-relaxed"><strong>Google Cloud / Gemini API:</strong> For image analysis and AI-generated replies. (Note: Data sent to these services is handled according to Google's Enterprise Privacy standards).</li>
            <li className="leading-relaxed"><strong>Firebase:</strong> For secure data storage, authentication, and real-time database management.</li>
            <li className="leading-relaxed"><strong>Mapbox/Leaflet:</strong> To provide navigation and interactive mapping services.</li>
          </ul>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">5. Your Rights & Choices</h4>
          <ul className="list-disc pl-6 space-y-3 mb-6 text-gray-600 dark:text-gray-300">
            <li className="leading-relaxed"><strong>Location Permissions:</strong> You can opt-out of location tracking at any time through your device settings, though this will limit the app's core functionality.</li>
            <li className="leading-relaxed"><strong>Access & Deletion:</strong> Under PIPEDA, you have the right to request access to the personal data we hold or request its permanent deletion from our Firebase servers.</li>
            <li className="leading-relaxed"><strong>Data Portability:</strong> You may request a copy of your listing and transaction history in a machine-readable format.</li>
          </ul>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">6. Data Security & Retention</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">We use industry-standard encryption (AES-256) for data at rest and TLS for data in transit. We retain your personal data only as long as necessary to provide services or as required by law.</p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">7. Changes to This Policy</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">We may update this policy to reflect changes in our AI features or legal requirements. We will notify you of significant changes via in-app notification.</p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">8. Contact Us</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            For questions regarding your privacy, please contact our Privacy Officer at:<br/>
            Email: <a href="mailto:privacy@parkqueen.app" className="text-blue-500 hover:underline">privacy@parkqueen.app</a>
          </p>
        </div>
      </div>
    </div>
  );
};
