# MikroServer - Google AI Studio Redesign Brief

## 1. Working assumption

I am treating "the site" as the full web product, not a separate marketing website.

Why:
- `frontend/src/app/page.tsx` redirects directly to `/dashboard`
- the real web surface today is:
  - auth
  - SaaS dashboard
  - public captive portal
  - settings / white-label / PWA

If a public marketing homepage is needed later, it should be designed as an additional surface, not confused with the current app shell.

## 2. Product snapshot

Product name:
- MikroServer

Core business:
- WiFi monetization SaaS for MikroTik hotspot operators in Cote d'Ivoire

Main value proposition:
- manage MikroTik routers remotely
- sell hotspot access via vouchers and mobile money
- operate multi-site WiFi businesses with dashboards, alerts, resellers, analytics, and white-label captive portals

Core payment flow:
- customer chooses a plan
- pays with Wave CI
- webhook validates payment
- voucher is generated and delivered
- customer gets WiFi access

Core technical reality that must influence UX:
- routers are real field devices with variable latency
- some router reads can be slow
- operators are not always deeply technical
- many actions are operationally sensitive
- the app must feel trustworthy, clear, and fast even when network operations are slow in the background

## 3. Primary user types

### A. Super Admin

Needs:
- oversee the platform globally
- manage operators and internal users
- access audit, accounting, subscription, security, settings

UX expectation:
- dense but controlled cockpit
- confidence, governance, and traceability

### B. Operator Admin

Needs:
- connect routers
- supervise router fleet
- manage plans, vouchers, sessions, customers, analytics
- configure white-label and support settings

UX expectation:
- operational clarity
- quick access to high-frequency actions
- minimal RouterOS jargon

### C. Reseller

Needs:
- work inside a constrained sales workspace
- generate or verify vouchers
- follow assigned routers / customers / transactions depending on permissions

UX expectation:
- focused workspace
- less clutter, fewer advanced controls

### D. Viewer

Needs:
- see activity and status
- avoid destructive actions

UX expectation:
- read-first dashboard with clear access boundaries

### E. End customer on captive portal

Needs:
- buy WiFi fast
- enter a voucher fast
- trust the payment process
- connect with minimal friction on mobile

UX expectation:
- consumer-grade polish
- very low cognitive load
- one-handed mobile flow
- very clear loading, success, and error states

## 4. Current product surfaces

## A. Auth

Routes:
- `/login`
- `/forgot-password`
- `/reset-password`

Current facts:
- login has email + password
- supports 2FA step
- admin-only positioning

Design implication:
- auth should feel secure, premium, and calm
- no generic startup login page

## B. Dashboard shell

Routes and shell:
- `/dashboard`
- shared sidebar + topbar
- theme toggle
- notification bell
- subscription banner
- PWA install prompt

Main modules visible in navigation:
- dashboard
- routers
- hotspot ops
- sessions
- vouchers
- plans
- customers
- operators
- users
- resellers
- notifications
- transactions
- incidents
- analytics
- audit
- accounting
- subscription
- settings
- 2FA
- white-label
- API keys

## C. Router operations

Critical screens:
- `/routers`
- `/routers/[id]`

This is one of the product's most important value areas.

Responsibilities:
- inventory of routers
- statuses: `ONLINE`, `OFFLINE`, `DEGRADED`, `MAINTENANCE`
- health-check
- sync
- maintenance actions
- live stats
- hotspot operations
- connected clients
- hotspot users
- hotspot profiles
- IP bindings

Important UX truth:
- this area can become too technical if it looks like raw Winbox
- the redesign must translate technical concepts into operator language

## D. Commercial operations

Screens:
- vouchers list
- vouchers generate
- vouchers verify
- transactions
- plans
- customers
- reseller area

These are the money screens.

The design must make the business loop obvious:
- offer -> payment -> voucher -> customer access -> revenue -> retention

## E. Reporting and supervision

