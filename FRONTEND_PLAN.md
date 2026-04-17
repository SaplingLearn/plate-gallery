# PlateGallery — Frontend Implementation Plan

**Stack:** React 18 + Vite + TypeScript · TanStack Query · React Router · Tailwind CSS · Framer Motion · Supabase JS client (auth + storage) · Deployed on Cloudflare Pages

**Design language:** Editorial, gallery-like — inspired by scleasing.dk / scgroup.dk. Serif display headlines (think Playfair Display or a similar transitional serif), clean sans body (Inter), muted earthy palette (bone/cream backgrounds, deep charcoal text, warm oxblood or burnt-sienna accent), full-bleed hero imagery, generous whitespace, minimal sticky nav, subtle fade/slide reveals on scroll, understated hover states (letter-spacing shifts, underline draws, image scale 1.02).

This plan is paired with `BACKEND_PLAN.md`. Work on both in parallel. Every point where the frontend talks to the backend is marked **🔌 CONTRACT** and must match the corresponding section in the backend plan byte-for-byte.

---

## Phase 0 — Foundation & Design System

### 0.1 Repository & tooling setup
- Fork `https://github.com/hack-bu/plate-gallery` per the brief; add the frontend app under `/frontend` (or at root if monorepo split).
- Scaffold with `npm create vite@latest frontend -- --template react-ts`.
- Install core deps: `react-router-dom`, `@tanstack/react-query`, `@supabase/supabase-js`, `framer-motion`, `tailwindcss`, `postcss`, `autoprefixer`, `clsx`, `zod` (shared type validation with backend contracts).
- Dev deps: `eslint`, `prettier`, `@types/node`, `vitest`, `@testing-library/react`, `msw` (mock service worker for backend-offline development).
- Configure path aliases (`@/components`, `@/lib`, `@/hooks`, `@/pages`, `@/styles`).
- `.env.local` with `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_STORAGE_BUCKET`.

### 0.2 Design tokens (Tailwind config)
Lock these in `tailwind.config.ts` so the rest of the app stays on-brand:

```ts
colors: {
  bone:       '#F4F0E8',   // primary background, warm off-white
  cream:      '#EBE4D4',   // secondary surface
  charcoal:   '#1A1713',   // primary text, near-black with warmth
  ink:        '#2E2924',   // body text
  stone:      '#8A8279',   // muted / meta text
  oxblood:    '#6B2F2F',   // primary accent (CTA, active state)
  sienna:     '#B8663A',   // secondary accent (highlights, chart fills)
  sage:       '#7A8471',   // success / "unlocked" state on map
  border:     '#D8D1C2',   // hairlines, dividers
}
fontFamily: {
  display: ['"Playfair Display"', 'Cormorant Garamond', 'Georgia', 'serif'],
  sans:    ['Inter', 'system-ui', 'sans-serif'],
  mono:    ['"JetBrains Mono"', 'monospace'],
}
```

Typography scale (use sparingly — scleasing.dk uses very few sizes):
- Hero display: 5xl–7xl serif, tight tracking, weight 400 (not bold — the serif carries weight).
- Section headline: 3xl–4xl serif, weight 400.
- Eyebrow label: xs sans, uppercase, letter-spacing 0.2em, stone color.
- Body: base sans, weight 400, leading-relaxed.
- Meta/caption: sm sans, stone color.

### 0.3 Global layout primitives
Build once, reuse everywhere:
- `<Container>` — max-w-7xl, horizontal padding that breathes (px-6 md, px-12 lg).
- `<FullBleed>` — edge-to-edge section breaker with optional image/video background.
- `<Eyebrow>` — the tiny uppercase label that sits above serif headings on scleasing.
- `<Divider>` — 1px hairline in `border` color, generous margin.
- `<RevealOnScroll>` — Framer Motion wrapper: `initial={{ opacity: 0, y: 24 }}`, `whileInView={{ opacity: 1, y: 0 }}`, `transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}`, `viewport={{ once: true, margin: '-10%' }}`.

### 0.4 App shell
- Minimal top nav: logo wordmark (serif) on left, 3–4 text links on right (Gallery, Map, Leaderboard, Upload). Thin 1px bottom border on scroll, transparent at top of hero.
- Sticky-on-scroll with a slight background blur (`backdrop-blur-md bg-bone/80`) after 80px scroll — trigger via `useScroll` from Framer Motion.
- Footer: multi-column link list in small caps sans, copyright line, subtle.

---

## Phase 1 — API Client & Auth Foundation

