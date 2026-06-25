import React from 'react';
import { ChevronLeft } from 'lucide-react';

export const TermsOfUseView = ({ onBack }: { onBack: () => void }) => {
  return (
    <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Terms of Use</h1>
      </div>

      <div className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-3xl p-5 shadow-xl text-[var(--color-text-secondary)] text-xs space-y-4">
        <h3 className="text-lg font-bold text-[var(--color-text)]">Terms of Use for ParkQueen</h3>
        <p className="leading-relaxed"><strong>Effective Date:</strong> May 11, 2026</p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">1. Acceptance of Terms</h4>
        <p className="leading-relaxed">By accessing or using the ParkQueen mobile application (the "Service"), you agree to be bound by these Terms of Use. If you do not agree, you may not use the Service.</p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">2. Description of Service</h4>
        <p className="leading-relaxed">ParkQueen provides an interactive platform for finding street parking, sharing parking availability ("Pings"), and renting private parking spaces ("P2P Rentals"). The Service includes an AI-powered Sign Decoder to assist in interpreting parking regulations.</p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">3. AI Sign Decoder: Disclaimer of Accuracy</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li className="leading-relaxed"><strong>Informational Purposes Only:</strong> The AI Sign Decoder is provided for informational purposes only. While we use advanced AI (Google Gemini), we do not guarantee the accuracy of any "YES," "NO," or "CONDITIONAL" verdict.</li>
          <li className="leading-relaxed"><strong>User Responsibility:</strong> You are solely responsible for verifying all physical street signs and local bylaws before parking.</li>
          <li className="leading-relaxed"><strong>Limitation of Liability:</strong> ParkQueen, its developers, and affiliates are not liable for any parking tickets, fines, towing fees, or legal penalties resulting from your reliance on the Service’s AI suggestions.</li>
        </ul>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">4. P2P Rental Marketplace (Hosts & Guests)</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li className="leading-relaxed"><strong>Authorization:</strong> Hosts represent and warrant that they have the legal right to rent out the parking space listed and that such rental does not violate local zoning laws or lease agreements.</li>
          <li className="leading-relaxed"><strong>Insurance:</strong> ParkQueen does not provide insurance for P2P rentals. Drivers and Hosts are responsible for maintaining their own insurance coverage for property damage or personal injury.</li>
          <li className="leading-relaxed"><strong>Disputes:</strong> ParkQueen acts as a facilitator only. Any disputes regarding the use of a private space (e.g., overstays, damage) must be resolved between the Host and the Guest.</li>
        </ul>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">5. Community "Pings" & User Conduct</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li className="leading-relaxed"><strong>Accuracy:</strong> You agree to provide honest and accurate "Pings" when leaving a spot. Frequent false pings may result in a decrease in your Reputation Score or account suspension.</li>
          <li className="leading-relaxed"><strong>Safe Operation:</strong> You must not use the Service while operating a moving vehicle. Always pull over safely before interacting with the app or taking photos of signs.</li>
        </ul>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">6. Payments and Fees</h4>
        <ul className="list-disc pl-5 space-y-2">
          <li className="leading-relaxed"><strong>Processing:</strong> Payments for rentals are handled by our third-party provider (e.g., Stripe). By making a transaction, you agree to their terms.</li>
          <li className="leading-relaxed"><strong>Service Fees:</strong> ParkQueen may collect a percentage of P2P transactions as a service fee, which will be clearly displayed before booking.</li>
        </ul>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">7. Intellectual Property</h4>
        <p className="leading-relaxed">All content, including the AI Sign Decoder logic, UI/UX design, and the "ParkQueen" brand, is the property of the developers. You may not reverse-engineer, decompile, or scrape data from the Service.</p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">8. Termination</h4>
        <p className="leading-relaxed">We reserve the right to suspend or terminate your account at our sole discretion for violations of these terms, fraudulent activity, or behavior that harms the community.</p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">9. Governing Law</h4>
        <p className="leading-relaxed">These terms are governed by the laws of the Province of Ontario and the federal laws of Canada.</p>

        <h4 className="text-sm font-bold text-[var(--color-text)] mt-4">10. Contact</h4>
        <p className="leading-relaxed">
          Email: <a href="mailto:support@parkqueen.app" className="text-[#38bdf8] hover:underline">support@parkqueen.app</a>
        </p>
      </div>
    </div>
  );
};