Screens:
- dashboard home
- analytics
- incidents
- notifications
- audit

These should feel like a command center, not a pile of cards.

## F. Settings and white-label

Screens:
- settings
- white-label
- 2FA
- API keys
- subscription

White-label config already exists and includes:
- platform name
- logo URL
- favicon URL
- primary color
- accent color
- support email
- support phone
- footer text
- custom CSS

Design implication:
- the system must have strong default branding
- but customer-facing and operator-facing accents must be themeable

## G. Captive portal

Route:
- `/portal`

Main user flows:
- choose a plan and pay via Wave
- enter a voucher code
- wait for payment confirmation
- get voucher code
- auto-login or continue to WiFi

This is a consumer payment experience, not an admin screen.

It must feel:
- mobile-first
- reassuring
- immediate
- branded
- simple enough for low-tech users

## 5. Current frontend stack and constraints

Framework:
- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- React Query
- next-themes
- Radix UI primitives in some areas
- Recharts for charts

Platform behaviors already present:
- dark and light themes
- PWA install flow
- offline page
- notification toasts
- role-based navigation
- polling for live data

Important implementation constraint:
- do not redesign into a concept that ignores the existing architecture
- output should remain compatible with:
  - Next.js App Router
  - Tailwind
  - React Query state patterns
  - role-based surfaces
  - white-label theming

## 6. Current visual system from code

Current baseline:
- soft indigo primary: `#6366f1`
- purple accent: `#8b5cf6`
- rounded corners around `1rem`
- soft shadows
- Inter as the current font
- mostly card + table + badge vocabulary
- dark mode is the default theme

Current logo style:
- dark tile
- WiFi arcs
- indigo glow

Current overall feel:
- coherent and clean
- modern enough
- not yet iconic or premium enough
- too close to generic SaaS aesthetics in some screens

## 7. Current UX diagnosis

Based on the codebase and the existing UI/UX audit:

### What is already good

- the product structure is real and serious
- routers and analytics have recently become more modular and more intentional
- there is real system feedback
- loading, empty, and error states exist in many places
- permissions and sensitive actions are already considered

### What is still weak

- the global identity is not memorable enough
- some high-value screens still look functional rather than premium
- too much dense table UX remains
- technical vocabulary leaks into operator-facing flows
- the routeur detail can still feel operationally heavy
- vouchers, transactions, sessions, and settings still lag behind routers/analytics in finish
- accessibility has improved but is not yet a proven strength

### Key design problem to solve

The product already has substance.
The redesign should not invent substance.
It should reveal the existing product value much more clearly and beautifully.

## 8. Design target

The new design should feel like:
- a telecom operations cockpit
- a fintech-grade admin product
- a network infrastructure tool made usable for business operators
- premium, credible, African-market aware, and field-ready

It should not feel like:
- a crypto dashboard
- a purple generic SaaS template
- a raw network engineering console
- a flashy concept with weak usability

## 9. Recommended art direction

Use this as the preferred direction for Google AI Studio.

### Brand personality

Keywords:
- trusted
- high-signal
- operational
- premium
- efficient
- modern African digital infrastructure
- human, not cold

### Visual metaphor

Blend these worlds:
- network topology
- signal / coverage
- money flow
- field operations
- intelligent control center

### Recommended palette

Avoid generic indigo-purple as the main identity.

Use a more distinctive default system palette such as:
- base background: deep slate / midnight `#08111f`
- surface 1: `#0d1728`
- surface 2: `#122036`
- primary signal blue: `#16b5ff`
- accent amber / mobile money gold: `#ff9a3d`
- success green: `#22c55e`
- warning amber: `#f59e0b`
- critical red: `#ef4444`
- neutral text high: `#e8f0fb`
- neutral text low: `#8fa3bf`

Why:
- blue = network trust and signal
- amber = money / action / local payment energy
- dark slate = professional infrastructure feel

