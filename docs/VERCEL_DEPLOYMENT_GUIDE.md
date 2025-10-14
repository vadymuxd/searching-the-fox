# Vercel Deployment Guide with Supabase Authentication

This guide will walk you through deploying Searching The Fox to Vercel with Supabase integration.

---

## Prerequisites

Before you begin, make sure you have:
- ✅ A Vercel account (sign up at https://vercel.com)
- ✅ Your Supabase project set up and running
- ✅ OAuth providers configured in Supabase (Google, GitHub, LinkedIn)
- ✅ Your repository pushed to GitHub

---

## Step 1: Prepare Environment Variables

First, let's make sure your `.env.production` file has all the correct values.

### Check Your `.env.production` File

Open `.env.production` and verify it contains:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://nwgusbtqxsakmukpniqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Site URL (Update this with your Vercel domain after first deployment)
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
```

**Important**: 
- Keep `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as is
- We'll update `NEXT_PUBLIC_SITE_URL` after the first deployment

---

## Step 2: Update Supabase Auth Settings (CRITICAL)

Before deploying, you MUST update Supabase auth configuration:

### 2.1 Get Your Vercel Domain

You'll get a domain like: `https://searching-the-fox.vercel.app`

If you have a custom domain, use that instead.

### 2.2 Update Supabase Site URL

1. Go to: https://supabase.com/dashboard/project/nwgusbtqxsakmukpniqo/auth/url-configuration
2. Find **Site URL**
3. Update it to your Vercel domain: `https://your-project.vercel.app`
4. Click **Save**

### 2.3 Update Redirect URLs

In the same page, under **Redirect URLs**, add:

```
https://your-project.vercel.app/**
http://localhost:3000/**
```

The `**` wildcard allows all paths under your domain.

### 2.4 Update OAuth Provider Redirect URIs

For each OAuth provider (Google, GitHub, LinkedIn), you need to add your Vercel domain:

#### Google OAuth Console
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find your OAuth 2.0 Client ID
3. Add to **Authorized JavaScript origins**:
   - `https://your-project.vercel.app`
4. Add to **Authorized redirect URIs**:
   - `https://your-project.vercel.app/auth/callback`
5. Click **Save**

#### GitHub OAuth App
1. Go to: https://github.com/settings/developers
2. Find your OAuth App
3. Update **Authorization callback URL**:
   - `https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback`
   - (This stays the same - Supabase handles the redirect)

#### LinkedIn OAuth App
1. Go to: https://www.linkedin.com/developers/apps
2. Find your app → Auth tab
3. Add to **Redirect URLs**:
   - `https://nwgusbtqxsakmukpniqo.supabase.co/auth/v1/callback`
   - (This stays the same - Supabase handles the redirect)

---

## Step 3: Push Your Code to GitHub

Make sure all your changes are committed and pushed:

```bash
git add .
git commit -m "Add Supabase authentication and database integration"
git push origin main
```

---

## Step 4: Connect Vercel to GitHub

### 4.1 Log in to Vercel

1. Go to: https://vercel.com
2. Click **Log In**
3. Choose **Continue with GitHub**

### 4.2 Import Your Repository

1. Click **Add New...** → **Project**
2. Find your repository: `vadymuxd/searching-the-fox`
3. Click **Import**

---

## Step 5: Configure Project Settings in Vercel

### 5.1 Framework Preset

Vercel should automatically detect **Next.js**. If not, select it.

### 5.2 Root Directory

Leave as `.` (root)

### 5.3 Build Settings

Vercel will use defaults:
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

Leave these as default.

---

## Step 6: Add Environment Variables in Vercel

This is **CRITICAL** - your app won't work without these!

### 6.1 Click "Environment Variables"

In the project configuration screen, expand the **Environment Variables** section.

### 6.2 Add Each Variable

Add these **THREE** environment variables:

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL
- **Name**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://nwgusbtqxsakmukpniqo.supabase.co`
- **Environments**: Select **Production**, **Preview**, and **Development**

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Name**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: Your Supabase anon key (from your `.env.local` file)
- **Environments**: Select **Production**, **Preview**, and **Development**

To find your anon key:
```bash
cat .env.local | grep NEXT_PUBLIC_SUPABASE_ANON_KEY
```

#### Variable 3: NEXT_PUBLIC_SITE_URL
- **Name**: `NEXT_PUBLIC_SITE_URL`
- **Value**: Leave empty for now (we'll update after first deployment)
- **Environments**: Select **Production**, **Preview**, and **Development**

### 6.3 Important Notes

- ✅ Make sure to check all three environments for each variable
- ✅ Double-check there are no extra spaces in the values
- ✅ Don't include quotes around the values

---

## Step 7: Deploy!

### 7.1 Click "Deploy"

Once all environment variables are added, click the **Deploy** button.

### 7.2 Wait for Build

The build process takes 2-5 minutes. You'll see:
- ✅ Installing dependencies
- ✅ Building application
- ✅ Deploying to Vercel Edge Network

### 7.3 Get Your Domain

Once deployed, you'll see:
```
🎉 Deployed to: https://searching-the-fox-xxxx.vercel.app
```

Copy this URL!

---

## Step 8: Update Site URL (POST-DEPLOYMENT)

Now that you have your Vercel domain, update the site URL:

### 8.1 Update Vercel Environment Variable

1. Go to your project in Vercel
2. Click **Settings** → **Environment Variables**
3. Find `NEXT_PUBLIC_SITE_URL`
4. Click **Edit**
5. Set value to: `https://searching-the-fox-xxxx.vercel.app` (your actual domain)
6. Click **Save**

### 8.2 Update Supabase Site URL

1. Go to: https://supabase.com/dashboard/project/nwgusbtqxsakmukpniqo/auth/url-configuration
2. Update **Site URL** to: `https://searching-the-fox-xxxx.vercel.app`
3. Add to **Redirect URLs**: `https://searching-the-fox-xxxx.vercel.app/**`
4. Click **Save**

### 8.3 Update OAuth Providers

Update all OAuth providers (Google, GitHub, LinkedIn) with your new Vercel domain (see Step 2.4 above).

### 8.4 Redeploy

After updating environment variables:
1. Go to **Deployments** tab in Vercel
2. Click the **︙** menu on the latest deployment
3. Click **Redeploy**
4. Check **Use existing Build Cache**
5. Click **Redeploy**

---

## Step 9: Test Your Deployment

### 9.1 Visit Your Site

Go to: `https://searching-the-fox-xxxx.vercel.app`

### 9.2 Test Authentication

1. Click **Sign In**
2. Try **Continue with Google** (or other OAuth providers)
3. Should redirect to Google → back to your site
4. Should see your username in the top right

### 9.3 Test Job Search

1. Perform a job search
2. Results should display
3. Jobs should auto-save to database (if signed in)

### 9.4 Test Database Integration

1. Refresh the page
2. Should still see your jobs (loaded from database)
3. Click **Move Local Data to DB** (if applicable)
4. Should see success message

---

## Step 10: Set Up Custom Domain (Optional)

If you have a custom domain:

### 10.1 Add Domain in Vercel

1. Go to **Settings** → **Domains**
2. Add your domain (e.g., `searchingthefox.com`)
3. Follow Vercel's instructions to update DNS

### 10.2 Update Environment Variables

Update `NEXT_PUBLIC_SITE_URL` to your custom domain.

### 10.3 Update Supabase and OAuth

Update Site URL and Redirect URLs in Supabase and all OAuth providers.

---

## Troubleshooting

### Issue: "Auth error" or "Redirect mismatch"

**Solution**:
- Check that Supabase Site URL matches your Vercel domain exactly
- Check that Redirect URLs include `/**` wildcard
- Check OAuth provider redirect URIs are correct

### Issue: "Environment variable not found"

**Solution**:
- Go to Vercel → Settings → Environment Variables
- Make sure all three variables are set
- Make sure they're enabled for Production
- Redeploy after adding variables

### Issue: "Database connection failed"

**Solution**:
- Check Supabase URL and anon key are correct
- Check there are no extra spaces in env variables
- Try copying the values directly from Supabase dashboard

### Issue: "OAuth not working"

**Solution**:
- Check OAuth providers are enabled in Supabase
- Check redirect URIs match exactly (no trailing slashes)
- Check Site URL in Supabase is correct

### Issue: Build fails

**Solution**:
- Check the build logs in Vercel
- Make sure all dependencies are in `package.json`
- Try building locally first: `npm run build`

---

## Monitoring and Logs

### View Logs

1. Go to your project in Vercel
2. Click **Deployments**
3. Click on a deployment
4. Click **Functions** to see runtime logs

### View Analytics

1. Go to **Analytics** tab
2. See page views, errors, and performance metrics

---

## Production Checklist

Before going live, make sure:

- ✅ All environment variables are set in Vercel
- ✅ Supabase Site URL matches your Vercel domain
- ✅ Redirect URLs include your Vercel domain with `/**`
- ✅ OAuth providers updated with Vercel domain
- ✅ Database migration run in Supabase (001_initial_schema.sql)
- ✅ RLS policies enabled in Supabase
- ✅ Test authentication flow works
- ✅ Test job search and save works
- ✅ Test database integration works
- ✅ Test OAuth sign-in works

---

## Next Steps After Deployment

1. **Monitor errors**: Check Vercel logs regularly
2. **Set up alerts**: Configure Vercel to notify you of errors
3. **Add analytics**: Consider adding Google Analytics or similar
4. **Custom domain**: Set up your custom domain
5. **SEO**: Add meta tags and sitemap
6. **Performance**: Monitor and optimize load times

---

## Environment Variables Reference

Quick reference for all environment variables:

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=https://nwgusbtqxsakmukpniqo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
```

---

## Support Links

- **Vercel Documentation**: https://vercel.com/docs
- **Supabase Documentation**: https://supabase.com/docs
- **Next.js Documentation**: https://nextjs.org/docs
- **Your Supabase Dashboard**: https://supabase.com/dashboard/project/nwgusbtqxsakmukpniqo

---

**Ready to Deploy?** Follow the steps above and your app will be live in minutes! 🚀

If you encounter any issues, check the Troubleshooting section or reach out for help.
