import { RecaptchaVerifier, type Auth } from 'firebase/auth';

export interface ClearableRecaptchaVerifier {
  clear(): void;
}

export interface RecaptchaVerifierRef<
  T extends ClearableRecaptchaVerifier = RecaptchaVerifier,
> {
  current: T | null;
}

interface ReplaceRecaptchaVerifierOptions<
  T extends ClearableRecaptchaVerifier,
> {
  getContainer?: (containerId: string) => HTMLElement | null;
  create?: (auth: Auth, containerId: string) => T;
}

export const clearRecaptchaVerifier = <
  T extends ClearableRecaptchaVerifier,
>(ref: RecaptchaVerifierRef<T>): void => {
  const verifier = ref.current;
  ref.current = null;
  if (!verifier) return;
  try {
    verifier.clear();
  } catch {
    // Firebase may throw when React has already removed the widget container.
  }
};

export const replaceRecaptchaVerifier = <
  T extends ClearableRecaptchaVerifier = RecaptchaVerifier,
>(
  ref: RecaptchaVerifierRef<T>,
  auth: Auth,
  containerId: string,
  options: ReplaceRecaptchaVerifierOptions<T> = {},
): T => {
  clearRecaptchaVerifier(ref);

  const getContainer = options.getContainer ?? (id => document.getElementById(id));
  if (!getContainer(containerId)) {
    throw new Error(`reCAPTCHA container is not mounted: ${containerId}`);
  }

  const create = options.create ?? ((firebaseAuth: Auth, id: string) => (
    new RecaptchaVerifier(firebaseAuth, id, { size: 'invisible' }) as unknown as T
  ));
  const verifier = create(auth, containerId);
  ref.current = verifier;
  return verifier;
};
