# BusGo Mobile — Web Parity and Implementation Audit

Audit date: 2026-07-19  
Scope: the Expo/React Native passenger app in `busgo/mobile`, compared with the passenger-facing web app in `busgo/frontend`. Operator and administrator portals are listed separately because the current mobile app explicitly treats them as web-only.

## Executive summary

The mobile project is not fundamentally broken. It type-checks, its Expo dependencies are compatible, and the principal one-way passenger flow is present:

1. Browse as a guest.
2. Search direct and connecting journeys.
3. Select seats on one or several buses.
4. Sign in with Google only when checkout is started.
5. Add the phone number Google does not provide.
6. Hold seats, pay, receive tickets, cancel bookings, and read notifications.

However, it is not yet at full passenger parity with the website. The highest-impact missing work is:

- show the same enriched bus and journey information in My Trips, booking details, confirmation, and e-tickets;
- add the website's route browsing, filtering, sorting, grouping, and round-trip workflow;
- add actual transaction and journey history to Profile;
- fix payment-provider selection and do not announce confirmation until the server confirms it;
- make release builds receive their production API and Supabase configuration reliably;
- add automated tests and secure token storage.

## Validation performed

| Check | Result | Meaning |
|---|---:|---|
| `npm run typecheck` | Pass | No current TypeScript compile errors. |
| `npm run doctor` | Pass, 17/17 | Expo SDK and installed package versions are compatible. |
| Automated mobile tests | Missing | No unit, integration, component, or end-to-end test files exist. |
| Production API URL in local `.env` | Present | Local builds target `https://busgo.farefin.com`. This file is ignored by Git and is not sufficient configuration for remote EAS builds. |
| Operator/admin navigation | Missing by design | The app displays a message directing these roles to the web portal. |

## Already implemented in mobile

- Google OAuth through Supabase and exchange for BusGo access/refresh tokens.
- Cached login and automatic BusGo access-token refresh.
- Guest access to Home, search results, seat maps, connecting journeys, and Deals.
- Phone completion after Google login.
- Direct journey search and operator-defined/automatic transit search.
- Direct seat maps and one seat map per transit leg.
- Boarding and dropping point selection for direct journeys.
- Passenger details for one to four seats.
- Atomic multi-bus journey creation.
- bKash, Nagad, and bank/card-style simulated payment options.
- Direct-booking promo codes and public deal/flash-sale browsing.
- Booking/ticket lists, cancellation, QR/PDF tickets, notifications, and editable profile basics.

## Priority 0 — correctness and release blockers

These items should be completed before describing the app as production-ready.

### P0.1 Configure EAS builds independently of the ignored local `.env`

Current state:

- `src/config.ts` falls back to a development LAN address or `localhost` when `EXPO_PUBLIC_API_URL` is missing.
- Supabase also depends on `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- `.env` is ignored by Git, and `eas.json` does not declare a build environment or production values.

Required implementation:

- Configure the three `EXPO_PUBLIC_*` variables in EAS for development, preview, and production environments.
- Associate each EAS profile with its intended environment.
- Fail fast in preview/production when required values are missing; never silently use `localhost` in a store build.
- Verify `busgo://auth/callback` is in Supabase's redirect allow list.
- Add a release smoke test that opens the installed APK without Metro and calls `/api/auth/health` and `/api/bookings/health`.

Files: `eas.json`, `app.json`, `src/config.ts`, `src/lib/supabase.ts`.

Acceptance criteria:

- An APK/AAB built on EAS, with no local `.env`, connects to `https://busgo.farefin.com`.
- Google login returns to the installed app and remains signed in after an app restart.

### P0.2 Correct payment-provider account selection

Current state:

- `PaymentScreen` selects an account only by `account_type`.
- Both bKash and Nagad use `MOBILE`, so choosing Nagad can still display and charge the first mobile account even when its provider is bKash, and vice versa.

Required implementation:

- Match mobile accounts by both account type and normalized provider.
- Disable a payment method when no matching account exists and explain how to add/activate it.
- Match card/bank selection explicitly when multiple bank accounts exist.
- Add tests for bKash-only, Nagad-only, both wallets, bank-only, and insufficient-balance accounts.

File: `src/screens/PaymentScreen.tsx`.

Acceptance criteria:

- Selecting bKash can never submit a Nagad account, and selecting Nagad can never submit a bKash account.

### P0.3 Confirm server state before showing “Booking confirmed”

Current state:

- After `/api/payments/initiate`, the app suppresses any error from the booking confirmation call and immediately navigates to a success screen.
- A durable server event may finish confirmation later, but the UI can temporarily claim success before the booking is confirmed.

