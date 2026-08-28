import { describe, it, expect, vi, beforeEach } from 'vitest';

const { init, breadcrumbsIntegration } = vi.hoisted(() => ({
  init: vi.fn(),
  breadcrumbsIntegration: vi.fn((opts: any) => ({ name: 'Breadcrumbs', opts })),
}));

vi.mock('@sentry/react', () => ({ init, breadcrumbsIntegration }));

import { initSentry } from './sentryInit';

const DSN = 'https://examplekey@o0.ingest.sentry.io/1';

describe('initSentry', () => {
  beforeEach(() => {
    init.mockClear();
    breadcrumbsIntegration.mockClear();
  });

  it('initializes when isProd=true and a DSN is present', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    expect(init).toHaveBeenCalledTimes(1);
  });

  it('does NOT initialize outside production (dev/test)', () => {
    initSentry({ isProd: false, dsn: DSN, release: 'abc123' });
    expect(init).not.toHaveBeenCalled();
  });

  it('fails safe when the DSN is missing, even in production', () => {
    initSentry({ isProd: true, dsn: undefined, release: 'abc123' });
    expect(init).not.toHaveBeenCalled();
  });

  it('fails safe when the DSN is an empty string', () => {
    initSentry({ isProd: true, dsn: '', release: 'abc123' });
    expect(init).not.toHaveBeenCalled();
  });

  it('passes sendDefaultPii:false, environment production, the given release and dsn', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    const config = init.mock.calls[0][0];
    expect(config.sendDefaultPii).toBe(false);
    expect(config.environment).toBe('production');
    expect(config.release).toBe('abc123');
    expect(config.dsn).toBe(DSN);
  });

  it('drops console/fetch/xhr/dom breadcrumbs, keeps history (sanitized separately)', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    expect(breadcrumbsIntegration).toHaveBeenCalledWith(expect.objectContaining({
      console: false,
      fetch: false,
      xhr: false,
      dom: false,
      history: true,
    }));
  });

  it('does not add tracing/replay/profiling/feedback integrations — only the customized breadcrumbs integration', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    const config = init.mock.calls[0][0];
    expect(config.integrations).toHaveLength(1);
  });

  it('beforeSend strips user identity and sensitive request fields', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    const config = init.mock.calls[0][0];
    const event = {
      user: { id: 'uid-123', email: 'a@b.com' },
      request: {
        cookies: 'session=x',
        headers: { authorization: 'Bearer y' },
        data: '{"secret":1}',
        query_string: 'a=1',
        url: 'https://x/y',
      },
    };
    const result = config.beforeSend(event);
    expect(result.user).toBeUndefined();
    expect(result.request.cookies).toBeUndefined();
    expect(result.request.headers).toBeUndefined();
    expect(result.request.data).toBeUndefined();
    expect(result.request.query_string).toBeUndefined();
  });

  it('beforeSend reduces an absolute request.url with query string and fragment to pathname only', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    const config = init.mock.calls[0][0];
    const event = { request: { url: 'https://parqueen.app/messages?chat=abc#foo' } };
    const result = config.beforeSend(event);
    expect(result.request.url).toBe('/messages');
  });

  it('beforeSend reduces a relative request.url with query string and fragment to pathname only', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    const config = init.mock.calls[0][0];
    const event = { request: { url: '/messages?chat=abc#foo' } };
    const result = config.beforeSend(event);
    expect(result.request.url).toBe('/messages');
  });

  it('beforeSend drops a malformed request.url rather than sending it raw', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    const config = init.mock.calls[0][0];
    const event = { request: { url: 'http://[::1' } };
    const result = config.beforeSend(event);
    expect(result.request.url).toBeUndefined();
  });

  it('beforeSend is a no-op when there is no user/request on the event', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    const config = init.mock.calls[0][0];
    expect(() => config.beforeSend({})).not.toThrow();
  });

  it('beforeBreadcrumb strips query string/hash from navigation breadcrumbs, keeping only the path', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    const config = init.mock.calls[0][0];
    const breadcrumb = {
      category: 'navigation',
      data: { to: '/map?lat=40.7&lng=-73.9#secret', from: '/messages?chatId=abc123' },
    };
    const result = config.beforeBreadcrumb(breadcrumb);
    expect(result.data.to).toBe('/map');
    expect(result.data.from).toBe('/messages');
  });

  it('leaves non-navigation breadcrumbs unaffected by beforeBreadcrumb', () => {
    initSentry({ isProd: true, dsn: DSN, release: 'abc123' });
    const config = init.mock.calls[0][0];
    const breadcrumb = { category: 'ui.click', message: 'button clicked' };
    const result = config.beforeBreadcrumb(breadcrumb);
    expect(result).toEqual(breadcrumb);
  });
});
