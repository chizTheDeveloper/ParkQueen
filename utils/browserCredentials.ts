const requiredBrowserCredential = (name: string, value: string | undefined): string => {
  const credential = value?.trim();
  if (!credential) {
    throw new Error(
      `[configuration] ${name} is required. Add it to .env.local for development or the approved production environment.`,
    );
  }
  return credential;
};

export const getMapboxToken = (): string =>
  requiredBrowserCredential('VITE_MAPBOX_TOKEN', import.meta.env.VITE_MAPBOX_TOKEN);

export { requiredBrowserCredential };