White-label rule:
- operator custom colors may override customer-facing accents and selected dashboard accents
- but the underlying neutral infra palette should remain stable for clarity

### Typography

Do not use Inter as the hero identity font.

Recommended mix:
- headings: `Space Grotesk` or `Sora`
- body/UI: `IBM Plex Sans` or `Plus Jakarta Sans`
- technical data / MAC / voucher / IDs / ports: `IBM Plex Mono` or `JetBrains Mono`

Tone:
- display typography should feel distinctive and modern
- body typography should stay highly readable
- numerical data must be very legible

### Shape language

- medium-large radii, but not overly bubbly
- strong panel framing
- layered surfaces
- subtle grid / topology backgrounds
- precise dividers for data-dense areas

### Motion

Use meaningful motion only:
- page section reveal
- chart and metric entrances
- loading pulses
- status transitions
- drawer and modal choreography

Avoid:
- heavy parallax
- random floating objects
- over-animated cards

## 10. UX principles the redesign must respect

### Principle 1 - Translate technical complexity into business clarity

Example:
- instead of exposing raw RouterOS terms first, explain the outcome first
- keep the advanced label visible secondarily

### Principle 2 - Put the next action near the status

Every state block should answer:
- what is happening
- why it matters
- what the operator should do next

### Principle 3 - Progressive disclosure

Default view:
- summary
- risk
- next action

Advanced detail:
- only when opened intentionally

### Principle 4 - Make trust visible

This product touches:
- payments
- customer access
- network operations
- security

So the interface must constantly communicate:
- traceability
- confirmation
- reliability

### Principle 5 - Mobile and field reality matter

Not every user is on a big desktop.
The portal is strongly mobile-first.
The admin UI must still degrade well on tablet and small laptop.

### Principle 6 - Slow router operations are normal, not exceptional

Some router calls can take seconds, even more than 20 seconds in real conditions.

The UI must include:
- partial loading
- skeletons
- last known good states
- refresh explanations
- non-panicked error messages

## 11. Screen-by-screen redesign priorities

### Priority 1 - Dashboard home

Goal:
- make it feel like a true command center

Must show clearly:
- revenue now
- connected clients now
- router health now
- pending transaction risk
- subscription status
- incidents
- AI recommendations

Need:
- stronger visual hierarchy
- better grouping of operational vs financial info
- clearer "act now" areas

### Priority 2 - Routers list

Goal:
- premium fleet supervision

Must do well:
- scan routeur health quickly
- find a site fast
- filter by site/status/tag
- bulk actions without anxiety
- make each router card feel operationally rich but not dense

### Priority 3 - Router detail

Goal:
- the best screen in the product

It should feel like:
- a site cockpit
- a guided operations view

Recommended structure:
- hero overview
- current health and tunnel state
- hotspot status
- live connected clients
- commercial performance
- quick actions
- advanced configuration sections
- history / audit context

Important:
- never dump all complex sections at once
- keep section navigation obvious
- turn complex RouterOS concepts into guided UI

### Priority 4 - Captive portal

Goal:
- best-in-class captive portal purchase experience

Must feel:
- frictionless on mobile
- extremely clear
- branded but light

Must optimize:
- plan comparison
- phone number entry
- Wave payment reassurance
- payment waiting state
- voucher copy
- auto-login success

### Priority 5 - Vouchers

Goal:
- move from dense ticket table to a more commercial inventory experience

Must support:
- stock visibility
- status clarity
- usage states
- safe revoke / delete
- export

### Priority 6 - Transactions

Goal:
- make transaction monitoring feel serious and financial

Need:
- clearer amount hierarchy
- better status grouping
- better filtering
- clearer references and customer traces

### Priority 7 - Sessions

Goal:
- live operations feel

Need:
- real-time signal
- clearer device/user identity
- safer destructive actions
- responsive table/card hybrid

### Priority 8 - Settings and white-label

Goal:
- feel like a premium control panel, not a raw form stack

