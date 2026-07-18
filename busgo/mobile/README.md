# BusGo Mobile

The Expo/React Native passenger application for BusGo. It uses the same
microservices and database as the web application through the Kong gateway.

## Implemented features

- Google authentication with persisted Supabase and BusGo sessions
- Guest browsing for routes, transit options, live seats, and deals; authentication is required only when checkout or personal account data is opened
- Automatic BusGo access-token renewal and expired-session recovery
- Searchable city selection and journey-date picker
- Direct buses and multi-bus transit journey search
- Live seat maps with stale-seat protection
- One to four passengers with details collected for every seat
- Atomic transit booking across every bus
- Ten-minute seat-hold countdown
- bKash, Nagad, and linked-bank payment flows
- Promo codes, active deals, and flash sales
- Booking history grouped by connecting journey
- Booking details, cancellation eligibility, cancellation, and refunds
- QR/PDF e-tickets
- Notifications with read, read-all, and delete actions
- Editable profile, travel/payment summary, and account balances
- Loading, empty, error, retry, and pull-to-refresh states

Operator and administrator management remain in the secured web portals. The
mobile application is the complete passenger travel experience.

## Requirements

- Node.js 20.19.4 or newer
- An Expo development build is recommended for stable Google OAuth; Expo Go is supported for local testing with `exp://**` allowed in Supabase
- Google enabled in the project's Supabase Authentication providers
- The redirect URLs described in `../GOOGLE_AUTH_SETUP.md`

## Configuration

Copy `.env.example` to `.env` and set:

```env
EXPO_PUBLIC_API_URL=https://busgo.farefin.com
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
```

For local backend development, set `EXPO_PUBLIC_API_URL` to the computer's LAN
address, such as `http://192.168.0.42:18085`. The phone and computer must be on
the same network and the port must be allowed through the firewall.

## Development

```bash
npm install
npm run doctor
npm run typecheck
npm start
```

For Expo Go testing, add `exp://**` to Supabase Authentication > URL
Configuration. The app prints its exact development callback in the Metro
terminal as `[BusGo Auth] OAuth callback: ...`. Keep this wildcard for
development only.

A development build is recommended because it uses the stable
`busgo://auth/callback` callback, matching production.

Create an Android development APK with:

```bash
npm install
npx eas-cli build --profile development --platform android
```

Install the resulting BusGo development build, start Metro with `npx expo start --dev-client`,
and open the project from the development build rather than Expo Go. Supabase
must list `busgo://auth/callback` under Authentication > URL Configuration.

## Build verification

```bash
npm run verify
npm run export:android
```

Production builds can be created with EAS using the profiles in `eas.json`.
