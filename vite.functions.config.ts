import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'functions/deleteAccount.integration.test.js',
      'functions/initUserPrivateAccount.integration.test.js',
    ],
    testTimeout: 120000,
    hookTimeout: 120000,
    maxWorkers: 1,
    retry: 0,
  },
});