### 1.1 API client layer (`/lib/api.ts`)
- Single `fetch` wrapper that injects Supabase JWT from current session into `Authorization: Bearer <token>`.
- Typed response handler: throws `ApiError` with `{ status, code, message, details }` shape. **🔌 CONTRACT — must match the error envelope defined in backend Phase 1.**
- Base URL from `VITE_API_BASE_URL`. In dev, points at `http://localhost:8000`; in prod, at the deployed FastAPI URL.
- Automatic retry (1×) on 5xx via TanStack Query, no retry on 4xx.

### 1.2 Supabase client (`/lib/supabase.ts`)
- Initialize `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` with `persistSession: true`, `autoRefreshToken: true`, `detectSessionInUrl: true` (needed for OAuth redirect).
- Export helpers: `getSession()`, `signInWithGoogle()`, `signOut()`.

### 1.3 Auth context & hooks
- `<AuthProvider>` wrapping the app — subscribes to `supabase.auth.onAuthStateChange`, holds `{ user, session, loading }`.
- `useAuth()` hook → returns context.
- `useRequireAuth()` hook → redirects to `/login` with `?next=<current>` if unauthenticated.
- `<ProtectedRoute>` wrapper component for routes requiring login (upload, vote, profile).

### 1.4 Google OAuth flow
- `/login` page: bone background, centered card, serif "Sign in to PlateGallery" headline, single "Continue with Google" button (oxblood background, bone text, subtle lift on hover).
- Clicking triggers `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } })`.
- `/auth/callback` page: shows a serif "Signing you in…" splash, awaits `detectSessionInUrl`, then navigates to `?next` param or `/`.
- **🔌 CONTRACT:** Once session exists, the first backend call must be `POST /api/v1/users/sync` which creates the user row in our DB on first login. Backend reads the JWT, extracts `sub` / `email` / `user_metadata.full_name` / `user_metadata.avatar_url`, upserts. Frontend fires this once per session via a `useEffect` in `AuthProvider`.

### 1.5 TanStack Query setup
- `<QueryClientProvider>` at root. Default options: `staleTime: 30_000`, `gcTime: 5 * 60_000`, `refetchOnWindowFocus: false`.
- Query key conventions documented in `/lib/queryKeys.ts`:
  - `['plates', 'feed', filters]`
  - `['plates', 'byState', stateCode]`
  - `['plate', plateId]`
  - `['leaderboard', 'state', stateCode]`
  - `['leaderboard', 'overall']`
  - `['map', 'summary']`
  - `['me']`, `['me', 'plates']`, `['me', 'votes']`

---

## Phase 2 — Routing & Page Skeleton

### 2.1 Route map
```
/                       → Home (hero + featured plates + map preview + latest)
/gallery                → Global feed, filterable by state, sort
/states                 → Map-first view (the big interactive US map)
/states/:code           → Per-state page (top 10 + all plates in that state)
/leaderboard            → Overall top plates
/plate/:id              → Plate detail page
/upload                 → Upload form (protected)
/profile                → "My plates" + "My votes" (protected)
/login                  → Google sign-in
/auth/callback          → OAuth handshake splash
/about                  → Short editorial page about the project
*                       → 404 with a serif "This road leads nowhere" message
```

### 2.2 Page transitions
Use `AnimatePresence` + `motion.main` with fade + 8px y-translate, 300ms. Subtle — no swooshy stuff.

---

## Phase 3 — The Home Page (Editorial Hero)

This is where the scleasing aesthetic lives hardest. Structure mirrors scgroup.dk section cadence:

### 3.1 Hero section
- **Full-bleed** (100vw, 85–100vh) rotating photo or looping muted video of a striking vanity plate in situ — shot on the road, dusk light if possible.
- Overlay: a thin vertical ruled line on the left third. Above the headline, eyebrow "A COMMUNITY GALLERY OF AMERICAN VANITY PLATES". Headline in serif: **"Every plate tells a story."** (or similar). Sub-headline in sans, stone color.
- Single CTA: "Explore the gallery" — text link with an arrow, not a button. Underline draws on hover.
- Tiny "Scroll" indicator bottom center, bouncing slowly.
- On scroll, hero parallaxes slightly (image y-translates at 0.3× scroll speed via `useScroll` + `useTransform`).

