# Product

## Register

product

## Users

Israeli families managing shared household finances. Primary users are adults (25–50) who track
income, expenses, recurring bills, and savings goals together. Hebrew is the primary language;
English is also supported. Users are not finance professionals — they want clarity and calm, not
data density or complexity.

## Product Purpose

Famileconomy helps families see where their money goes, stay aligned on shared budgets, and feel
in control of their financial life. Success is measured by: (1) families logging transactions
consistently without friction, (2) shared budgets staying in sync across household members, and
(3) the app feeling trustworthy enough to make financial decisions from.

## Brand Personality

Calm, trustworthy, approachable. The tone is warm and family-oriented — not sterile and corporate,
not aggressive or anxiety-inducing. It should feel like a well-designed household tool, not a
fintech product. Think YNAB's clarity meets a friendly neighborhood bank.

Three-word personality: **calm, trusted, approachable**.

## Design Principles

1. **Clarity over density.** Financial data can be overwhelming. Every screen should surface the
   one or two numbers that matter most, with supporting detail available on demand.
2. **Hebrew-first, bilingual always.** RTL is not an afterthought — it is the primary reading
   direction. All layout, iconography, and directional logic must be tested in Hebrew first.
   Logical CSS properties everywhere; no hardcoded `left`/`right`.
3. **Earned trust through consistency.** Colors, type scales, and spacing must be rock-solid and
   predictable. No decorative surprises. Users trust an app with their money — the design should
   reinforce that.
4. **Mobile is the primary surface.** Most interactions happen on phone. Design for thumb reach,
   glanceable data, and one-handed use. Web is a companion, not the main experience.
5. **Reduce cognitive load at every step.** Transaction entry, budget review, and recurring rule
   management should each feel like one decision, not five. Progressive disclosure over upfront
   complexity.

## Key Screens

- **Dashboard** — balance summary, recent transactions, budget progress rings
- **Transaction list** — filterable, sortable; pending transactions visually distinct; excludes
  pending from totals
- **Transaction entry / edit** — fast, minimal form; amount, category, date, optional note
- **Budgets** — progress bars per category, remaining amount prominent
- **Recurring rules** — list of recurring income/expenses, match rate, manual override
- **Import** — bank file upload (MAX, CAL), duplicate detection, review queue
- **Settings** — account management, household members, preferences

## Color & Tone

- Warm neutrals as the base — avoid pure grays; tint toward sand/beige
- Primary accent: a trustworthy mid-blue or teal (not purple, not neon)
- Budget "over limit" state: warm amber/red, not alarming
- Positive states (income, surplus): calm green, not celebration-green
- Dark mode must be supported; respect `prefers-color-scheme`

## Accessibility & Inclusion

Baseline: WCAG 2.1 AA on all screens.

- All text contrast ratios verified — especially over colored budget progress backgrounds
- Full keyboard navigation on web
- `prefers-reduced-motion` respected for all animations (transaction list transitions, budget ring
  animations)
- Semantic HTML and ARIA used correctly in web app; accessible labels in React Native
- Touch targets minimum 44×44pt on mobile
- RTL icon mirroring: navigation arrows, back buttons, progress indicators must flip correctly

## Anti-references

Avoid:

- **Fintech aggression**: dark backgrounds with neon green/teal, crypto-dashboard density, alert
  fatigue from too many red indicators
- **Generic SaaS**: Inter/Roboto on white with blue CTAs — looks like every other app
- **Card-within-card nesting**: financial dashboards love this; it creates visual noise without
  hierarchy
- **Bounce/elastic easing** on financial data — it reads as playful when the content is serious
- **Purple-to-blue gradients**: overused across all fintech; avoid
- **Gradient text**: hard to read in RTL, especially with Hebrew letterforms