Required implementation:

- Treat payment initiation, payment completion, and booking confirmation as separate states.
- Poll or query the payment and booking/journey status with a bounded retry window.
- Show “Payment received, confirming seats” while reconciliation is in progress.
- Show “Confirmed” only for a confirmed booking/journey.
- Provide a recoverable pending-payment screen for network interruption instead of releasing or duplicating a paid booking.

Files: `src/screens/PaymentScreen.tsx`, `src/screens/ConfirmationScreen.tsx`, and navigation parameter types in `src/nav.ts`.

### P0.4 Replace client-calculated authoritative totals

Current state:

- A hard-coded `SERVICE_FEE = 20` exists in both Seats and Passenger screens.
- The client submits its calculated total to the booking API.
- Pricing logic duplicated in the app can drift from web/backend pricing, promotions, fees, and transit discounts.

Required implementation:

- Make the backend quote the fare, fees, discounts, and final amount for the selected trip(s) and seats.
- Display the quote returned by the server and submit a quote identifier or server-verifiable inputs.
- Reject stale quotes and refresh them before seat locking.
- Keep display-only calculations clearly non-authoritative.

Files: `src/screens/SeatsScreen.tsx`, `src/screens/PassengerScreen.tsx`, `src/screens/PaymentScreen.tsx`; a backend quote endpoint may also be required.

### P0.5 Secure authentication tokens on the device

Current state:

- Access tokens, refresh tokens, and the cached user are stored in AsyncStorage.
- AsyncStorage is useful for ordinary cache data but is not the correct final location for long-lived credentials.

Required implementation:

- Store BusGo refresh/access tokens in `expo-secure-store` or platform keychain/keystore storage.
- Keep only non-sensitive profile cache in AsyncStorage.
- Migrate existing stored tokens once and clear the legacy keys after migration.
- Clear both BusGo and Supabase sessions on explicit logout or unrecoverable refresh failure.

Files: `src/api/client.ts`, `src/store/auth.tsx`, `package.json`.

## Priority 1 — passenger feature parity with the website

### P1.1 Bring My Trips cards to web parity

The website now shows the unique bus/coach identifier and full trip information. The mobile Bookings tab still shows mainly route, date, operator, status, seats, and total.

Add to every direct booking card:

- bus name/registration number;
- bus type;
- departure and arrival times;
- actual duration;
- boarding and dropping terminals;
- amenities;
- payment status and booking reference.

Add to every transit booking card:

- overall origin and final destination;
- the number of buses and transfers;
- one compact row per leg with `Bus 1`, `Bus 2`, etc.;
- operator, bus registration, bus type, route, departure/arrival time, and selected seats for each leg;
- transfer city and waiting time;
- one-payment indicator and separate-ticket count.

Implementation notes:

- Extend `Booking` in `src/types/api.ts` with the web/API enrichment fields: `bus_registration_no`, `bus_type`, `departure_datetime`, `arrival_datetime`, and `amenities`.
- Fetch `/api/bookings/journeys/my` in addition to `/api/bookings/my` so journey-level status, fare, origin/destination, and legs are authoritative.
- Add Upcoming, Completed, and Cancelled sections plus search, matching the website.
- Sort future trips chronologically and past trips in reverse chronological order.

Files: `src/screens/TripsScreen.tsx`, `src/screens/BookingDetailScreen.tsx`, `src/types/api.ts`, `src/utils/format.ts`.

### P1.2 Put full transit information in booking details and tickets

Current gaps:

- Booking details show leg route, date/time, optional operator, seats, and fare, but not the assigned bus, bus type, arrival time, duration, terminals, amenities, or transfer wait.
- The e-ticket screen shows QR, seats, references, and issue time only.
- Confirmation offers only “View first e-ticket” when a transit journey creates several tickets.

Required implementation:

- Enrich booking details with the same leg information displayed during transit search.
- On every e-ticket show passenger name, operator, bus name/registration, bus type, route, boarding/dropping terminal, date, departure/arrival, duration, and seat number.
- For a transit journey, clearly label tickets as `Bus 1 of N`, `Bus 2 of N`, etc.
- Add a journey ticket wallet/carousel so users can open every ticket, not only the first one.
- Include a transfer instruction between tickets without placing the transfer instruction inside the QR code.
- Ensure the PDF ticket contains the same information.

Files: `src/screens/BookingDetailScreen.tsx`, `src/screens/TicketDetailScreen.tsx`, `src/screens/ConfirmationScreen.tsx`, `src/types/api.ts`; ticket-service PDF/QR payload changes may be required.

