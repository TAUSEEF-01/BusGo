# Frontend Supabase Integration

## What Was Added

### 1. Dependencies
Added to `package.json`:
- `@supabase/supabase-js` - Supabase JavaScript client

**Note**: Dependencies will be installed automatically during Docker build. No need to run `npm install` manually.

### 2. Environment Variables
Created `.env` and `.env.example` files with:
```env
VITE_SUPABASE_URL=https://wtldkwqnfynxfqyqvehy.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Supabase Client
Created `src/lib/supabase.ts` with:
- Supabase client initialization
- Helper functions for authentication
- Session management

### 4. API Client Integration
Updated `src/api/client.ts` to:
- Use Supabase session for authentication
- Fallback to existing Zustand store
- Refresh Supabase session on 401 errors

### 5. Docker Configuration
Updated:
- `Dockerfile` - Added Supabase env vars as build arguments
- `docker-compose.yml` - Pass Supabase credentials to frontend service

## How to Use

### Option 1: Use Existing API Client (Recommended for Backend APIs)
```typescript
import { apiClient } from '@/api/client'

// Make API calls as usual - Supabase auth is handled automatically
const response = await apiClient.get('/trips')
```

### Option 2: Direct Supabase Queries (For Direct Database Access)
```typescript
import { supabase } from '@/lib/supabase'

// Query data directly from Supabase
const { data, error } = await supabase
  .from('trips')
  .select('*')
  .eq('status', 'active')
```

### Option 3: Supabase Authentication
```typescript
import { supabase } from '@/lib/supabase'

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123',
})

// Get current user
const { data: { user } } = await supabase.auth.getUser()

// Sign out
await supabase.auth.signOut()
```

## Building with Docker

The Supabase configuration is automatically included when building with Docker:

```bash
cd busgo/infrastructure
docker-compose up --build frontend
```

The Dockerfile will:
1. Install dependencies (including @supabase/supabase-js)
2. Copy environment variables
3. Build the application with Supabase credentials

## Local Development (Without Docker)

If you want to run locally without Docker:

```bash
cd busgo/frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

Make sure `.env` file exists with the Supabase credentials.

## Environment Variables in Docker

The `docker-compose.yml` passes these build arguments:
- `VITE_API_BASE_URL` - Backend API URL
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

These are baked into the build at compile time.

## Authentication Flow

The updated API client now:
1. Checks for Supabase session first
2. Falls back to Zustand store if no Supabase session
3. Refreshes Supabase session on 401 errors
4. Signs out from both Supabase and local store on auth failure

This provides backward compatibility while enabling Supabase features.

## Next Steps

1. **Test the integration** - Build and run the Docker container
2. **Migrate authentication** - Consider moving to Supabase Auth completely
3. **Add real-time features** - Use Supabase real-time subscriptions
4. **Direct database queries** - Query Supabase directly for read operations
5. **File uploads** - Use Supabase Storage for tickets and receipts
