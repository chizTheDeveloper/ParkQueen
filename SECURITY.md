# Browser credential configuration

ParQueen requires two intentionally public browser credentials. Never commit their values.

## Local development

Copy `.env.example` to `.env.local` and supply development-only credentials:

```env
VITE_MAPBOX_TOKEN=
VITE_GOOGLE_MAPS_API_KEY=
```

Use separate development and production credentials. Vite exposes every `VITE_` value to the browser, so these credentials must be restricted at their providers rather than treated as server secrets.

## Mapbox

- Create a custom public token for web development and a separate custom public token for production.
- Grant only the public token scopes required by the web app: `styles:read`, `styles:tiles`, and `fonts:read`.
- Verify geocoding and directions requests with that restricted token before production rollout.
- Restrict the development token to approved localhost origins.
- Restrict the production token to `parqueen.app`, approved subdomains, and the active Firebase Hosting domains.
- Use separate tokens for future native iOS and Android apps.
- Configure `VITE_MAPBOX_TOKEN` in the target environment. Never log it.

## Google Maps Platform

- Configure `VITE_GOOGLE_MAPS_API_KEY` with HTTP-referrer restrictions.
- Allow approved localhost origins only on the development key.
- Allow `parqueen.app`, approved subdomains, and active Firebase Hosting domains on the production key.
- Apply API restrictions to only the browser APIs ParQueen uses, currently Places API (New).
- Set appropriate quotas and billing alerts.
- Never reuse a server-side Google or Gemini key in this variable, and never log it.

## Local secret scan

Install [Gitleaks](https://github.com/gitleaks/gitleaks), then run:

```bash
gitleaks git --redact
```

The CI secret scan runs locally inside the GitHub-hosted runner and does not upload repository contents to an external scanning service.
