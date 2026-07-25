# ParQueen Performance and Cost Budget

Assessment date: 2026-07-24  
Source: production build output, Vite analysis, repository inspection  
Status: baseline — targets and measurements require production traffic to validate

---

## Bundle size baseline

Captured from `npm run build` on audit branch (post-security-fix, pre-optimization):

| Chunk | Minified | Gzip | Status |
|---|---|---|---|
| `StreetParkingView` (lazy) | 1,867 kB | 510 kB | OVER BUDGET |
| Main bundle (index) | 927 kB | 233 kB | OVER BUDGET |
| Other lazy chunks | < 50 kB each | — | OK |

**Budget targets (mobile 4G, Lighthouse mobile simulation):**

| Metric | Target | Gap |
|---|---|---|
| Total gzip transferred | < 500 kB initial | Main bundle alone is 233 kB gzip; lazy street view is 510 kB additional on first interaction |
| Largest chunk gzip | < 200 kB per chunk | StreetParkingView is 510 kB — 2.5× over |
| First Contentful Paint | < 2.5 s | Not measured; bundle size suggests risk |
| Time to Interactive | < 5.0 s | Not measured; suggest Lighthouse run after BLK-01 fix |

---

## Bundle composition analysis

### StreetParkingView chunk (1,867 kB minified)

The StreetParkingView chunk is large because:

1. **`mapbox-gl`** — the primary contributor. Mapbox GL JS is ~600–800 kB minified. It is imported at the module level in files that all collapse into the StreetParkingView chunk.
2. **`@turf/*` or geospatial utils** — if present via transitive imports from Mapbox or geofire-common.
3. **React component tree** — multiple sub-components (`HandoffFlow`, `BottomSheet`, `SpotDetailsCard`, `SpotModal`, `AppTour`, `MapLegend`, `NavigationBar`, `ParkingActivitySheet`, `StreetIntelligenceCard`, `TimePicker`, `HeaderBar`) all in one Vite chunk.

### Main bundle (927 kB minified)

The main bundle includes:
- Firebase JS SDK (`firebase@10.14.1`) — modular but still significant
- React + React DOM (18.2.0) — ~130 kB minified
- All views not code-split
- All utils and i18n

---

## Optimization recommendations

### PERF-01 (HIGH): Split Mapbox GL JS into its own chunk

```ts
// vite.config.ts — add manualChunks
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'mapbox': ['mapbox-gl'],
        'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging'],
      }
    }
  }
}
```

Expected savings: ~500 kB from StreetParkingView chunk, cached separately from business logic.

### PERF-02 (HIGH): Replace CDN Tailwind with bundled CSS

Remove `<script src="https://cdn.tailwindcss.com">` from `index.html`. Configure Vite to generate a Tailwind CSS file during build:

```ts
// vite.config.ts
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
// add to css.postcss.plugins
```

Expected savings: eliminates runtime JIT compiler (~38 kB gzip CDN script + full browser recompilation on load).

### PERF-03 (MEDIUM): Remove dormant dependencies from bundle scan

`leaflet`, `react-native-webview` are declared in `dependencies` and may be partially resolved by Vite. Remove from `package.json` to reduce resolve surface.

### PERF-04 (MEDIUM): Lazy-load admin views

`AdminDashboardView`, `AdminLoginView`, `AuditLogPage`, and related pages can be loaded only when the admin subdomain or query param is matched.

### PERF-05 (LOW): Replace importmap external CDN modules with Vite-bundled imports

The importmap in `index.html` is a fallback mechanism that conflicts with Vite's bundling. Remove the importmap or ensure all production paths go through the Vite-bundled entry point only.

---

## Firebase cost budget

### Firestore

| Operation | Trigger | Estimated scale | Cost concern |
|---|---|---|---|
| Spot reads | Geohash snapshot listener (10 geohashes × active user) | Linear with concurrent users | HIGH — open listeners are billed per read on every change |
| Chat reads | Per-conversation snapshot | Linear with active conversations | MEDIUM |
| User doc reads | Per page view referencing username/avatar | Potentially many | MEDIUM — cache at component level |
| Notification reads | Per user session | LOW | Low volume |
| `spots` writes | Per Ping create/update/delete | Moderate | LOW |
| `adminAuditLog` writes | Per admin action | Very low | LOW |
| `processedTrustEvents` | Per feedback event | Low | LOW |

**Key risk:** The street parking view opens up to 12 simultaneous snapshot listeners per session (spots by geohash x10 + user + session). At 1,000 concurrent users, this can generate 12,000 sustained reads/second. Firebase Spark plan limit is 50,000 reads/day; Blaze plan is billed at $0.06/100K reads.

**Mitigation:** Consolidate geohash listeners where possible; paginate or poll for low-priority streams; consider Firestore aggregation for badge counts.

### Cloud Functions

| Callable | Estimated calls/user/session | External cost |
|---|---|---|
| `analyzeSign` | 0–3 per session | Gemini API — billed per 1K tokens |
| `generateSmartReplies` | 0–5 per conversation | Gemini API — billed per 1K tokens |
| `generateListingDescription` | 0 (dormant feature) | — |
| `createSegmentFromSweepNYC` | 0–1 per new street | SweepNYC — free tier unknown |
| `generateEmailOTP` / `verifyEmailOTP` | 1–2 per sign-in | SendGrid — billed per email |
| `scheduleCleaningReminders` | Every 15 minutes (cron) | FCM — free; Functions billed per invocation |

**Key risk:** Without App Check or rate limits, `analyzeSign` and `createSegmentFromSweepNYC` can be invoked at attacker-controlled scale. Budget alerts in the Firebase console are a compensating control until App Check is enforced.

### Firebase Hosting

Estimated bandwidth per session (optimized):

| Asset | Estimated gzip | Cache behavior |
|---|---|---|
| Main bundle (after split) | ~100 kB | Long-term cache (content hash) |
| Mapbox chunk | ~300 kB | Long-term cache |
| StreetParkingView chunk | ~150 kB after split | Long-term cache |
| Mapbox tiles | Variable (Mapbox CDN) | Browser cache |
| Firebase Hosting free tier | 360 MB/day outbound | |

### Storage

| Operation | Trigger | Cost |
|---|---|---|
| Avatar upload | Per profile photo change | $0.023/GB stored + $0.05/GB downloaded |
| Avatar download | Per profile view showing avatar | Mapbox tiles dominate; avatars secondary |

No avatar size limit or MIME type restriction is currently enforced (TM-06).

---

## Monitoring requirements before public launch

1. **Firebase console budget alert** — set at 80% and 100% of monthly budget; alert to team email.
2. **Firestore read quota alert** — alert if reads exceed 500K/day on Blaze plan.
3. **Function error rate alert** — alert if any callable error rate exceeds 5% over 15 minutes.
4. **Gemini quota alert** — set quota limits in Google AI Studio or Cloud console.
5. **Mapbox usage alert** — set in Mapbox dashboard; free tier is 50K map loads/month.
6. **SweepNYC usage** — determine rate limit and set application-level counter.

---

## Recommended optimization order

1. Remove BLK-01 (voice agent script) — security blocker, no performance impact but reduces risk surface.
2. Replace CDN Tailwind with bundled CSS (PERF-02) — removes runtime JIT.
3. Add `manualChunks` for Mapbox (PERF-01) — largest single bundle reduction.
4. Set Firebase budget alerts — prevent surprise billing before optimization is complete.
5. Consolidate Firestore listeners in StreetParkingView — cost and performance.
6. Profile with Lighthouse after steps 1–3 and confirm targets are met.
