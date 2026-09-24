# Last Roll

**Find your stakes. Meet your opponent. Keep the receipt.**

An independent practice deathroll matchmaker for the WoW: Forever community, with the free Rollkeeper companion addon. A full-stack React/TypeScript app with an Express API and persistent SQLite storage.

> **Practice edition:** no real gold, deposits, payments, or prizes. Sample opponents are clearly labeled. Character information is self-reported. The website does not connect to the WoW client, verify character ownership, detect layers, or guarantee payment. Not affiliated with Blizzard Entertainment.

## Run locally

Requires **Node.js 24 or 25** and npm. Node 24 LTS is used in CI and Docker. The built-in `node:sqlite` module may print an experimental warning on some Node releases.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The API runs on port 3001. The addon ZIP is generated automatically. No API keys, external accounts, or paid services are needed.

For a production build:

```sh
npm run build
NODE_ENV=production npm start
```

Open **http://127.0.0.1:3001**. SQLite data lives in `.data/last-roll.db` and is excluded from Git. Keep the database and its WAL files on persistent local storage. Do not deploy this app to a static-only host or ephemeral serverless filesystem.

## What works

- Responsive lobby, character editor, name/class/location search, and a same-meeting-place filter.
- Stake preferences, explicit maximums, a preferred amount, established-opponent preference, and daily practice loss limits.
- Fictional practice partners with automatic responses. Their illustrative history never improves a user's community reputation.
- A real community queue shared by browsers connected to the same server, with 15-minute availability, invitations, mutual acceptance/readiness, and one active match per player.
- Server-generated rolls, enforced turn order, full roll history, explicit practice settlement acknowledgements, disputes, and persistence across reloads/restarts.
- Complete copyable match tickets, untrusted addon receipt attachments, and downloadable Rollkeeper source.
- Hashed guest-session tokens in HttpOnly cookies, participant authorization on every match endpoint, request-origin checks, input validation, and per-IP rate limiting.

To test with two people, share an accessible instance and use separate browser profiles. Locally, `127.0.0.1:5173` and `localhost:5173` use separate cookie sessions against the same server. Choose compatible character pools and preferences, then join the community queue. Normal tabs on the same hostname share one identity.

## Rollkeeper addon

Run `npm run addon:package` to create `public/downloads/Rollkeeper.zip`. The production build also includes it at `/downloads/Rollkeeper.zip`.

The addon imports practice terms, observes supported system-roll messages, and exports a client-supplied receipt. It does not automate rolls, trades, movement, chat, invitations, or payments. The website and addon practice runs are separate: attaching a receipt never replaces website outcomes or confirmations.

**Forever client compatibility is unverified.** The `.toc` interface value is a placeholder; follow the [addon README](addon/Rollkeeper/README.md) to check the target client. Lua syntax and core behavior are tested, but in-game UI, localized messages, secondary names, and client API behavior still need a two-player Forever test.

## Verification

```sh
npm run check
npm test
npm run build
```

Tests cover compatibility, stake bounds, loss limits, authorization, CSRF defenses, turn order, invitations, settlement, concurrent challenges, expiration, persistence, ticket encoding, receipt isolation, Lua 5.1 syntax, and executable addon-core behavior. GitHub Actions runs these checks and uploads the addon ZIP.

Browser checks during development covered a full sample match, settlement/history, profile and filter controls, addon download, and responsive layouts. API integration tests exercise independent users.

## Deployment

```sh
docker compose up --build -d
```

This binds to **127.0.0.1:3001**, uses a named volume for SQLite, and runs the container as a non-root user. Put a TLS reverse proxy in front of it for external access. Set `PUBLIC_ORIGIN` to the exact HTTPS origin; that also enables Secure cookies behind the proxy. See [.env.example](.env.example) for available settings. The server reads process environment variables, not `.env` automatically. Docker Compose uses its normal `.env` interpolation for `PUBLIC_ORIGIN`.

Keep a single application process for this SQLite implementation. Database transaction operations are synchronous within that process. Horizontal scaling needs a shared database and transactional reservations. Reverse-proxy IP forwarding is intentionally not trusted by default; configure a precise trusted proxy policy before changing rate-limit behavior. Docker packaging is provided; do not infer that a container was tested unless CI or your environment runs it.

## Product boundaries and next steps

1. **Verify Forever APIs in the client.** Character identity, region/ruleset, coordinates, group visibility, and trade events need a compatibility spike. Treat unknown layers as unknown.
2. **Clarify Blizzard policy for the exact product.** Blizzard [prohibits advertising casinos/deathrolls](https://us.support.blizzard.com/en/help/article/227547). Its [deathroll support policy](https://us.support.blizzard.com/en/help/article/18164) does not provide loss restoration. Moving discovery to a website does not establish approval.
3. **Add supported identity verification.** Guest sessions are deliberately low-trust and can be recreated. They expire after seven days; clearing cookies loses access to the guest profile. No recovery, Battle.net ownership verification, Sybil resistance, or production moderation is implemented.
4. **Test observation without enforcement claims.** Trade evidence is client-supplied, mutable, and never a guarantee. Receipt imports cannot settle a match or penalize another player.
5. **Add account/privacy operations before an open community launch.** Queued character details are visible to compatible visitors. Match details are restricted to participants. The local database retains records until an operator removes them; the prototype has no account-deletion or recovery UI.

The addon must remain free and source-visible under Blizzard's [UI Add-On Development Policy](https://us.forums.blizzard.com/en/wow/t/ui-add-on-development-policy/24534). No paid tier, in-game advertisement, or donation prompt is included. The MIT license does not override Blizzard's policies.

## Project map

| Path                | Purpose                                                  |
| ------------------- | -------------------------------------------------------- |
| `src/`              | React interface and responsive styling                   |
| `server/`           | API, matchmaking, server rolls, session security, SQLite |
| `shared/`           | Shared types and constraints                             |
| `addon/Rollkeeper/` | Lua addon and installation instructions                  |
| `tests/`            | API, domain, and addon checks                            |
| `docs/`             | Architecture and ticket protocol                         |

[MIT](LICENSE) · Built in public by ForkFiesta and contributors.