### P1.3 Add the full Routes experience

The website has an all-routes page; mobile only provides a search-specific Results screen.

Required implementation:

- Add a Routes screen accessible from the bottom navigation or Home.
- Load all published scheduled trips and display the bus name/registration on every card.
- Group cards by journey date, then by origin → destination.
- Sort groups by date and sort cards within a group by selected order.
- Add search by operator, bus, origin, and destination.
- Add origin, destination, and date filters.
- Add bus type, operator, and price-range filters.
- Add sort options: departure time, duration, price low-to-high, and price high-to-low.
- Preserve the user's filters when they return from a seat screen.

Files: new `src/screens/RoutesScreen.tsx`, `App.tsx`, `src/nav.ts`, and reusable trip-card/filter components.

### P1.4 Add search-result filtering and remove fabricated ratings

Current state:

- Direct journeys are sorted only by departure time.
- There are no operator, bus type, price, time, or sort controls.
- `operatorRating()` returns hard-coded ratings based on operator names and a default `4.3`; this is not real data.

Required implementation:

- Reuse the Routes filters and sorting controls in Results.
- Display a rating only if the API supplies a verified rating and review count; otherwise omit it or show “Not rated”.
- Allow direct and connecting results to be viewed together or filtered by journey type.
- Show bus registration/type and amenities for every transit leg, not only direct buses.
- Show terminal names when the API supplies them.

Files: `src/screens/ResultsScreen.tsx`, `src/nav.ts`, shared route-card components.

### P1.5 Implement round trips

The website supports outbound and return dates, return-trip selection, two seat selections, two bookings, and combined payment. Mobile supports only one-way journeys.

Required implementation:

- Add One Way / Round Trip selection and a return-date picker on Home.
- Validate that the return date is on or after the outbound date.
- Search and select the outbound trip first, then the return trip.
- Preserve both selections and both seat maps across login/phone completion.
- Create both bookings idempotently and pay for both as one checkout operation.
- Show both directions in confirmation, My Trips, cancellation, transaction history, and tickets.
- Define partial-cancellation rules explicitly; do not infer them in the client.

Files: `src/screens/HomeScreen.tsx`, `src/screens/ResultsScreen.tsx`, `src/screens/SeatsScreen.tsx`, `src/screens/PassengerScreen.tsx`, `src/screens/PaymentScreen.tsx`, `src/nav.ts`.

### P1.6 Complete Profile travel and transaction history

Current state:

- Profile shows only counts for bookings/payments and combined account balance.
- It does not show the website's travel history, transaction list, active/completed trip statistics, or total invested.
- Transit journeys are not loaded by Profile.

Required implementation:

- Load both `/api/bookings/my` and `/api/bookings/journeys/my`.
- Load `/api/payments/my` and render real transaction rows with date, method, reference, amount, and status.
- Show active bookings, completed trips, cancelled/refunded trips, and total successfully paid.
- Link a travel-history row to Booking Details and a transaction row to its booking/journey.
- Do not count failed/pending payments in “Total paid”.

Files: `src/screens/ProfileScreen.tsx`, shared booking/transaction components, `src/types/api.ts`.

### P1.7 Use the actual cancellation policy

Current state:

- Direct bookings request cancellation eligibility, but the confirmation alert still states a hard-coded 80% refund.
- Transit bookings do not request a policy preview before cancellation and assume every confirmed journey is cancellable.

Required implementation:

- Display the API-provided deadline, refund percentage/amount, fee, and reason when cancellation is unavailable.
- Add a transit cancellation-info endpoint if one does not exist.
- Refresh booking, journey, payment, ticket, and transaction state after cancellation.
- Never show a fixed refund percentage unless it came from the current server policy response.

File: `src/screens/BookingDetailScreen.tsx`; booking/cancellation services may require a journey preview endpoint.

### P1.8 Add notification actions and unread badges

Current state:

- Notifications can be read and deleted, but tapping one only marks it read.
- The bottom tab does not show an unread count.

Required implementation:

- Parse notification metadata and deep-link to the relevant booking, ticket, deal, or route.
- Display an unread badge on the Alerts tab.
- Refresh the badge after read-all/delete and after app resume.
- Handle an invalid or deleted target with a friendly fallback.

Files: `src/screens/AlertsScreen.tsx`, `App.tsx`, notification navigation helpers.

## Priority 2 — mobile-native production quality

### P2.1 Push notifications

