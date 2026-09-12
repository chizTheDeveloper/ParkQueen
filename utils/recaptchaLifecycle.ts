import { RecaptchaVerifier, type Auth } from 'firebase/auth';

export interface ClearableRecaptchaVerifier {
  clear(): void;
}

export interface RecaptchaVerifierRef<
  T extends ClearableRecaptchaVerifier = RecaptchaVerifier,
> {
  current: T | null;
}

export type QaAuthEnv = { readonly VITE_QA_AUTH?: string };

interface ReplaceRecaptchaVerifierOptions<
  T extends ClearableRecaptchaVerifier,
> {
  getContainer?: (containerId: string) => HTMLElement | null;
  create?: (auth: Auth, containerId: string) => T;
  /** Test seam only — production callers omit this and use import.meta.env. */
  env?: QaAuthEnv;
}

const qaAuthFlag = (env: QaAuthEnv | ImportMetaEnv): string | undefined =>
  (env as QaAuthEnv).VITE_QA_AUTH;

/** Strict gate: only the exact string "true" enables QA phone-auth testing mode. */
export const isQaAuthEnabled = (
  env: QaAuthEnv | ImportMetaEnv = import.meta.env,
): boolean => qaAuthFlag(env) === 'true';

/**
 * For QA builds only (`VITE_QA_AUTH=true`), disable Firebase app verification
 * so Console-configured test phone numbers work. Must run before any
 * RecaptchaVerifier is constructed. Does not bypass login or invent OTPs.
 */
export const applyQaAuthAppVerificationIfEnabled = (
  auth: Auth,
  env: QaAuthEnv | ImportMetaEnv = import.meta.env,
): void => {
  if (!isQaAuthEnabled(env)) return;
  auth.settings.appVerificationDisabledForTesting = true;
};

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

  // Before any RecaptchaVerifier construction (default or injected factory).
  applyQaAuthAppVerificationIfEnabled(auth, options.env ?? import.meta.env);

  const create = options.create ?? ((firebaseAuth: Auth, id: string) => (
    new RecaptchaVerifier(firebaseAuth, id, { size: 'invisible' }) as unknown as T
  ));
  const verifier = create(auth, containerId);
  ref.current = verifier;
  return verifier;
};
