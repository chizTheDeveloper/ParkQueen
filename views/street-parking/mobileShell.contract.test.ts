import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('mobile shell layout contract', () => {
  it('reserves the complete safe-area-aware navigation footprint for primary content and map controls', () => {
    const css = read('index.css');
    expect(css).toContain('--mobile-primary-nav-space: calc(84px + env(safe-area-inset-bottom, 0px))');
    expect(css).toMatch(/\.mobile-primary-screen\s*\{[^}]*padding-bottom:\s*var\(--mobile-primary-nav-space\)/s);
    expect(css).toMatch(/\.mobile-map-controls\s*\{[^}]*padding-bottom:\s*var\(--mobile-primary-nav-space\)/s);
    expect(css).toContain('env(safe-area-inset-top, 0px)');
  });

  it('keeps mobile targets large and keyboard focus visible while desktop retains its header controls', () => {
    const css = read('index.css');
    const header = read('views/street-parking/HeaderBar.tsx');
    expect(css).toMatch(/\.mobile-primary-nav-item\s*\{[^}]*min-height:\s*54px/s);
    expect(css).toContain('.mobile-primary-nav-item:focus-visible');
    expect(header).toContain('hidden md:inline-flex');
  });

  it('suppresses the map navigation copy while the Messages overlay owns the visible primary navigation', () => {
    const app = read('App.tsx');
    expect(app).toContain('showPrimaryNavigation={currentView === AppView.MAP}');
    expect(app).toContain('setView={setCurrentView}');
  });

  it('wires every map sheet/dialog state into the idle-root visibility guard', () => {
    const map = read('views/StreetParkingView.tsx');
    for (const mapping of [
      'spotModalOpen: isSpotModalOpen',
      'spotDetailsOpen: !!selectedItem',
      'sessionSheetOpen: showSessionSheet',
      'postSaveOfferOpen: showPostSaveOffer',
      'departureSheetOpen: showDepartureSheet',
      'handoffSheetOpen: interestFlow.handoffStep !== null',
      'stackSheetOpen: !!stackGroup',
      'deleteDialogOpen: showDeleteConfirm',
      'destinationActivitySheetOpen: !!search.selectedDestination',
    ]) expect(map).toContain(mapping);
    expect(map).toContain('{mapPrimaryNavigationVisible && (');
  });

  it('keeps the mobile map hierarchy on shared quiet-premium surface treatments', () => {
    const css = read('index.css');
    const header = read('views/street-parking/HeaderBar.tsx');
    const map = read('views/StreetParkingView.tsx');

    expect(css).toContain('--mobile-shell-surface:');
    expect(css).toContain('--mobile-shell-border:');
    expect(css).toContain('--mobile-shell-accent:');
    expect(css).toContain('--mobile-shell-focus: #1763d5');
    expect(css).toMatch(/\.map-search-shell,[^}]*backdrop-filter:\s*blur\(/s);
    expect(css).toMatch(/\.map-ai-action\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toMatch(/\.map-ai-action:focus-visible,[^}]*outline:\s*2px solid var\(--mobile-shell-focus\)/s);
    expect(css).toMatch(/\.map-primary-cta\s*\{[^}]*letter-spacing:\s*-0\.02em/s);
    expect(css).toContain('.map-primary-cta-icon');
    expect(css).toContain('.map-status-chip');
    expect(css).toContain('.map-control-button');
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.map-primary-cta/s);

    expect(header).toContain('map-search-shell');
    expect(header).toContain('map-ai-action');
    expect(map).toContain('map-status-chip');
    expect(map).toContain('map-control-button');
    expect(map).toContain('map-primary-cta');
  });

  it('anchors the primary map action clear of the reserved dock in narrow landscape', () => {
    const css = read('index.css');
    const map = read('views/StreetParkingView.tsx');
    expect(css).toMatch(/@media \(orientation: landscape\) and \(max-height: 430px\)/);
    expect(css).toMatch(/@media \(orientation: landscape\)[\s\S]*?\.map-primary-cta\s*\{[^}]*position:\s*fixed[^}]*bottom:\s*calc\(var\(--mobile-primary-nav-space\) \+ 10px\)/s);
    expect(css).toMatch(/@media \(orientation: landscape\)[\s\S]*?\.map-secondary-controls\s*\{[^}]*position:\s*fixed/s);
    expect(css).toMatch(/@media \(orientation: landscape\)[\s\S]*?\.map-timer-chip\s*\{[^}]*position:\s*fixed/s);
    expect(map).toContain('map-timer-chip');
  });

  it('restores the pre-polish map-shell geometry at the desktop breakpoint', () => {
    const css = read('index.css');
    expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*?\.map-search-shell\s*\{[^}]*height:\s*50px/s);
    expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*?\.map-control-button\s*\{[^}]*width:\s*40px[^}]*height:\s*40px/s);
    expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*?\.map-primary-cta\s*\{[^}]*min-height:\s*52px/s);
  });
});
