# Google authentication setup

The code uses Supabase Auth for Google identity and exchanges the verified
Supabase session for a BusGo access/refresh token. BusGo's `users` table remains
the source of truth for customer, operator, and admin roles.

## 1. Configure Google

In Google Auth Platform, create a **Web application** OAuth client. Add:

- Authorized JavaScript origin: `https://busgo.farefin.com`
- Local development origin, if needed: `http://localhost:5173`
- Authorized redirect URI: `https://wtldkwqnfynxfqyqvehy.supabase.co/auth/v1/callback`

Configure the OAuth consent screen with the `openid`, email, and profile scopes.

## 2. Configure Supabase

In **Authentication > Providers > Google**, enable Google and add the Google
client ID and client secret.

In **Authentication > URL Configuration**, set:

- Site URL: `https://busgo.farefin.com`
- Redirect URL: `https://busgo.farefin.com/login?google=callback`
- Local web redirect: `http://localhost:5173/login?google=callback`
- Native app redirect: `busgo://auth/callback`
- Native development and production builds return through
  `busgo://auth/callback`. Expo Go can be used for local testing by adding
  `exp://**` to the redirect allow list; remove that broad development wildcard
  before production release.

## 3. Environment variables

Web and backend containers use:

```env
SUPABASE_URL=https://wtldkwqnfynxfqyqvehy.supabase.co
SUPABASE_ANON_KEY=your-supabase-publishable-key
```

The mobile app uses:

```env
EXPO_PUBLIC_API_URL=https://busgo.farefin.com
EXPO_PUBLIC_SUPABASE_URL=https://wtldkwqnfynxfqyqvehy.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
```

Copy `mobile/.env.example` to `mobile/.env` for local development.

## 4. Existing roles

On first Google login, a matching email is linked to the existing BusGo user,
preserving its current role. New web users may select CUSTOMER or OPERATOR.
Mobile registration creates CUSTOMER accounts only. ADMIN can never be selected
by a client; after the person's first verified login, promote the account with a
controlled database update.