Need:
- grouped settings by intent
- better preview
- better copy
- safer secret handling

## 12. Information architecture recommendations

Recommended major nav groups:

### Group 1 - Operations
- dashboard
- routers
- hotspot ops
- sessions
- incidents

### Group 2 - Sales
- vouchers
- plans
- transactions
- customers
- reseller space

### Group 3 - Intelligence
- analytics
- notifications
- audit

### Group 4 - Platform
- subscription
- settings
- white-label
- 2FA
- API keys

Design note:
- these groups should be visually distinct in the sidebar
- role-based hiding remains mandatory

## 13. Component system to ask AI Studio for

Ask for a reusable component language covering:

### Global shell
- sidebar
- topbar
- command/search palette
- page header
- sub-navigation tabs
- section anchor nav

### Status and data display
- KPI cards
- metric strips
- status pills
- health badges
- latency badges
- trend indicators
- timeline rows
- empty states
- skeleton states

### Data-heavy interactions
- responsive table/card hybrids
- filter bars
- saved filter chips
- bulk action bars
- split panels
- inspector drawers
- sticky contextual toolbars

### Sensitive actions
- confirmation modal
- dangerous action sheet
- irreversible action warning card

### Network-specific modules
- routeur card
- routeur hero
- routeur status stack
- hotspot user row
- session row
- tunnel health indicator
- maintenance banner

### Financial modules
- plan card
- payment status card
- voucher inventory card
- revenue chart panel
- transaction row

### White-label and brand modules
- logo lockup
- brand preview panel
- theme token preview
- portal preview

## 14. Copywriting direction

Language:
- French-first interface
- simple operator language
- explain advanced terms with short helper text

Examples of better framing:
- `Health check` -> `Verifier l'etat du site`
- `Sync` -> `Synchroniser avec le routeur`
- `IP bindings` -> `Appareils autorises et bloques`
- `Hotspot users` -> `Utilisateurs WiFi`
- `Rate limit` -> `Vitesse maximale`
- `Maintenance` -> `Site en maintenance`

Tone:
- calm
- precise
- operational
- never robotic

## 15. Accessibility and ergonomics requirements

The redesign must include:
- strong visible focus states
- keyboard-friendly dialogs and menus
- not relying on color alone for statuses
- good contrast in dark and light themes
- readable typography at dense data sizes
- mobile tap targets >= 44px when interactive
- empty/loading/error states on every major module
- reduced-motion respect

## 16. Responsive requirements

Desktop:
- premium multi-panel experience
- strong dashboard shell

Tablet:
- no broken dense tables
- smart stacked panels

Mobile:
- especially important for:
  - captive portal
  - auth
  - notifications
  - selected dashboard workflows

For data tables:
- use row expansion, cards, drawers, or segmented breakdowns
- do not just squeeze full-width tables

## 17. State and status vocabulary the design must support

Routers:
- `ONLINE`
- `OFFLINE`
- `DEGRADED`
- `MAINTENANCE`

Transactions:
- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `REFUNDED`
- `EXPIRED`
- `CANCELLED`

Vouchers:
- `GENERATED`
- `DELIVERED`
- `ACTIVE`
- `EXPIRED`
- `REVOKED`
- `DELIVERY_FAILED`
- `PENDING_OFFLINE`

Sessions:
- `ACTIVE`
- `EXPIRED`
- `TERMINATED`
- `DISCONNECTED`

Subscriptions:
- `ACTIVE`
- `PENDING`
- `CANCELLED`
- `EXPIRED`
- `SUSPENDED`

The visual system should define consistent status rules across all modules.

## 18. Anti-patterns to forbid

Tell Google AI Studio to avoid all of these:

- generic purple SaaS look
- glassmorphism everywhere
- crypto/cyberpunk aesthetics
- huge hero sections that waste operational space
- weak contrast
- all-data-in-one-table layouts
- raw network jargon without translation
- overly rounded childish cards
- excessive icon noise
- form-heavy settings without grouping
- dashboards made only of identical metric cards

