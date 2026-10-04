# SuperTalks - Astrologer Admin Frontend

Astrologer-facing web app for the SuperTalks platform. Astrologers can register, manage their profile, answer client questions, and handle bookings.

## Tech Stack

- **Runtime:** Bun
- **Framework:** React 19 + TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui (New York style)
- **Routing:** React Router v7
- **Toasts:** Sonner

## Getting Started

### Prerequisites

- [Bun](https://bun.com) v1.4+
- Backend running at `http://localhost:3000` (see `../backend`)

### Install dependencies

```bash
bun install
```

### Start dev server

```bash
bun run dev
```

The app runs at `http://localhost:3001`.

### Production build

```bash
bun run build   # outputs to dist/
bun run start   # serves production build
```

## Project Structure

```
src/
├── index.ts                  # Bun server entry point
├── frontend.tsx              # React DOM entry
├── App.tsx                   # Root component with routing
├── index.css                 # Global styles
├── contexts/
│   └── auth.tsx              # Auth provider (signin, signup, signout, token storage)
├── lib/
│   ├── api.ts                # API client (runtime wrappers for all backend endpoints)
│   └── utils.ts              # cn() utility
├── types/
│   └── index.ts              # Shared TypeScript types for API entities & responses
├── components/
│   ├── Navbar.tsx            # Top navigation bar
│   ├── ProtectedRoute.tsx    # Auth route guard
│   └── ui/                   # shadcn/ui components (button, card, dialog, tabs, pagination, etc.)
├── pages/
│   ├── SignIn.tsx            # Sign in form
│   ├── SignUp.tsx            # Registration form
│   ├── Dashboard.tsx         # Stats overview + recent questions/bookings
│   ├── Questions.tsx         # List, answer, and reject client questions (paginated)
│   ├── Bookings.tsx          # List, complete, reschedule, and cancel bookings (paginated)
│   └── Profile.tsx           # Edit bio, pricing, availability rules & exceptions
└── hooks/                    # (reserved for custom hooks)
```

## Routes

| Path | Auth | Description |
|------|------|-------------|
| `/signin` | No | Sign in with email/username + password |
| `/signup` | No | Register a new astrologer account |
| `/dashboard` | Yes | Stats cards and recent activity |
| `/questions` | Yes | Manage client questions (answer/reject) |
| `/bookings` | Yes | Manage bookings (complete/reschedule/cancel) |
| `/profile` | Yes | Edit bio, pricing, availability rules & exceptions |

## Backend Integration

The frontend talks to the backend at `http://localhost:3000` (`src/lib/api.ts`). The backend must have CORS enabled for the frontend origin, or you can set up a proxy.

### API Endpoints Used

**Auth:** `POST /auth/register`, `POST /auth/signin`, `POST /auth/signout`

**Astrologer Profile:** `GET /astrologers/me`, `PATCH /astrologers/me`, `PATCH /astrologers/me/pricing`, `GET /astrologers/me/stats`

**Availability:** `GET/POST /astrologers/me/availability-rules`, `PATCH/DELETE /astrologers/me/availability-rules/:id`

**Exceptions:** `GET/POST /astrologers/me/exceptions`, `DELETE /astrologers/me/exceptions/:id`

**Bookings:** `GET /bookings?limit=&offset=&status=`, `PATCH /bookings/:id/complete`, `PATCH /bookings/:id/reschedule`, `PATCH /bookings/:id/cancel`

**Questions:** `GET /questions?limit=&offset=&status=`, `PATCH /questions/:id/answer`, `PATCH /questions/:id/reject`

> The `GET /bookings` and `GET /questions` list endpoints are paginated server-side via `limit` (default 10, max 100) and `offset` query params. Responses include a `total` and per-status `counts` object, used by the dashboard stats cards and the per-tab count badges. List pages use the shadcn pagination control to page through results.

# TODO 

- fix client chat window ui the input box is getting to bottom to scroll and My Questions etc things are taking a lot of space

- phonepe integation - test mode working
- cloudiary integration - done
- production db integration - todo

- at last remove the docker postgres logic before pushing to prod

- signup -> register (if not register already, if register dont show this page) -> dashboard (take user details)

- username must be unique

- add logic to get all the location on the birth place is there any way? does shadcn input box has feature for this? as a person can make mistakes while writing place name. https://developers.google.com/maps/documentation/javascript/legacy/place-autocomplete

thinking to add a feature in customize tab's Start from a palette section to add a random theme selector. by clicking on it would randomly select colour and fonts, just this two to create website theme