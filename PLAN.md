# LoveMapper — Technical Plan

> Multi-user photo memory app: upload geotagged photos, browse on an interactive map.

---

## 1. Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | **Next.js 15 (App Router)** | Server Actions for uploads, API routes, SSR for SEO, built-in image optimization, single deployable |
| **Language** | TypeScript | Catches bugs early, Supabase/Mapbox types included |
| **Auth + DB** | **Supabase** | Managed Postgres + Auth + RLS out of the box, generous free tier |
| **Photo Storage** | **Cloudinary** | Upload API, automatic transforms (thumbnails via URL params), CDN delivery |
| **Map** | **react-map-gl** + Mapbox GL JS | React wrapper with `<Marker>`, `<Popup>`, cluster support. First-class React integration |
| **Styling** | **Tailwind CSS 4** | Rapid mobile-first styling, utility classes, tiny bundle |
| **Deployment** | **Vercel** | Zero-config Next.js deploys, preview branches, edge functions |
| **EXIF Parsing** | **exifr** (browser) | Extract lat/lng from photo EXIF before upload — no server processing needed |

---

## 2. Data Model (Supabase Postgres)

### `profiles` table
```sql
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  username    text unique not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz default now(),
  constraint username_length check (char_length(username) >= 3)
);

-- Auto-create profile on signup
create function public.handle_new_user()
returns trigger
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'user_' || left(new.id::text, 8)),
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### `memories` table
```sql
create table public.memories (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  caption       text not null default '',
  latitude      double precision not null,
  longitude     double precision not null,
  location_name text,                          -- reverse-geocoded (optional)
  photo_url     text not null,                 -- Cloudinary URL (original)
  photo_public_id text not null,               -- Cloudinary public_id for transforms
  visibility    text not null default 'private' check (visibility in ('private', 'public', 'link')),
  share_token   text unique,                   -- random token for shareable links (visibility='link')
  taken_at      timestamptz,                   -- EXIF date or user-supplied
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Geo index for map viewport queries
create index memories_geo_idx on public.memories (latitude, longitude);
-- User + time index for feed
create index memories_user_time_idx on public.memories (user_id, created_at desc);
-- Public memories index for Explore map
create index memories_public_idx on public.memories (visibility, created_at desc) where visibility = 'public';
-- Caption search index
create index memories_caption_search_idx on public.memories using gin (to_tsvector('english', caption));
-- Share token lookup
create index memories_share_token_idx on public.memories (share_token) where share_token is not null;
```

### Row Level Security
```sql
alter table public.profiles enable row level security;
alter table public.memories enable row level security;

-- Profiles: public read, self write
create policy "Profiles are viewable by everyone"
  on profiles for select using (true);
create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Memories: owner CRUD + public read + share link read
create policy "Users can view own memories"
  on memories for select using (auth.uid() = user_id);
create policy "Anyone can view public memories"
  on memories for select using (visibility = 'public');
create policy "Anyone can view shared memories by token"
  on memories for select using (share_token is not null AND visibility = 'link');
create policy "Users can insert own memories"
  on memories for insert with check (auth.uid() = user_id);
create policy "Users can update own memories"
  on memories for update using (auth.uid() = user_id);
create policy "Users can delete own memories"
  on memories for delete using (auth.uid() = user_id);
```

---

## 3. API Design

All mutations via **Next.js Server Actions**. Reads via **Supabase client** (RLS enforced).

### Server Actions (`app/actions/`)

| Action | Input | What it does |
|--------|-------|-------------|
| `uploadMemory` | `FormData` (file, caption, lat, lng, taken_at, visibility) | Upload to Cloudinary → insert row in `memories` → return memory |
| `updateMemory` | `{ id, caption?, location_name?, visibility? }` | Update memory row (owner only via RLS) |
| `deleteMemory` | `{ id }` | Delete from Cloudinary + delete row |
| `updateProfile` | `{ username?, full_name?, avatar_url? }` | Update profile row |
| `generateShareLink` | `{ id }` | Generate `share_token`, set visibility='link', return share URL |
| `revokeShareLink` | `{ id }` | Clear `share_token`, set visibility='private' |

### Client-Side Reads (Supabase JS)

| Query | Purpose |
|-------|---------|
| `memories.select('*').eq('user_id', uid)` | All memories for user's map pins |
| `memories.select('*').eq('user_id', uid).order('created_at', { ascending: false }).range(from, to)` | Paginated feed |
| `memories.select('*').eq('id', memoryId)` | Single memory detail |
| `memories.select('*').eq('visibility', 'public').order('created_at', { ascending: false })` | Explore page — all public memories |
| `memories.select('*').eq('visibility', 'public').eq('user_id', uid)` | Public profile page |
| `memories.select('*').eq('share_token', token)` | Shared link lookup |
| `memories.select('*').eq('user_id', uid).gte('latitude', sw_lat).lte('latitude', ne_lat).gte('longitude', sw_lng).lte('longitude', ne_lng)` | Map viewport bounding box |
| `memories.select('*').eq('user_id', uid).textSearch('caption', query)` | Caption full-text search |
| `memories.select('*').eq('user_id', uid).gte('taken_at', start).lte('taken_at', end)` | Date range filter |

### API Routes (`app/api/`)

| Route | Purpose |
|-------|---------|
| `POST /api/cloudinary/signature` | Generate signed upload params (keeps API secret server-side) |

---

## 4. Core Features

### F1: Authentication
- Email/password signup + login via Supabase Auth
- **OAuth: Google + Apple** via Supabase Auth (3 lines of config each)
- Session managed via `@supabase/ssr` (cookie-based, works with SSR)
- Protected routes via middleware (`middleware.ts`)
- Auto-profile creation via DB trigger

### F2: Photo Upload
- Client extracts EXIF geotag (lat/lng) + date via `exifr`
- If no EXIF geotag → manual pin placement on map (click to set location)
- Client-side signed upload directly to Cloudinary (no server relay for the file)
- Server action saves metadata to Supabase after upload confirms

### F3: Map View (Primary)
- Full-viewport Mapbox map via `react-map-gl`
- Custom pin markers per memory (thumbnail via Cloudinary transform URL)
- Click pin → `<Popup>` with thumbnail + caption + date
- Click popup → full detail modal with full-res image
- Cluster pins when zoomed out (supercluster or Mapbox built-in)

### F4: Feed View (Secondary)
- Reverse-chronological card list
- Each card: thumbnail, caption, date, location name
- Click card → same detail modal
- Infinite scroll pagination (`range()` queries)

### F5: Memory Detail
- Full-resolution image (Cloudinary original URL)
- Caption, date, location name
- Edit caption / delete memory
- "View on map" button (flies to pin on map)

### F6: Profile
- View/edit username, full name, avatar
- Stats: total memories, date range
- Public profile page at `/u/username` showing public memories on a map

### F7: Social — Sharing & Visibility
- **Visibility toggle** per memory: private (default), public, or link-only
- **Shareable links**: `/memory/share/{token}` — no login required to view
- **Public profile map**: `/u/{username}` — shows all public memories on a map
- **Explore page**: `/explore` — browse all public memories on a shared map

### F8: Search & Filter
- **Caption search**: text search across memory captions (Postgres `to_tsvector`)
- **Date range filter**: pick start/end dates, filter map pins and feed
- **Map viewport query**: only fetch memories within visible map bounds (bounding box query)
- Combined: search + date range + map bounds all composable

---

## 5. Cloudinary Strategy

### Upload
- **Signed uploads** from the browser → Cloudinary
- Server generates signature via `/api/cloudinary/signature`
- Upload preset: auto-quality, auto-format, max 4096px on long edge

### Transform URLs (no extra storage cost)
```
Map thumbnail:  https://res.cloudinary.com/{cloud}/image/upload/c_fill,w_80,h_80,q_auto,f_auto/{public_id}
Feed card:      https://res.cloudinary.com/{cloud}/image/upload/c_fill,w_400,h_300,q_auto,f_auto/{public_id}
Detail full:    https://res.cloudinary.com/{cloud}/image/upload/q_auto,f_auto/{public_id}
```
All transforms are URL-based — Cloudinary generates and caches on first request.

---

## 6. Project Structure

```
lovemapper/
├── app/
│   ├── layout.tsx              # Root layout, providers, fonts
│   ├── page.tsx                # Landing / redirect to map
│   ├── globals.css             # Tailwind imports
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   ├── callback/route.ts   # OAuth callback handler
│   │   └── layout.tsx          # Auth layout (centered card)
│   ├── (app)/
│   │   ├── layout.tsx          # App shell (nav, protected)
│   │   ├── map/page.tsx        # Map view (primary)
│   │   ├── feed/page.tsx       # Feed view
│   │   ├── explore/page.tsx    # Public explore map
│   │   ├── profile/page.tsx    # Own profile
│   │   └── upload/page.tsx     # Upload flow
│   ├── (public)/
│   │   ├── u/[username]/page.tsx    # Public user profile map
│   │   └── memory/
│   │       └── share/[token]/page.tsx  # Shared memory view (no auth required)
│   ├── actions/
│   │   ├── memories.ts         # uploadMemory, updateMemory, deleteMemory
│   │   ├── sharing.ts          # generateShareLink, revokeShareLink
│   │   └── profile.ts          # updateProfile
│   └── api/
│       ├── cloudinary/
│       │   └── signature/route.ts
│       └── auth/
│           └── callback/route.ts   # Supabase OAuth callback
├── components/
│   ├── map/
│   │   ├── MapView.tsx         # Map + markers + popups
│   │   ├── MemoryMarker.tsx    # Custom pin component
│   │   └── MemoryPopup.tsx     # Popup on click
│   ├── feed/
│   │   ├── FeedList.tsx        # Infinite scroll list
│   │   └── MemoryCard.tsx      # Feed card
│   ├── memory/
│   │   ├── MemoryDetail.tsx    # Full detail modal
│   │   ├── UploadForm.tsx      # Upload form + EXIF extraction
│   │   ├── LocationPicker.tsx  # Manual pin placement
│   │   ├── VisibilityToggle.tsx # Private / public / link toggle
│   │   └── ShareLinkButton.tsx # Generate + copy share link
│   ├── search/
│   │   ├── SearchBar.tsx       # Caption search input
│   │   ├── DateRangeFilter.tsx # Date range picker
│   │   └── FilterBar.tsx       # Combined search + filters
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── OAuthButtons.tsx    # Google + Apple sign-in buttons
│   └── ui/
│       ├── NavBar.tsx
│       ├── Modal.tsx
│       └── LoadingSpinner.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # Browser client
│   │   ├── server.ts           # Server client (cookies)
│   │   └── middleware.ts       # Auth middleware helper
│   ├── cloudinary.ts           # Upload helpers, URL builders
│   ├── exif.ts                 # EXIF extraction wrapper
│   ├── search.ts               # Search query builder helpers
│   └── types.ts                # Shared TypeScript types
├── middleware.ts                # Next.js middleware (auth redirect)
├── supabase/
│   └── migrations/
│       └── 001_initial.sql     # Full schema
├── .env.local                  # Secrets (gitignored)
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

---

## 7. MVP Scope (What Ships First)

### In MVP ✅
- Email/password auth (signup, login, logout)
- **OAuth: Google + Apple sign-in**
- Photo upload with EXIF geotag extraction
- Manual pin placement fallback (no EXIF)
- Map view with pins, click for popup, click for detail
- Feed view (reverse chronological, paginated)
- Edit caption / delete memory
- Mobile-first responsive layout
- Cloudinary thumbnail transforms
- **Visibility toggle**: private / public / link-only per memory
- **Shareable links**: view a single memory without login
- **Public profile page**: `/u/username` with map of public memories
- **Explore page**: browse all public memories on a shared map
- **Caption search**: search your own memories by caption text
- **Date range filter**: filter map + feed by date
- **Map viewport queries**: only load pins within visible bounds

### NOT in MVP ❌
- Follow/friend system + social feed
- Comments / reactions on memories
- Group albums or shared collections
- Offline support / PWA
- Photo editing / cropping
- Reverse geocoding (auto location names)
- Map clustering (add when > 100 pins)
- Tag / category system
- Notifications

---

## 8. Phased Build Order

### Phase 1 — Foundation (Day 1)
1. `create-next-app` with TypeScript + Tailwind + App Router
2. Supabase project setup + schema migration (profiles + memories with visibility/share columns)
3. Supabase auth integration (`@supabase/ssr`)
4. Auth pages: email/password signup + login
5. **OAuth: Google + Apple** sign-in buttons + callback route
6. Middleware for protected routes
7. Basic app shell layout (nav bar, route structure)

**Checkpoint:** Can sign up (email or Google/Apple), log in, see protected empty app shell.

### Phase 2 — Upload Pipeline (Day 2)
1. Cloudinary account + upload preset config
2. Signed upload API route
3. EXIF extraction with `exifr`
4. Upload form component (file picker → EXIF → preview → upload)
5. **Visibility toggle** on upload form (private/public/link)
6. `uploadMemory` server action (Cloudinary → Supabase)
7. Location picker fallback (click map to set pin)

**Checkpoint:** Can upload a photo with visibility setting, see it stored in Cloudinary + Supabase.

### Phase 3 — Map View (Day 2-3)
1. Mapbox account + token
2. `react-map-gl` map component (full viewport)
3. Fetch memories → render as `<Marker>` pins
4. **Map viewport bounding box query** (only load visible pins)
5. Click marker → `<Popup>` with thumbnail + caption
6. Click popup → detail modal (full-res image, edit, delete)

**Checkpoint:** Can see memories as pins on map, only loading what's visible, click through to details.

### Phase 4 — Social + Sharing (Day 3)
1. **Visibility toggle** in memory detail (change after upload)
2. **Share link generation** — `generateShareLink` action + copy-to-clipboard
3. **Shared memory page** — `/memory/share/[token]` (public, no auth)
4. **Public profile page** — `/u/[username]` with map of public memories
5. **Explore page** — `/explore` showing all public memories on a shared map

**Checkpoint:** Can share individual memories via link, view public profiles, browse Explore map.

### Phase 5 — Search & Filter (Day 3-4)
1. **Search bar** component — caption full-text search
2. **Date range filter** — date picker, filters both map and feed
3. **Filter bar** — combined search + date range, composable
4. Wire filters into map viewport queries (search + date + bounds)
5. Wire filters into feed pagination

**Checkpoint:** Can search captions, filter by date, filters apply to both map and feed views.

### Phase 6 — Feed + Polish (Day 4-5)
1. Feed page with memory cards (shows visibility badge)
2. Infinite scroll pagination
3. Click card → same detail modal
4. "View on map" from detail (fly-to animation)
5. Profile page (view/edit)
6. Empty states, loading skeletons, error handling
7. Mobile responsive pass (bottom nav, touch targets)

**Checkpoint:** Full MVP — all views, social, search working and responsive.

### Phase 7 — Deploy + Harden (Day 5)
1. Vercel deployment
2. Environment variables in Vercel dashboard
3. OAuth redirect URLs configured for production domain
4. Rate limiting on upload + share actions
5. Image size validation (client + server)
6. Error boundaries
7. Basic SEO (meta tags, OG image — shared memories get OG previews)

**Checkpoint:** Live on the internet, hardened, shareable links generate rich previews.

---

## 9. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...          # Server-only, never exposed

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx                  # Server-only

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx
```

---

## 10. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Client-side EXIF | `exifr` in browser | Avoids uploading to server first just to read geotag |
| Direct-to-Cloudinary upload | Signed upload from browser | No server file relay, faster, less infra |
| Cloudinary transforms via URL | No pre-generated thumbnails | Zero storage overhead, on-demand generation, CDN cached |
| `react-map-gl` over raw Mapbox | React components for markers/popups | Declarative, easier state management, less boilerplate |
| Server Actions over API routes | For all mutations | Type-safe, co-located with components, less boilerplate than REST |
| Cookie-based auth (`@supabase/ssr`) | Over `auth-helpers` | Official recommendation, works with App Router + SSR + middleware |
| No ORM | Direct Supabase client | Supabase JS client IS the query builder, adding Prisma/Drizzle adds complexity for no gain here |
| OAuth (Google + Apple) | Via Supabase Auth | Near-zero implementation cost, massive reduction in signup friction |
| 3-tier visibility model | private / public / link | Covers all sharing needs without a friend/follow system. Simple column + RLS policy |
| Token-based share links | Random token on memory row | No join table needed, revokable, RLS-friendly. `/memory/share/{token}` |
| Postgres full-text search | `to_tsvector` + GIN index on captions | Good enough for MVP scale, no external search service, built into Supabase |
| Viewport bounding box queries | Filter by lat/lng range | Essential for performance — don't load 10k pins when viewing one city. Uses existing geo index |
| No follow/friend system | Deferred | Adds notifications, privacy controls, feed aggregation — huge scope. Public profiles + share links cover 80% of the social value |
