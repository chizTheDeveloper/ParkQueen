import { describe, expect, it } from 'vitest';
import en from './en';
import es from './es';

const accessibilityKeys = [
  'ping_modal.sheet_label',
  'parking_activity.sheet_label',
  'time_picker.hour',
  'time_picker.minute',
  'time_picker.increase_hour',
  'time_picker.decrease_hour',
  'time_picker.increase_minute',
  'time_picker.decrease_minute',
  'time_picker.period',
  'time_picker.selected',
];

describe('accessibility copy parity', () => {
  it.each(accessibilityKeys)('%s has nonempty English and Spanish text', key => {
    expect(en[key]?.trim()).toBeTruthy();
    expect(es[key]?.trim()).toBeTruthy();
  });
});