### 3.2 "Latest plates" band
- Eyebrow: "RECENTLY ADDED"
- 4-up grid on desktop, 2-up on tablet, 1-up stacked on mobile.
- Each card: full-bleed image (aspect 4/5), below it a tiny meta row (state abbreviation · date), and the plate text itself in **serif** — e.g., *FARMLYF* — as if it were a magazine headline.
- Hover: image scales to 1.03, tiny underline draws under the plate text.
- **🔌 CONTRACT:** `GET /api/v1/plates?sort=recent&limit=8&status=approved` → returns `{ items: Plate[], next_cursor: string | null }`. See backend Phase 3 for the `Plate` shape.

### 3.3 Map preview
- A smaller, non-interactive preview of the US map (SVG) with unlocked states tinted sage, locked states in cream. CTA "Open the map →" links to `/states`.
- **🔌 CONTRACT:** `GET /api/v1/map/summary` → `{ states: [{ code: "MA", name: "Massachusetts", plate_count: 42, top_plate_id: "..." }, ...] }`.

### 3.4 "Top of the week" section
- Horizontal scrolling strip of top 10 plates overall for the current week. Snap-scroll on mobile.
- **🔌 CONTRACT:** `GET /api/v1/leaderboard/overall?window=week&limit=10`.

### 3.5 Editorial copy block
- Full-bleed bone background, serif pull-quote style. Short paragraph about the project. Mirrors the "Vi er mere end et bilhus" section of scgroup.dk — lots of whitespace, one serif sentence centered, small CTA underneath.

### 3.6 CTA footer band
- Large serif "Spot one. Share it." headline, centered. "Upload a plate →" link below. Full-bleed muted background photo with a warm vignette.

---

## Phase 4 — Gallery & Feed

### 4.1 `/gallery` layout
- Sticky sub-header with filter chips: All · [50 state chips + DC] · sort dropdown (Recent / Top today / Top week / All-time).
- Grid: 3-up desktop, 2-up tablet, 1-up mobile. Same card style as home.
- Infinite scroll via TanStack Query's `useInfiniteQuery`. Trigger is an `IntersectionObserver` on a sentinel at the bottom.
- Empty state: a centered serif message "No plates here yet. Be the first." with an upload CTA.

### 4.2 Filter & URL state sync
- All filters encoded in the query string (`?state=MA&sort=top_week`). Use `useSearchParams`.
- Changing a filter resets the infinite query.

### 4.3 Plate card component
- Props: `{ plate: Plate, priority?: boolean }` (priority controls `loading="eager"` on the first row).
- Image is served from Supabase Storage with the signed URL Supabase gives us; we request the 800w variant (see Phase 5.3 on image delivery).
- Uses native `<img loading="lazy" decoding="async">` + `aspect-ratio: 4/5`.
- Tap target: the whole card routes to `/plate/:id`.

