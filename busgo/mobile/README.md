# BusGo Mobile

The Expo/React Native passenger application for BusGo. It uses the same
microservices and database as the web application through the Kong gateway.

## Implemented features

- Google authentication with persisted Supabase and BusGo sessions
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
- Expo Go compatible with Expo SDK 54, or an Expo development build
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

Use a development build when testing the stable `busgo://auth/callback` deep
link. Expo Go uses an `exp://` callback; add the exact development URL to the
Supabase redirect allow list.

## Build verification

```bash
npm run verify
npm run export:android
```

Production builds can be created with EAS using the profiles in `eas.json`.
