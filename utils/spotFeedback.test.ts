import { describe, expect, it } from 'vitest';
import { spotFeedbackDocId } from './spotFeedback';

describe('spotFeedbackDocId', () => {
  it('binds one feedback document to a spot and driver pair', () => {
    expect(spotFeedbackDocId('spot-123', 'driver-456')).toBe('spot-123_driver-456');
  });

  it('rejects identifiers that could escape the Firestore document path', () => {
    expect(() => spotFeedbackDocId('spot/123', 'driver-456')).toThrow('Invalid feedback identifier');
    expect(() => spotFeedbackDocId('spot-123', '')).toThrow('Invalid feedback identifier');
  });
});
