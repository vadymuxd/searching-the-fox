# Supabase Setup Guide

## Stage 3: Connection Setup ✅

### What We've Done

1. **Installed Supabase Packages**
   ```bash
   npm install @supabase/supabase-js @supabase/ssr
   ```

2. **Configured Environment Variables**
   - Created `.env.local` with Supabase credentials
   - Project URL: `https://nwgusbtqxsakmukpniqo.supabase.co`
   - Anon Key: Configured (public, safe for client-side)

3. **Created Supabase Client Utilities**
   - `src/lib/supabase/client.ts` - Client-side Supabase client (for use in React components)
   - `src/lib/supabase/server.ts` - Server-side Supabase client (for use in Server Components/Actions)
   - `src/lib/supabase/middleware.ts` - Middleware helper for session management

4. **Set Up Middleware**
   - `middleware.ts` - Handles authentication state across the app
   - Automatically refreshes user sessions
   - Protects routes (will be configured later)

5. **Created Test Page**
   - Visit `/test-supabase` to verify connection
   - Tests client creation, session retrieval, and database connectivity

---

## Testing the Connection

### Start Development Server

```bash
npm run dev
```

### Visit Test Page

Navigate to: `http://localhost:3000/test-supabase`

You should see:
- ✅ Connection status
- 📊 Session details (none yet, no users)
- 🔍 Environment variable check
- 📋 Next steps checklist

---

## Project Structure

```
src/lib/supabase/
├── client.ts          # Browser client (use in 'use client' components)
├── server.ts          # Server client (use in server components/actions)
└── middleware.ts      # Session management helper

middleware.ts          # Root middleware (handles all requests)
.env.local            # Environment variables (DO NOT COMMIT)
```

---

## Usage Examples

### Client-Side (React Components)

```typescript
'use client';

import { createClient } from '@/lib/supabase/client';

export default function MyComponent() {
  const supabase = createClient();
  
  // Use supabase client for queries
  const fetchData = async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*');
  };
  
  return <div>...</div>;
}
```

### Server-Side (Server Components)

```typescript
import { createClient } from '@/lib/supabase/server';

export default async function MyServerComponent() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*');
  
  return <div>...</div>;
}
```

### Server Actions

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';

export async function updateJobStatus(jobId: string, status: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('user_jobs')
    .update({ status })
    .eq('job_id', jobId);
  
  return { data, error };
}
```

---

## Next Steps

### Stage 4: Authentication Setup
- [ ] Create signup/login pages
- [ ] Set up auth components
- [ ] Configure auth callbacks
- [ ] Test user registration

### Stage 5: Database Tables
- [ ] Run SQL migrations in Supabase dashboard
- [ ] Create `users` table
- [ ] Create `jobs` table
- [ ] Create `user_jobs` table
- [ ] Set up Row Level Security (RLS) policies

### Stage 6: Auth Frontend
- [ ] Build signup form
- [ ] Build login form
- [ ] Add protected routes
- [ ] Add user session display

---

## Troubleshooting

### Environment Variables Not Loading
- Restart dev server after changing `.env.local`
- Verify file is named `.env.local` (not `.env`)
- Check variables start with `NEXT_PUBLIC_` for client-side access

### Connection Errors
- Verify Supabase project is active
- Check API keys are correct
- Ensure project URL matches your project

### CORS Errors
- Add your development URL to Supabase allowed origins:
  - Go to Supabase Dashboard → Settings → API
  - Add `http://localhost:3000` to allowed origins

---

## Important Security Notes

⚠️ **Never commit `.env.local` to version control**

The `.env.local` file contains your Supabase credentials. Make sure it's in `.gitignore`.

✅ **Anon Key is Safe for Client-Side**

The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is designed to be public. It's protected by Row Level Security (RLS) policies in your database.

🔐 **Service Role Key** (Not Used Yet)

For backend operations that bypass RLS, you'll need the service role key. We'll add this later for the Python backend.

---

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Supabase Next.js Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

**Status**: ✅ Stage 3 Complete - Supabase Connected!

Ready to proceed to Stage 4 (Authentication) or Stage 5 (Database Tables)?
