# Phase 2 Implementation Notes

Phase 2 continues foundation work (e.g. auth, schema, RLS). Do **not** change the Phase 1 dashboard or reports UI for the requirements below during Phase 2. Preserve the existing mock layouts until the dedicated dashboard and reports integration phases.

---

## Deferred: Dashboard — Overall Net Profit

**When:** Dashboard integration phase (after Phase 2). Until then, keep dashboard metrics as mock data.

**UI**
- Add an `Overall Net Profit` metric card alongside the existing:
  - Today's Earnings
  - Last 10 Days
  - Last 30 Days

**Calculation**
- `Overall Net Profit` = cumulative earnings − all recorded expenses for the authenticated user across their entire available history.
- Derive the value from database records at query time.
- Do **not** store a separately editable profit total.

**Security**
- Enforce user-level isolation via Supabase RLS so each user only sees their own cumulative figure.

**Phase 2 constraint**
- Do not add this metric to the live UI or wire real queries in Phase 2. Document only; Phase 1 mock dashboard remains unchanged.

---

## Deferred: Reports — Month-first navigation

**When:** Reports integration phase (after Phase 2). Do not add these UI changes or report queries during Phase 2.

**Navigation**
- Replace the current side-by-side month-selection cards with a dedicated chronological month list.
- Display months in descending order (newest first), e.g. October 2026, September 2026, August 2026.
- Selecting a month opens that month’s dedicated monthly report view.

**Monthly report contents**
- Summary cards: earnings, expenses, net operating profit, kilometres.
- Calendar: daily expenses in red; daily net profit in green.
- Daily entries table below the calendar.
- Calendar dates and table rows should eventually link to the corresponding daily-entry detail/edit view.

**Data & isolation**
- Generate the month list from the authenticated user’s recorded data when reports are integrated.
- Do not show another user’s months (RLS / user-scoped queries).
- Empty-month behavior can be decided during reports implementation.

**Phase 2 constraint**
- Preserve the existing Phase 1 reports placeholder UI. No month-list redesign, no dedicated report route wiring, and no real report queries in Phase 2.

---

## Checklist for later phases

| Item | Target phase | Status |
|------|--------------|--------|
| Overall Net Profit metric (mock until wired) | Dashboard integration | Done (Phase 5) |
| Overall Net Profit from DB (earnings − expenses) | Dashboard integration | Done (Phase 5) |
| RLS for dashboard aggregates | Dashboard integration | Done (Phase 5) |
| Chronological descending month list | Reports integration | Done (Phase 6) |
| Dedicated monthly report view + calendar/table links | Reports integration | Done (Phase 6) |
| User-scoped month list from recorded data | Reports integration | Done (Phase 6) |
