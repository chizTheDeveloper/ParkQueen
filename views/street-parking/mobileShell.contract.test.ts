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
});
