# Package structure

The migration is feature-first and incremental. Existing URLs and completed UI
must continue to work while files move behind stable route entry points.

## Target structure

```text
mentalbridge/
|-- app/
|   |-- (public)/                 # public pages; route group does not alter URL
|   |-- (authenticated)/          # signed-in user/specialist pages
|   |-- admin/                    # admin UI; backend-confirmed ADMIN access
|   `-- api/identity/             # bounded same-origin Identity BFF
|-- components/
|   |-- ui/                       # generic visual primitives
|   `-- layout/                   # shared shells/navigation
|-- features/
|   `-- <feature>/
|       |-- api/                  # feature requests/query options
|       |-- components/           # feature-owned UI
|       |-- hooks/                # feature client behavior
|       |-- schemas/              # boundary validation
|       |-- types/                # feature-only view models
|       `-- __tests__/
|-- lib/
|   |-- api/                      # shared transport + Problem Details
|   |-- auth/                     # server-only session/current-account DAL
|   |-- config/                   # validated server configuration
|   `-- query/                    # TanStack provider and shared defaults
|-- contracts/                    # reviewed/generated API types; no handwritten drift
|-- tests/
|   |-- integration/
|   |-- e2e/
|   `-- fixtures/
`-- docs/
```

Create directories only when a story has code to place in them. Empty scaffolds
are not architecture.

## Placement rules

| Concern                                   | Owner                           | Do not place it in         |
| ----------------------------------------- | ------------------------------- | -------------------------- |
| URL, layout, metadata, route composition  | `app/`                          | feature API modules        |
| Generic button/input/dialog primitives    | `components/ui`                 | a page file                |
| Feature-specific UI and behavior          | `features/<feature>`            | global `components/`       |
| Browser-neutral API transport/error model | `lib/api`                       | React components           |
| Cookies and authenticated Identity calls  | `lib/auth` server modules       | client hooks/localStorage  |
| Query client defaults/provider            | `lib/query`                     | root page or every feature |
| Backend contract representations          | `contracts` or generated output | duplicated page interfaces |

An abstraction becomes shared only when it is domain-neutral and has at least
two real consumers. Avoid `utils`, `helpers`, `common`, or `shared` dumping
grounds; choose a name that declares ownership.

## Route and component patterns

- Route groups organize public/authenticated areas without changing URLs.
- Private `_components` folders are allowed for code used by one route segment.
- Page files compose features and translate route params/search params; they do
  not own reusable request, schema, or session logic.
- Prefer named exports for reusable modules. Route convention files use the
  required default export.
- Use the existing `@/*` alias for application-root imports. Relative imports are
  acceptable within one small feature subtree.
- Global CSS contains design tokens, reset/base rules, and truly global
  utilities. New component/feature styles should use colocated CSS Modules.
  Existing route CSS may migrate when that route is changed; do not perform a
  repository-wide styling rewrite.

## Migration map

1. Keep current `app/login`, `app/register`, `app/admin`, and dashboard URLs
   stable during Identity integration.
2. Story 211 introduced `lib/api`, `lib/query`, contract boundaries, and tests.
3. Story 212 introduces `lib/config`, `lib/auth`, and `app/api/identity`.
4. Stories 213–214 extract mock auth UI into `features/auth` while route pages
   become thin composition files.
5. Move reusable landing components into a feature or `components/ui/layout`
   only when touched by a scoped story.

Do not rename URLs merely to match the folder diagram. Route-group migrations
must prove generated paths are unchanged.