## 19. Exact deliverables to ask from Google AI Studio

Ask for:

1. A full redesign strategy
- product positioning
- design principles
- information architecture

2. A design system
- color tokens
- typography
- spacing
- radii
- shadows
- component rules
- dark and light theme guidance
- white-label adaptation rules

3. Page-by-page UI direction
- auth
- dashboard home
- routers list
- router detail
- vouchers
- transactions
- sessions
- analytics
- customers
- reseller area
- settings
- white-label
- captive portal

4. Component inventory
- reusable components with behavior notes

5. Responsive behavior
- desktop
- tablet
- mobile

6. Accessibility checklist

7. Motion guidelines

8. If code is generated:
- Next.js 14
- App Router
- Tailwind CSS
- TypeScript
- componentized structure
- no invented backend APIs
- use mock data only where needed

## 20. Master prompt for Google AI Studio

Paste the following prompt into Google AI Studio.

```text
You are a senior product designer, UX architect, brand strategist, and frontend design lead. Redesign the full web product experience for MikroServer.

Context:
MikroServer is a WiFi monetization SaaS for MikroTik hotspot operators in Cote d'Ivoire. It combines network operations, payment flows, voucher management, analytics, reseller operations, and a white-label captive portal. Payment is primarily Wave CI mobile money. The product is operational, financial, and infrastructure-heavy. It is not a generic startup dashboard.

Primary user groups:
1. Super admins who manage the platform, governance, audit, accounting, and users
2. Operator admins who manage routers, plans, vouchers, sessions, customers, incidents, analytics, white-label, and subscriptions
3. Resellers who need a focused sales workspace
4. Viewers who need safe read-only visibility
5. End customers on a captive portal who need to buy WiFi or enter a voucher quickly on mobile

Product surfaces to redesign:
1. Auth: login, forgot password, reset password, 2FA
2. Main dashboard shell: sidebar, topbar, alerts, notification bell, subscription banner, PWA affordances
3. Dashboard home / command center
4. Routers list / fleet supervision
5. Router detail / site cockpit
6. Hotspot operations
7. Sessions
8. Vouchers: list, generate, verify, stock
9. Plans
10. Customers
11. Transactions
12. Analytics and incidents
13. Notifications and audit
14. Settings, 2FA, white-label, API keys, subscription
15. Public captive portal for plan purchase and voucher login

Core UX truths:
- This product manages real routers in the field
- Some router reads are slow and the UI must handle long-running states gracefully
- Many users are operators, not network engineers
- The UI must translate technical complexity into business clarity
- The product touches payments, customer access, and network control, so trust and traceability must be visible
- White-label is required for operator branding
- The captive portal must be mobile-first and consumer-grade
- The admin product must feel premium, high-signal, and operationally efficient

Design goals:
- Create a memorable, premium, distinctive visual identity
- Make the dashboard feel like a telecom + fintech + network operations cockpit
- Reduce cognitive load across dense operational screens
- Keep advanced controls accessible but not overwhelming
- Create a unified design system across admin, settings, analytics, and captive portal
- Improve hierarchy, navigation, readability, trust, and responsiveness
- Avoid generic purple SaaS aesthetics

Recommended visual direction:
- Base palette: deep slate / midnight backgrounds
- Signal blue as primary action color
- Mobile money amber as a secondary accent
- Stable neutrals for readability
- Strong status colors for success, warning, and critical states
- Distinctive typography, not Inter as the hero identity
- Suggested fonts: Space Grotesk or Sora for headings, IBM Plex Sans or Plus Jakarta Sans for UI, IBM Plex Mono or JetBrains Mono for technical values
- Shape language: layered panels, medium-large radii, precise dividers, premium data surfaces
- Motion: meaningful and restrained

Suggested default palette:
- Background: #08111f
- Surface: #0d1728
- Secondary surface: #122036
- Primary: #16b5ff
- Accent: #ff9a3d
- Success: #22c55e
- Warning: #f59e0b
- Critical: #ef4444
- High text: #e8f0fb
- Low text: #8fa3bf

Important content and IA guidance:
- Group navigation into Operations, Sales, Intelligence, and Platform
- Router detail should be one of the strongest screens in the product
- Captive portal must feel simple, fast, reassuring, and branded
- Vouchers, transactions, sessions, and settings need a much more premium finish
- Replace raw technical terminology with operator-friendly language whenever possible
- Use progressive disclosure for advanced network concepts

Status vocab the UI must support consistently:
- Routers: ONLINE, OFFLINE, DEGRADED, MAINTENANCE
- Transactions: PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED, EXPIRED, CANCELLED
- Vouchers: GENERATED, DELIVERED, ACTIVE, EXPIRED, REVOKED, DELIVERY_FAILED, PENDING_OFFLINE
- Sessions: ACTIVE, EXPIRED, TERMINATED, DISCONNECTED
- Subscriptions: ACTIVE, PENDING, CANCELLED, EXPIRED, SUSPENDED

Accessibility and responsive requirements:
- strong visible focus states
- do not rely on color alone
- high contrast in both dark and light modes
- reduced motion support
- mobile-friendly controls
- no broken dense tables on tablet/mobile
- use card/table hybrids, drawers, expandable rows, and sectional layouts

Technical implementation constraints:
- target a Next.js 14 App Router frontend
- use Tailwind CSS and TypeScript
- keep the solution compatible with React Query data-fetching patterns
- do not invent new backend endpoints unless explicitly labeled as optional future ideas
- support existing white-label theming capabilities

What I want you to produce:
1. A product-level redesign strategy
2. A complete visual identity direction
3. A reusable design system with tokens and component rules
4. A redesigned information architecture
5. Page-by-page redesign guidance for all major surfaces
6. A high-fidelity UX concept for the admin dashboard and captive portal
7. Recommendations for motion, accessibility, responsiveness, and copywriting
8. If possible, a code-oriented implementation proposal for Next.js + Tailwind

Do not give me a bland answer. Make it feel like a serious, premium, market-ready product for WiFi operations and monetization in Africa.
```

