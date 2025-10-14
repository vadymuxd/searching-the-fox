# Pre-Deployment Checklist

Complete these steps **BEFORE** deploying to Vercel:

---

## ✅ Step 1: Verify Local Environment

- [ ] App runs locally without errors (`npm run dev`)
- [ ] Authentication works (sign up, sign in, sign out)
- [ ] Job search works
- [ ] Database integration works (Move to DB button)
- [ ] OAuth providers work (Google at minimum)

---

## ✅ Step 2: Check Supabase Configuration

- [ ] Database migration run (`001_initial_schema.sql`)
- [ ] Tables exist: `users`, `jobs`, `user_jobs`
- [ ] RLS policies enabled
- [ ] OAuth providers configured (Google, GitHub, LinkedIn)
- [ ] Site URL set (will update after first deployment)

---

## ✅ Step 3: Prepare Repository

- [ ] All changes committed
- [ ] Code pushed to GitHub
- [ ] `.env.local` file NOT committed (in `.gitignore`)
- [ ] `.env.production` exists with Supabase credentials

---

## ✅ Step 4: Gather Environment Variables

You'll need these for Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=https://nwgusbtqxsakmukpniqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (copy from .env.local)
NEXT_PUBLIC_SITE_URL=(will set after first deployment)
```

**Get your anon key:**
```bash
cat .env.local | grep NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Copy the value after the `=` sign.

---

## ✅ Step 5: Deploy to Vercel

Follow these steps in order:

1. [ ] Log in to Vercel (https://vercel.com)
2. [ ] Import project from GitHub
3. [ ] Add environment variables (all 3)
4. [ ] Click Deploy
5. [ ] Wait for build to complete
6. [ ] Copy your Vercel domain

---

## ✅ Step 6: Post-Deployment Configuration

**After first deployment**, update these:

### Vercel
- [ ] Update `NEXT_PUBLIC_SITE_URL` to your Vercel domain
- [ ] Redeploy

### Supabase
- [ ] Update Site URL to Vercel domain
- [ ] Add Vercel domain to Redirect URLs with `/**`

### OAuth Providers
- [ ] Google: Add Vercel domain to authorized origins and redirect URIs
- [ ] GitHub: Verify callback URL is correct
- [ ] LinkedIn: Verify redirect URL is correct

---

## ✅ Step 7: Test Production

- [ ] Visit your Vercel domain
- [ ] Test sign in with email/password
- [ ] Test sign in with Google OAuth
- [ ] Test job search
- [ ] Test database save (Move to DB button)
- [ ] Refresh page - jobs should load from database

---

## 🚀 Quick Deploy Command Sequence

```bash
# 1. Make sure everything is committed
git status

# 2. Push to GitHub
git add .
git commit -m "Prepare for production deployment"
git push origin main

# 3. Get your anon key for Vercel
cat .env.local | grep NEXT_PUBLIC_SUPABASE_ANON_KEY

# 4. Now go to Vercel and import your project
```

---

## 📝 Notes

- **First deployment**: Set `NEXT_PUBLIC_SITE_URL` to empty or `https://localhost:3000`
- **After deployment**: Update to actual Vercel domain and redeploy
- **Custom domain**: Can add later in Vercel settings

---

**Ready?** Open the full guide: `VERCEL_DEPLOYMENT_GUIDE.md` 🚀