The current Alerts screen polls only while it is opened. Implement `expo-notifications`, permission education, device-token registration, backend token storage, notification categories, foreground handling, and navigation from a tapped push notification. Booking confirmation, ticket issue, departure reminder, delay, cancellation, and refund events should be supported.

### P2.2 Offline and poor-network behavior

- Cache cities, recent successful route results, trips, tickets, and notification summaries with timestamps.
- Show cached data as stale instead of replacing useful content with a generic network error.
- Queue safe read/delete notification operations where appropriate.
- Never queue seat locking, booking creation, payment, or cancellation without an explicit server result.
- Recompute seat-hold expiry from the server timestamp after the app resumes from background.

### P2.3 Release identity and store assets

`app.json` currently has package identifiers and basic splash colors but no complete production icon/adaptive-icon/splash asset configuration. Add final app icons, adaptive Android icon, splash image, notification icon/color, privacy/contact metadata, production versioning policy, and EAS project/update configuration if OTA updates will be used.

### P2.4 Accessibility and localization

- Add accessibility labels, roles, hints, and minimum touch targets to all interactive controls and seat cells.
- Support dynamic font sizes without clipping card data.
- Test screen reader ordering for the seat grid and transit steps.
- Centralize user-facing strings for Bangla/English localization.
- Centralize Asia/Dhaka date/time handling and avoid locale-dependent ambiguity.

### P2.5 Observability

- Add privacy-safe crash reporting and release/environment identifiers.
- Record failed OAuth redirects, API timeouts, payment reconciliation, seat-lock conflicts, and ticket generation delays.
- Never log OAuth URLs, authorization codes, tokens, wallet PINs, or complete personal/payment data.

## Operator and administrator parity decision

The mobile Profile explicitly says operator and administration tools are available only in the secured web portal. Therefore the current app is a passenger app, not a complete mobile version of every website role.

If operator/admin mobile parity is required later, it is a separate product phase containing at least:

- role-aware post-login routing;
- operator dashboard and settings;
- bus, route, schedule, and trip management;
- transit-route creation with ordered legs and assigned bus per leg;
- operator bookings, live seat view, analytics, deals, fill-empty-seats, and customer notifications;
- admin users/roles, operators, routes/trips, balances, transactions, notices, and audit/history tools.

Until that phase is approved, an operator/admin who logs into mobile should receive a clear button opening the authenticated web portal, not only informational text.

## Test plan required before release

### Automated tests

- Unit tests: formatting, fare display, account/provider matching, status grouping, token migration, and date handling.
- Component tests: trip cards, transit legs, seat selection, payment states, ticket wallet, filters, and empty/error/loading states.
- API integration tests: token refresh, search, seat conflict, direct booking, transit booking, payment reconciliation, cancellation/refund, tickets, and transaction history.
- End-to-end tests on a physical Android device or emulator using Maestro or Detox.

### Mandatory end-to-end scenarios

1. Guest searches and inspects direct/transit seats without login.
2. Guest selects seats, signs in with Google, adds phone, and resumes the exact checkout state.
3. Direct purchase produces one enriched booking card and one complete e-ticket.
4. Two-bus transit purchase produces one journey, two leg cards, correct seat numbers, and two tickets.
5. bKash and Nagad each select only their matching account.
6. App is killed during payment and safely restores pending/confirmed server state without a duplicate charge.
7. Access token expires, refresh succeeds, and the user remains logged in.
8. Refresh token is revoked and the user is returned to login without losing public browsing access.
9. Cancellation preview matches the final refund transaction.
10. Round trip books and displays both directions correctly.
11. Production APK launches without Metro, reaches the cloud API, and completes Google OAuth through `busgo://auth/callback`.

## Recommended implementation order

1. P0 release configuration, payment-provider correctness, payment reconciliation, server pricing, and secure tokens.
2. My Trips, Booking Details, Confirmation, and e-ticket enrichment—including complete transit leg information.
3. Profile transaction/travel history and cancellation-policy parity.
4. Routes page, reusable filters/sorting/grouping, and removal of fake ratings.
5. Round-trip booking.
6. Notification deep links/badges and native push notifications.
7. Automated end-to-end coverage, accessibility, offline behavior, release assets, and observability.

## Definition of “complete passenger app”

The mobile app should be called complete only when:

- every passenger journey available on the website can be discovered and purchased in mobile;
- direct, transit, and round-trip bookings retain the correct buses, legs, terminals, times, seats, fares, payments, and tickets everywhere they are displayed;
- the installed production build can authenticate and reach cloud services without Metro or a local `.env`;
- payment, cancellation, and refund screens reflect confirmed server state;
- critical flows have repeatable automated tests and have passed on real Android hardware.