## 21. Best follow-up prompt after the first answer

Use this second prompt if the first output is too generic.

```text
Refine the proposal into a production-grade redesign system. Be much more concrete and much less generic.

I want:
- a page-by-page breakdown
- exact layout structures
- section ordering
- component inventory
- color token definitions
- typography scale
- spacing scale
- interaction patterns
- dashboard shell behavior
- router list card anatomy
- router detail screen anatomy
- captive portal mobile checkout anatomy
- vouchers and transactions redesign anatomy
- settings and white-label panel anatomy
- explicit responsive rules
- explicit accessibility rules
- anti-patterns to avoid

Also explain how the new design makes the product more premium, more trustworthy, easier for operators, and more distinctive than a generic SaaS dashboard.
```

## 22. If you want code output from AI Studio

Use this third prompt after the design direction is accepted.

```text
Now convert the approved redesign direction into a realistic frontend implementation plan for a Next.js 14 App Router project using TypeScript and Tailwind CSS.

Requirements:
- preserve the existing product scope
- do not invent backend APIs
- organize the work by layout, tokens, components, and page groups
- propose reusable components first
- define design tokens as CSS variables
- explain how to support both global branding and white-label branding
- prioritize dashboard home, routers list, router detail, captive portal, vouchers, transactions, sessions, and settings
- output implementation steps in the right order
- include example component structures and file organization
```

## 23. Final recommendation

If Google AI Studio gives several possible directions, choose the one that best combines:
- premium telecom operations feel
- financial trust
- mobile-first captive portal quality
- clarity for non-technical operators
- a distinctive identity beyond generic SaaS

That is the right bar for MikroServer.
