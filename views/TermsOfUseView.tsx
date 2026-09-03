import React from 'react';
import { ChevronLeft } from 'lucide-react';

export const TermsOfUseView = ({ onBack }: { onBack: () => void }) => (
  <div className="min-h-full bg-[var(--color-bg)] text-[var(--color-text)] pt-4 pb-20 px-4 max-w-2xl mx-auto">
    <header className="flex items-center gap-4 mb-6">
      <button onClick={onBack} aria-label="Back to ParQueen" className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-[var(--color-border)] text-[var(--color-text)] hover:bg-white/10 transition-all shrink-0">
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <h1 className="text-xl font-bold text-[var(--color-text)] tracking-wide">Terms of Use</h1>
    </header>

    <article className="bg-[var(--color-card)] border border-[var(--color-border)] backdrop-blur-md rounded-3xl p-5 shadow-xl text-[var(--color-text-secondary)] text-sm leading-relaxed space-y-4">
      <p>
        <strong>Effective Date:</strong> May 11, 2026<br />
        <strong>Last Updated:</strong> August 31, 2026
      </p>

      <section aria-labelledby="terms-acceptance">
        <h2 id="terms-acceptance" className="text-base font-bold text-[var(--color-text)] mb-2">1. Acceptance of Terms</h2>
        <p>By accessing or using ParQueen (the “Service”), you agree to these Terms of Use and acknowledge the Privacy Policy. If you do not agree, do not use the Service.</p>
      </section>

      <section aria-labelledby="terms-service">
        <h2 id="terms-service" className="text-base font-bold text-[var(--color-text)] mb-2">2. The Service</h2>
        <p>ParQueen provides community street-parking Pings, nearby parking discovery, parking handoffs and messages, My Car reminders and directions, public street-rule guidance, optional notifications, and AI-assisted sign interpretation and reply suggestions. Some map entries may describe private parking listings, but ParQueen does not currently process rental payments or guarantee a booking or transaction.</p>
      </section>

      <section aria-labelledby="terms-parking">
        <h2 id="terms-parking" className="text-base font-bold text-[var(--color-text)] mb-2">3. Parking Information Is Not a Guarantee</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>A Ping reports what another user shared. It does not reserve a public street space or guarantee that the space will remain open when you arrive.</li>
          <li>Street Intelligence, cleaning schedules, map data, notifications, estimated arrival times, and AI interpretations may be incomplete, delayed, stale, or incorrect.</li>
          <li>Posted signs, curb markings, temporary restrictions, directions from authorities, and current law control. You are responsible for verifying that parking is legal and safe.</li>
          <li>ParQueen is not responsible for tickets, towing, fines, damage, injury, or other loss caused by relying on community or calculated parking information.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-handoffs">
        <h2 id="terms-handoffs" className="text-base font-bold text-[var(--color-text)] mb-2">4. Community Pings and Handoffs</h2>
        <p>Share only honest, current information. A claim or “I’m heading there” status coordinates a community handoff; it does not create ownership, priority under traffic law, or a guaranteed right to a space. Do not use the Service while operating a moving vehicle, obstruct traffic, confront another driver, or attempt to reserve public curb space unlawfully.</p>
      </section>

      <section aria-labelledby="terms-content">
        <h2 id="terms-content" className="text-base font-bold text-[var(--color-text)] mb-2">5. Accounts, Messages, and User Content</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Provide accurate account and parking information and keep control of your authenticated session.</li>
          <li>You remain responsible for Pings, profile information, photos, messages, listings, reports, and other content you submit.</li>
          <li>Do not impersonate others; harass, threaten, defraud, or discriminate; post unlawful or infringing content; manipulate trust or rewards; scrape the Service; or interfere with its operation.</li>
          <li>ParQueen may review reports and restrict or remove accounts or content to protect users, comply with law, or enforce these Terms.</li>
        </ul>
      </section>

      <section aria-labelledby="terms-ai">
        <h2 id="terms-ai" className="text-base font-bold text-[var(--color-text)] mb-2">6. AI-Assisted Features</h2>
        <p>AI output is advisory, may be incomplete or wrong, and is not legal advice. Always inspect the full physical sign and surrounding restrictions. You are responsible for reviewing any suggested reply before sending it.</p>
      </section>

      <section aria-labelledby="terms-listings">
        <h2 id="terms-listings" className="text-base font-bold text-[var(--color-text)] mb-2">7. Private Parking Listings</h2>
        <p>If you publish or respond to a private parking listing, you are responsible for the listing’s accuracy, your authority to offer or use the space, and compliance with applicable property, lease, zoning, tax, insurance, and parking requirements. ParQueen does not provide insurance and does not currently act as a payment processor.</p>
      </section>

      <section aria-labelledby="terms-availability">
        <h2 id="terms-availability" className="text-base font-bold text-[var(--color-text)] mb-2">8. Availability and Third-Party Services</h2>
        <p>The Service depends on browsers, devices, location providers, maps, Firebase, push-delivery networks, AI services, public-data providers, and network access. Features or notifications can be unavailable, delayed, or changed. We may modify, suspend, or discontinue features, subject to applicable law.</p>
      </section>

      <section aria-labelledby="terms-property">
        <h2 id="terms-property" className="text-base font-bold text-[var(--color-text)] mb-2">9. Intellectual Property</h2>
        <p>ParQueen’s software, design, and branding are protected by applicable intellectual-property laws. These Terms do not permit you to copy, sell, reverse engineer, or commercially exploit the Service except where law expressly allows it.</p>
      </section>

      <section aria-labelledby="terms-termination">
        <h2 id="terms-termination" className="text-base font-bold text-[var(--color-text)] mb-2">10. Termination</h2>
        <p>You may stop using the Service or request account deletion through Settings. We may suspend or terminate access for violations, fraud, abuse, safety threats, or conduct that harms the community, subject to applicable law.</p>
      </section>

      <section aria-labelledby="terms-law">
        <h2 id="terms-law" className="text-base font-bold text-[var(--color-text)] mb-2">11. Governing Law</h2>
        <p>These Terms are governed by the laws of the Province of Ontario and the federal laws of Canada.</p>
      </section>

      <section aria-labelledby="terms-contact">
        <h2 id="terms-contact" className="text-base font-bold text-[var(--color-text)] mb-2">12. Contact</h2>
        <p>Questions about these Terms can be sent to <a href="mailto:support@parqueen.app" className="text-[#38bdf8] hover:underline">support@parqueen.app</a>.</p>
      </section>
    </article>
  </div>
);
