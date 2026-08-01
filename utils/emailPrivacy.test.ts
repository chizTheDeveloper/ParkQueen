import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();
const appTsx = readFileSync(resolve(root, 'App.tsx'), 'utf-8');
const setupView = readFileSync(resolve(root, 'views/SetupProfileView.tsx'), 'utf-8');
const settingsView = readFileSync(resolve(root, 'views/SettingsView.tsx'), 'utf-8');
const streetParkingView = readFileSync(resolve(root, 'views/StreetParkingView.tsx'), 'utf-8');

// ── Email write invariants ──────────────────────────────────────────────────
describe('handleSaveProfile — no unauthorised email writes', () => {
  it('does not write email to the root user document', () => {
    // The root doc update must contain only display fields (fullName, etc.)
    // Email is never a valid field on users/{uid} — only private/account holds it
    expect(appTsx).not.toContain('email: profileData.email');
  });

  it('does not write email to users/{uid}/private/account via client SDK', () => {
    // Client writes to private/account are blocked by Firestore Rules (write: false).
    // Only verifyEmailOTP using the Admin SDK is authorised to set the email field there.
    expect(appTsx).not.toContain("'private', 'account'), { email");
    expect(appTsx).not.toContain('"private", "account"), { email');
  });

  it('the root doc updateDoc call does not include an email key', () => {
    // Verify the full pattern of the root-doc write: only fullName is updated.
    // A regex captures the updateDoc block; email must not appear inside it.
    const rootWriteMatch = appTsx.match(/await updateDoc\(fsDoc\(db, 'users', uid\),([\s\S]*?)\);/);
    expect(rootWriteMatch).not.toBeNull();
    expect(rootWriteMatch![1]).not.toContain('email');
  });
});

// ── SetupProfileView invariants ─────────────────────────────────────────────
describe('SetupProfileView — email field removed from onboarding', () => {
  it('does not include an email input field', () => {
    expect(setupView).not.toContain("type=\"email\"");
    expect(setupView).not.toContain('setup_profile.email');
  });

  it('does not include email in the onSave profileData type', () => {
    expect(setupView).not.toContain('email: string');
  });

  it('does not pass email to the onSave callback', () => {
    expect(setupView).not.toContain('email,');
    expect(setupView).not.toContain('email }');
  });
});

// ── Email display fallback ──────────────────────────────────────────────────
describe('App.tsx — email display fallback for historical accounts', () => {
  it('still falls back to root-doc email when private/account has no email', () => {
    // The fallback guard must remain: if privateEmailRef is undefined, no override
    // is applied and userData (root doc) email surfaces in the user object.
    expect(appTsx).toContain('privateEmailRef.current !== undefined');
  });

  it('private-account email is the authoritative source when present', () => {
    // The private account listener reads email from snap.data().email and stores
    // it in privateEmailRef, which the root-doc listener then prefers.
    expect(appTsx).toContain('snap.data().email');
    expect(appTsx).toContain('privateEmailRef.current = email');
  });

  it('emailVerified is not written from the client in handleSaveProfile', () => {
    // emailVerified must only be set server-side by verifyEmailOTP (Admin SDK).
    // Extract the handleSaveProfile body to avoid matching unrelated code.
    const fnMatch = appTsx.match(/const handleSaveProfile[\s\S]*?^  };/m);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).not.toContain('emailVerified');
  });
});

// ── Mapbox CSS ──────────────────────────────────────────────────────────────
describe('Mapbox GL JS CSS — local package import', () => {
  it('StreetParkingView imports Mapbox CSS from the installed npm package', () => {
    expect(streetParkingView).toContain("import 'mapbox-gl/dist/mapbox-gl.css'");
  });

  it('email verification is OTP-gated in SettingsView, not a plain save', () => {
    // The only way to write a new email is through the verifyEmailOTP callable.
    expect(settingsView).toContain("httpsCallable(functions, 'verifyEmailOTP')");
    expect(settingsView).not.toContain("email: profileData");
  });
});
