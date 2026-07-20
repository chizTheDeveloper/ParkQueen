export type LocationAccess = 'unknown' | 'granted' | 'declined' | 'denied';

const CHOICE_KEY = 'locationAccessChoice';
const LEGACY_KEY = 'hasSeenLocationPrompt';

type MinStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Read persisted location access choice from storage. */
export function readPersistedAccess(storage: MinStorage = localStorage): LocationAccess {
    const stored = storage.getItem(CHOICE_KEY);
    if (stored === 'granted' || stored === 'declined' || stored === 'denied') return stored;
    // Backward compat: old hasSeenLocationPrompt means user dismissed the overlay → treat as declined
    if (storage.getItem(LEGACY_KEY)) return 'declined';
    return 'unknown';
}

/** Persist a user-made access choice; also writes legacy key for backward compat. */
export function persistAccessChoice(
    access: 'granted' | 'declined' | 'denied',
    storage: MinStorage = localStorage
): void {
    storage.setItem(CHOICE_KEY, access);
    storage.setItem(LEGACY_KEY, '1');
}

/** True when the location primer should be shown (access not yet resolved). */
export function shouldShowPrimer(access: LocationAccess): boolean {
    return access === 'unknown';
}

/**
 * Derive LocationAccess from the Permissions API result combined with the stored choice.
 * Call this on mount in LocationPromptView as a best-effort enhancement.
 */
export function resolveFromPermissions(
    permState: PermissionState,
    stored: LocationAccess
): LocationAccess {
    if (permState === 'granted') return 'granted';
    if (permState === 'denied') return 'denied';
    // 'prompt' — honour the stored choice (e.g. 'declined' from a previous Not now)
    return stored;
}
