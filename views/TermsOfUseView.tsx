import React from 'react';
import { ChevronLeft } from 'lucide-react';

export const TermsOfUseView = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="bg-gray-100 dark:bg-dark-900 font-sans text-gray-800 dark:text-white min-h-full">
      <div className="bg-white dark:bg-dark-800 shadow-sm sticky top-0 z-10">
        <div className="p-4 flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-700">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">Terms of Use</h1>
        </div>
      </div>
      <div className="p-6">
        <div className="bg-white dark:bg-dark-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 max-w-none">
          <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Terms of Use for ParkQueen</h3>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6"><strong>Effective Date:</strong> May 11, 2026</p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">1. Acceptance of Terms</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">By accessing or using the ParkQueen mobile application (the "Service"), you agree to be bound by these Terms of Use. If you do not agree, you may not use the Service.</p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">2. Description of Service</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">ParkQueen provides an interactive platform for finding street parking, sharing parking availability ("Pings"), and renting private parking spaces ("P2P Rentals"). The Service includes an AI-powered Sign Decoder to assist in interpreting parking regulations.</p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">3. AI Sign Decoder: Disclaimer of Accuracy</h4>
          <ul className="list-disc pl-6 space-y-3 mb-6 text-gray-600 dark:text-gray-300">
            <li className="leading-relaxed"><strong>Informational Purposes Only:</strong> The AI Sign Decoder is provided for informational purposes only. While we use advanced AI (Google Gemini), we do not guarantee the accuracy of any "YES," "NO," or "CONDITIONAL" verdict.</li>
            <li className="leading-relaxed"><strong>User Responsibility:</strong> You are solely responsible for verifying all physical street signs and local bylaws before parking.</li>
            <li className="leading-relaxed"><strong>Limitation of Liability:</strong> ParkQueen, its developers, and affiliates are not liable for any parking tickets, fines, towing fees, or legal penalties resulting from your reliance on the Service’s AI suggestions.</li>
          </ul>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">4. P2P Rental Marketplace (Hosts & Guests)</h4>
          <ul className="list-disc pl-6 space-y-3 mb-6 text-gray-600 dark:text-gray-300">
            <li className="leading-relaxed"><strong>Authorization:</strong> Hosts represent and warrant that they have the legal right to rent out the parking space listed and that such rental does not violate local zoning laws or lease agreements.</li>
            <li className="leading-relaxed"><strong>Insurance:</strong> ParkQueen does not provide insurance for P2P rentals. Drivers and Hosts are responsible for maintaining their own insurance coverage for property damage or personal injury.</li>
            <li className="leading-relaxed"><strong>Disputes:</strong> ParkQueen acts as a facilitator only. Any disputes regarding the use of a private space (e.g., overstays, damage) must be resolved between the Host and the Guest.</li>
          </ul>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">5. Community "Pings" & User Conduct</h4>
          <ul className="list-disc pl-6 space-y-3 mb-6 text-gray-600 dark:text-gray-300">
            <li className="leading-relaxed"><strong>Accuracy:</strong> You agree to provide honest and accurate "Pings" when leaving a spot. Frequent false pings may result in a decrease in your Reputation Score or account suspension.</li>
            <li className="leading-relaxed"><strong>Safe Operation:</strong> You must not use the Service while operating a moving vehicle. Always pull over safely before interacting with the app or taking photos of signs.</li>
          </ul>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">6. Payments and Fees</h4>
          <ul className="list-disc pl-6 space-y-3 mb-6 text-gray-600 dark:text-gray-300">
            <li className="leading-relaxed"><strong>Processing:</strong> Payments for rentals are handled by our third-party provider (e.g., Stripe). By making a transaction, you agree to their terms.</li>
            <li className="leading-relaxed"><strong>Service Fees:</strong> ParkQueen may collect a percentage of P2P transactions as a service fee, which will be clearly displayed before booking.</li>
          </ul>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">7. Intellectual Property</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">All content, including the AI Sign Decoder logic, UI/UX design, and the "ParkQueen" brand, is the property of the developers. You may not reverse-engineer, decompile, or scrape data from the Service.</p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">8. Termination</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">We reserve the right to suspend or terminate your account at our sole discretion for violations of these terms, fraudulent activity, or behavior that harms the community.</p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">9. Governing Law</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-6">These terms are governed by the laws of the Province of Ontario and the federal laws of Canada.</p>

          <h4 className="text-lg font-semibold mt-8 mb-4 text-gray-800 dark:text-gray-200">10. Contact</h4>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            Email: <a href="mailto:support@parkqueen.app" className="text-blue-500 hover:underline">support@parkqueen.app</a>
          </p>
        </div>
      </div>
    </div>
  );
};