### 4.4 Feed API contract
**🔌 CONTRACT** — `GET /api/v1/plates`
Query params:
- `state` (optional, 2-letter code or `DC`)
- `sort` — `recent` | `top_day` | `top_week` | `top_all`
- `cursor` (optional, opaque base64 string from previous response)
- `limit` (default 24, max 48)

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "image_url": "https://<supabase>/storage/v1/object/public/plates/...",
      "image_thumb_url": "...",
      "plate_text": "FARMLYF",
      "state_code": "NH",
      "state_name": "New Hampshire",
      "author": { "id": "uuid", "display_name": "...", "avatar_url": "..." } | null,
      "score": 42,
      "upvotes": 50,
      "downvotes": 8,
      "user_vote": 1 | -1 | 0,
      "comment_count": 3,
      "created_at": "2026-04-16T14:00:00Z"
    }
  ],
  "next_cursor": "eyJ..." | null
}
```

---

## Phase 5 — Upload Flow

This is the most complex user-facing feature because it touches auth, storage, moderation, and real-time feedback.

### 5.1 UX flow
1. User navigates to `/upload` → protected route, redirects to login if needed.
2. Step 1 — **Choose photo**: large dashed-border drop zone with a serif "Drop your photo here" headline. Accepts drag-and-drop or click-to-browse. On mobile, the browse button opens the camera directly via `<input type="file" accept="image/*" capture="environment">`.
3. Step 2 — **Preview & details**: once a file is selected, show a full-bleed preview with an EXIF-stripped crop preview. Below, a minimal form:
   - Plate text (auto-filled from OCR if backend returned a guess — see 5.4 — but editable). Uppercase input, serif font, 1ch letter-spacing.
   - State dropdown (required). Auto-selected from EXIF GPS if present, else blank.
   - Optional caption (140 char limit).
4. Step 3 — **Submit & moderation**: user hits "Submit". The UI shows a multi-stage progress indicator (client-side validation → uploading → moderation → published). Each stage fades in with its own serif label. If moderation fails, the UI surfaces the specific rejection reason. If it passes, redirect to `/plate/:id` with a subtle "Published" toast.

### 5.2 Client-side validation (pre-upload gate)
Before touching the network:
- File type: JPEG / PNG / WebP / HEIC (convert HEIC client-side via `heic2any` or let the backend handle).
- File size: reject > 10 MB client-side with a friendly message (backend will also reject).
- Dimensions: reject < 400px on the short edge.
- Strip EXIF GPS before upload (using `piexifjs` or similar) — privacy. Keep orientation.

### 5.3 Upload path — two supported strategies, pick one
**Strategy A (recommended): Direct-to-Supabase Storage with signed upload URL from backend.**
- **🔌 CONTRACT — Step 1:** `POST /api/v1/uploads/sign` with body `{ content_type, file_size_bytes, client_hash }` → backend checks user rate limit (see Phase 7.2), responds `{ upload_token, signed_url, object_path, expires_at }`.
- Frontend PUTs the file bytes directly to `signed_url`. Shows progress via `XMLHttpRequest.upload.onprogress` (fetch doesn't expose upload progress).
- **🔌 CONTRACT — Step 2:** On successful upload, `POST /api/v1/plates` with `{ upload_token, object_path, plate_text, state_code, caption }`. Backend downloads the object internally, runs moderation, writes the plate row, returns the final `Plate` object (or a 422 with moderation rejection reason).

**Strategy B (simpler, slower, uses backend bandwidth): multipart POST to backend.**
- Single `POST /api/v1/plates` with `multipart/form-data` carrying the file + fields. Backend uploads to Supabase itself.
- Easier but doubles bandwidth. Only use if Cloudflare Pages → FastAPI hop is short.

Pick **A** for the real build. Keep B behind a feature flag for fallback.

### 5.4 Optional OCR hint
- Before showing Step 2's form, fire `POST /api/v1/uploads/ocr-hint` with the signed upload token (or the file if Strategy B). Backend returns `{ plate_text_guess: string | null, confidence: number }`. Pre-fill the plate text field if confidence > 0.6.
- This is "nice to have" — fine to skip for v1.

### 5.5 Moderation result surfacing
Backend moderation can return:
- `status: "approved"` → plate is live, redirect to detail.
- `status: "rejected"`, `reason: "not_a_plate" | "explicit" | "duplicate" | "spam_rate_limit" | "offensive_text"` → show reason-specific copy. Don't be preachy. Serif headline like "This one didn't make it." + a one-line explanation + a "Try again" link.
- `status: "pending_review"` is **not** a valid state per the brief (no manual queue). Backend must always produce approved or rejected synchronously.

### 5.6 Upload error states
- Network failure mid-upload → offer retry with the same `upload_token` (it's valid for 10 min).
- 429 rate-limited → serif "You've uploaded a lot today. Come back in a bit." with a countdown derived from the `Retry-After` header. **🔌 CONTRACT:** Backend must send `Retry-After` in seconds on 429.

---

## Phase 6 — Plate Detail, Voting & Comments

### 6.1 `/plate/:id` layout
- Two-column on desktop: left is the full-bleed image (sticky, 60% width), right is content (40%). Single column stacked on mobile.
- Content column: eyebrow with state name, serif headline showing the plate text (huge — 6xl), small meta line (uploader display name + date), optional caption as serif italic block quote.
- Vote control: a horizontal bar with up-arrow, score (serif numerals), down-arrow. Optimistic update on click.
- Comments section below (if implemented in v1).
- "More from [State]" strip at the bottom: 4 related plates from the same state.

### 6.2 Vote interaction
- Clicking up/down while unauthenticated → modal asking to sign in (don't punt them to a full page).
- Optimistic update: immediately adjust `score`, `user_vote`, `upvotes`/`downvotes` in the TanStack cache. On error, roll back and toast.
- **🔌 CONTRACT:** `POST /api/v1/plates/:id/vote` with `{ value: 1 | -1 | 0 }` (0 means retract). Response: `{ score, upvotes, downvotes, user_vote }`.

### 6.3 Detail API
**🔌 CONTRACT** — `GET /api/v1/plates/:id` returns the same `Plate` shape as the feed plus:
- `related_plates: Plate[]` (up to 4 from same state, by score)
- `comments_enabled: boolean`

### 6.4 Comments (nice-to-have)
If included:
- **🔌 CONTRACT:** `GET /api/v1/plates/:id/comments?cursor=...` and `POST /api/v1/plates/:id/comments` with `{ body }`. Comment body passed through the same text moderator as plate captions.
- Simple threaded list, newest-first. No nesting in v1.

---

## Phase 7 — Interactive US Map

### 7.1 Tech choice
Use `react-simple-maps` + a TopoJSON for the US (includes DC). It's lightweight, SVG-based, and easy to style to match the aesthetic.

### 7.2 `/states` view
- Full-bleed map on a bone background. Wide serif headline above: "The United States of Vanity."
- Each state path is filled:
  - `cream` if `plate_count === 0` (locked)
  - `sage` if `plate_count > 0`, saturation scales with count (bucketed 1–5, 6–25, 26+)
- Hover: state darkens slightly, tooltip appears anchored to the cursor showing state name + plate count + a tiny thumbnail of the top plate.
- Click: routes to `/states/:code`.
- Legend at bottom-right: tiny swatch row explaining the tint scale.
- DC is tricky — render as a labeled dot near Maryland.

### 7.3 Map data
**🔌 CONTRACT:** `GET /api/v1/map/summary` returns:
```json
{
  "states": [
    { "code": "MA", "name": "Massachusetts", "plate_count": 42, "top_plate_id": "uuid" }
  ]
}
```
Cached aggressively — `staleTime: 5 * 60_000`.

### 7.4 `/states/:code` page
- Hero: full-bleed image of that state's current #1 plate. Overlay with state name in serif (display-2xl) and "X plates · Y votes cast" eyebrow.
- "Top 10 in [State]" — numbered list, large serif numerals on the left, plate card on the right. Subtle divider between rows.
- "All plates from [State]" grid below, infinite scroll, same card style as the gallery.
- **🔌 CONTRACT:** `GET /api/v1/states/:code` for the hero + top-10. `GET /api/v1/plates?state=XX&sort=recent` for the full grid.

---

## Phase 8 — Leaderboards

### 8.1 `/leaderboard` page
- Tab row at the top: All-time · This month · This week · Today. Selection updates URL `?window=week`.
- Top 3 get oversized "podium" treatment: large image, huge serif score numeral (e.g. "237"), plate text in serif, state as eyebrow.
- Ranks 4–50 in a table-ish list with thin hairline dividers.
- **🔌 CONTRACT:** `GET /api/v1/leaderboard/overall?window=day|week|month|all&limit=50`.

### 8.2 Per-state leaderboard
Embedded inside the `/states/:code` page per Phase 7.4. Same visual treatment but scoped.

---

## Phase 9 — Profile & My-Content

### 9.1 `/profile` page (protected)
- Header with avatar (Supabase `user_metadata.avatar_url` from Google), serif display name, "Member since" eyebrow.
- Tabs: My Plates · My Votes.
- My Plates: grid of user's own uploads with a small status badge (approved / rejected-with-reason).
- My Votes: chronological list of plates the user voted on, with their vote direction.
- **🔌 CONTRACT:** `GET /api/v1/me`, `GET /api/v1/me/plates?cursor=...`, `GET /api/v1/me/votes?cursor=...`.

### 9.2 Sign-out
Header menu with avatar → dropdown with "Sign out". Calls `supabase.auth.signOut()` and invalidates all queries (`queryClient.clear()`).

---

## Phase 10 — Animation & Micro-interactions

Keep it restrained. Copying scleasing's discipline:
- **Scroll reveals**: every `<section>` wrapped in `<RevealOnScroll>`. Stagger children by 80ms.
- **Hero parallax**: background image `y` tied to scroll, multiplier 0.3.
- **Image hovers**: scale 1.03, 600ms cubic-bezier, no shadow change.
- **Link hovers**: underline draws left-to-right via a pseudo-element width transition, 400ms.
- **Page transitions**: 8px y-fade, 300ms.
- **Button/CTA hover**: background lightens by 6%, 200ms.
- **Vote click**: tiny 1.15× scale pulse on the arrow, 200ms ease-out.
- **No** bouncy spring physics, no confetti, no auto-playing sound.
- Respect `prefers-reduced-motion` — disable parallax and reveals, keep cross-fades.

---

## Phase 11 — Accessibility

- Color contrast: verify all text hits WCAG AA (charcoal on bone passes easily; double-check stone on cream).
- Keyboard: every interactive element reachable and visible focus ring (oxblood 2px outline, 2px offset).
- Alt text on every plate image: `"Vanity plate reading '{plate_text}' from {state_name}"`.
- Map: each state path has `<title>` and `aria-label`; clickable via keyboard (tab through paths).
- Form labels: all inputs have explicit `<label>`, not just placeholders.
- Toasts: `role="status"` for success, `role="alert"` for errors.

---

## Phase 12 — Performance

- Route-level code splitting (`React.lazy` for upload, profile, leaderboard, map).
- Image delivery: Supabase transformation params `?width=800&quality=75&format=webp` for cards, `?width=1600` for detail, `?width=200` for thumbs in the map tooltip.
- Preload hero image with `<link rel="preload" as="image">` injected in `index.html`.
- Fonts: self-host Playfair Display and Inter subset, `font-display: swap`. Preload the two hero weights.
- Lighthouse target: 95+ Performance, 100 Accessibility, 95+ Best Practices on mobile.

---

## Phase 13 — Deployment (Cloudflare Pages)

### 13.1 Build
- Vite build outputs to `dist/`. 
- Set project root to `frontend/` in Cloudflare Pages.
- Build command: `npm run build`. Output directory: `dist`.
- Node version: 20.

### 13.2 Environment variables in CF Pages dashboard
- `VITE_API_BASE_URL` → production FastAPI URL
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET`

