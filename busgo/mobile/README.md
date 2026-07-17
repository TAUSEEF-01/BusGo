# BusGo Mobile (customer app)

A React Native (Expo) app for **customers**: search buses (direct **and**
multi-leg transit journeys), pick seats, pay once, get a ticket per bus, view
bookings/tickets, deals, and notifications. It talks to the same backend as the
web app through the Kong gateway.

## Prerequisites
- Node.js 20+ on your PC
- The BusGo stack running: `cd busgo/infrastructure && docker compose up -d`
- **Expo Go** app on your phone (Play Store / App Store)
- Phone and PC on the **same Wi-Fi**

## Run it

```bash
cd busgo/mobile
npm install
npx expo install --fix     # aligns native package versions with your Expo SDK
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

### How the app finds your backend
In development the app reuses the Expo dev-server host (your PC's LAN IP) and
talks to Kong at port `18085` — zero config when phone + PC share Wi-Fi.

To override (e.g. different machine or port):

```bash
EXPO_PUBLIC_API_URL=http://192.168.0.42:18085 npx expo start
# PowerShell:
$env:EXPO_PUBLIC_API_URL="http://192.168.0.42:18085"; npx expo start
```

The Login screen shows the resolved server URL at the bottom.

## Windows Firewall (one-time)
Your phone must reach port 18085 on the PC. If requests time out, allow it:

```powershell
netsh advfirewall firewall add rule name="BusGo Kong 18085" dir=in action=allow protocol=TCP localport=18085
```

## If Expo Go says the SDK doesn't match
Expo Go only runs the latest SDK. Upgrade the project in place:

```bash
npx expo install expo@latest
npx expo install --fix
```

## Demo accounts
Register directly in the app (accounts are auto-verified in dev), or log in
with an existing web account (phone + password). Mobile-wallet PIN in the mock
bank is `1234`.

## What's inside
- `src/config.ts` – backend URL resolution (LAN auto-detect / env override)
- `src/api/client.ts` – fetch wrapper: token header, BaseResponse envelope, error normalization
- `src/store/auth.tsx` – login/register/logout, persisted with AsyncStorage
- `src/screens/` – Login, Register, Home (search), Results (direct + transit),
  Seats, TransitSeats (per-bus stepper), Passenger, Payment (bank balances,
  promo codes, journey pay), Confirmation, Trips (bookings + tickets), Deals,
  Alerts (notifications), Profile
- Transit journeys use the same saga endpoints as the web: all buses are locked
  together; if any leg fails, nothing is booked.
