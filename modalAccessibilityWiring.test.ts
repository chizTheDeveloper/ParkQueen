import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('shared modal accessibility wiring', () => {
  it('requires a name for every BottomSheet call site', () => {
    const bottomSheet = read('views/street-parking/BottomSheet.tsx');
    expect(bottomSheet).toMatch(/ariaLabel:\s*string/);
    expect(bottomSheet).not.toMatch(/ariaLabel\?:\s*string/);

    for (const file of [
      'views/street-parking/SpotModal.tsx',
      'views/street-parking/ParkingActivitySheet.tsx',
      'views/StreetParkingView.tsx',
    ]) {
      const source = read(file);
      const calls = source.match(/<BottomSheet\b[^>]*>/gs) ?? [];
      expect(calls.length, `${file} should render at least one BottomSheet`).toBeGreaterThan(0);
      calls.forEach(call => expect(call, `${file} BottomSheet must be named`).toMatch(/ariaLabel=/));
    }
  });

  it('uses the shared contract for account deletion with cancel-first focus and no Escape during deletion', () => {
    const app = read('App.tsx');
    expect(app).toContain("from './components/AccessibleModal'");
    expect(app).toMatch(/<AccessibleModal[\s\S]*?ariaLabel=/);
    expect(app).toMatch(/initialFocusRef=\{deleteCancelRef\}/);
    expect(app).toMatch(/onDismiss=\{deletePhase === 'deleting' \? undefined : handleDeleteModalDismiss\}/);
    expect(app).toMatch(/ref=\{deleteCancelRef\}/);
  });

  it('uses the shared contract for delete/report dialogs and returns focus to More options', () => {
    const messages = read('views/MessagesView.tsx');
    expect(messages).toContain("from '../components/AccessibleModal'");
    expect(messages).toMatch(/ref=\{menuTriggerRef\}[\s\S]*?aria-label=\{t\('messages\.menu_aria'\)\}/);
    expect(messages.match(/<AccessibleModal/g)).toHaveLength(2);
    expect(messages.match(/returnFocusRef=\{menuTriggerRef\}/g)).toHaveLength(2);
    expect(messages.match(/initialFocusRef=\{(?:delete|report)CancelRef\}/g)).toHaveLength(2);
    expect(messages).toMatch(/onDismiss=\{deletingChat \? undefined : closeDeleteConfirm\}/);
  });

  it('uses the shared contract for the delete-Ping dialog layered over Spot Details', () => {
    const streetParking = read('views/StreetParkingView.tsx');
    expect(streetParking).toContain("from '../components/AccessibleModal'");
    expect(streetParking).toMatch(/showDeleteConfirm[\s\S]*?<AccessibleModal/);
    expect(streetParking).toMatch(/initialFocusRef=\{deletePingCancelRef\}/);
    expect(streetParking).toMatch(/ref=\{deletePingCancelRef\}/);
  });
});