### 13.3 SPA routing
Add `_redirects` file in `public/`:
```
/*  /index.html  200
```

### 13.4 Preview deployments
Each PR gets its own preview URL. Backend needs to include these preview origins in CORS allowlist (see backend Phase 2.4) — use a regex allow like `^https://.*\.platergallery\.pages\.dev$` rather than enumerating.

### 13.5 Custom domain
Attach custom domain (e.g. `platergallery.com`) via Cloudflare Pages → Custom domains. Auto-TLS.

---

## Phase 14 — Testing

- **Unit**: Vitest + Testing Library for components with logic (vote button, filter chips, upload state machine).
- **Integration**: MSW mocks the entire API surface defined by the contracts above. Run the full upload flow against mocks.
- **E2E smoke** (optional for v1): Playwright script — sign in → upload a test fixture → verify it appears in the gallery.
- **Visual regression** (optional): Chromatic or Percy on the 6 main pages.

---

## Phase 15 — Handoff / Submission

Per the brief, submit:
- Live URL (Cloudflare Pages production)
- GitHub repo (forked from `hack-bu/plate-gallery`)
- README covering: stack, how moderation works (from the frontend's POV — what it shows the user and why), design decisions (the scleasing-inspired editorial treatment, the direct-to-Supabase upload path).
- Open a PR from the fork to the parent repo.

---

## Appendix A — Contract summary (what frontend expects from backend)

All endpoints are prefixed `/api/v1`. All responses are JSON. Authenticated endpoints require `Authorization: Bearer <supabase_jwt>`. Error envelope is always `{ error: { code, message, details? } }` with appropriate HTTP status.

| Method | Path | Auth | Purpose | Phase |
|---|---|---|---|---|
| POST | `/users/sync` | ✅ | Upsert user on first login | 1.4 |
| GET | `/me` | ✅ | Current user profile | 9.1 |
| GET | `/me/plates` | ✅ | User's own uploads (incl. rejected) | 9.1 |
| GET | `/me/votes` | ✅ | User's voting history | 9.1 |
| GET | `/plates` | ⬜ | Paginated feed, filterable, sortable | 3.2, 4.4 |
| GET | `/plates/:id` | ⬜ | Single plate detail | 6.3 |
| POST | `/uploads/sign` | ✅ | Pre-upload: rate-limit check + signed storage URL | 5.3 |
| POST | `/uploads/ocr-hint` | ✅ | Optional OCR guess for plate text | 5.4 |
| POST | `/plates` | ✅ | Finalize upload: moderate + publish | 5.3, 5.5 |
| POST | `/plates/:id/vote` | ✅ | Cast / change / retract vote | 6.2 |
| GET | `/plates/:id/comments` | ⬜ | Comments list | 6.4 |
| POST | `/plates/:id/comments` | ✅ | New comment | 6.4 |
| GET | `/states/:code` | ⬜ | State page hero + top-10 | 7.4 |
| GET | `/map/summary` | ⬜ | Per-state counts for map | 3.3, 7.3 |
| GET | `/leaderboard/overall` | ⬜ | Time-windowed global top | 3.4, 8.1 |

If any of these contracts change, both plans update together.
