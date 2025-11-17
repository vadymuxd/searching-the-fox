# Email Template Feature

## Overview

The email template feature allows users to view NEW jobs filtered by their saved keywords in an email-friendly HTML format. This page is designed to be used as a preview for automated email notifications.

## Files Created

### 1. API Endpoint: `/src/app/api/email-jobs/route.ts`

**Purpose:** Fetches NEW status jobs filtered by user's keywords from the database.

**Endpoint:** `GET /api/email-jobs?userId={userId}`

**Query Parameters:**
- `userId` (required): The authenticated user's UUID

**Response:**
```json
{
  "success": true,
  "jobs": [...],
  "total": 10
}
```

**Logic:**
1. Fetches user's keywords from `users` table
2. Queries `user_jobs` table for ALL jobs with status='new' for that user (no limit)
3. Filters jobs by checking if any keyword appears in the job title (case-insensitive)
4. Returns filtered jobs with full details
5. Keywords are NOT included in response (hidden from email display)

### 2. Email Template Page: `/src/app/email-template/page.tsx`

**Purpose:** Renders an email-friendly HTML page displaying NEW jobs.

**Route:** `/email-template`

**Features:**
- ✅ Requires authentication (redirects to home if not logged in)
- ✅ Fetches NEW jobs filtered by keywords via API using authenticated user's ID
- ✅ Clickable logo linking to https://searching-the-fox.vercel.app/results
- ✅ Displays company logo with fallback (first letter of company name)
- ✅ Shows company name
- ✅ Shows job title
- ✅ Provides link to original job post
- ✅ Displays additional job details (location, job type, salary, remote status)
- ✅ Keyword filtering active but hidden from display (no filter pills shown)
- ✅ Email-friendly inline styles (no external CSS)
- ✅ Responsive design (max-width: 600px for email clients)

## Database Schema Used

### Tables:

1. **`users`** - Stores user keywords
   - `id`: UUID (primary key)
   - `keywords`: TEXT[] array of job title keywords

2. **`jobs`** - Stores all job data
   - `id`: UUID
   - `title`: Job title
   - `company`: Company name
   - `company_logo_url`: Logo URL
   - `job_url`: Link to job posting
   - `location`: Job location
   - (and other job details)

3. **`user_jobs`** - Junction table linking users to jobs
   - `id`: UUID (user_job_id)
   - `user_id`: Reference to user
   - `job_id`: Reference to job
   - `status`: Enum ('new', 'interested', 'applied', etc.)

## How It Works

### User Flow:

1. **User navigates to `/email-template`**
2. **Authentication Check:**
   - If not logged in → Redirected to home page
   - If logged in → Proceeds to fetch jobs

3. **Data Fetching:**
   - Frontend calls `/api/email-jobs?userId={userId}`
   - API fetches user's keywords from database
   - API queries ALL NEW jobs for the user (no limit)
   - API filters jobs by keywords (checks if any keyword appears in job title)
   - API returns filtered jobs (keywords not included in response)

4. **Display:**
   - Shows clickable logo (links to /results page)
   - Shows count of filtered new jobs
   - Keywords are applied but NOT displayed in the email
   - Lists each job with:
     - Company logo (or fallback initial)
     - Company name
     - Job location
     - Job title (clickable, links to job post)
     - Job type, remote status, salary
     - Description preview
     - "View Job Post" button
     - Posted date

### Keyword Filtering (Backend Only):

The API filters jobs by checking if **any** user keyword appears in the job title:

```typescript
keywords.some((keyword: string) =>
  jobTitle.toLowerCase().includes(keyword.toLowerCase())
);
```

**Example:**
- User keywords: `["Software Engineer", "Frontend Developer"]`
- Job title: "Senior Software Engineer - React"
- Result: ✅ Match (contains "Software Engineer")

**Important:** The keyword filtering happens in the API, but the keywords are NOT displayed in the email template. Users see only the filtered results without knowing which keywords were used.

## Usage Examples

### For Email Automation:

This page is designed to be:
1. Rendered server-side or fetched as HTML
2. Embedded in email notifications
3. Sent to users when new jobs match their keywords

### Manual Testing:

1. Make sure you're logged in
2. Navigate to `http://localhost:3000/email-template`
3. You'll see NEW jobs filtered by your saved keywords (keywords hidden)

### Setting Keywords:

Keywords are stored in the `users.keywords` column. Users can set keywords through the main application's filter/preferences interface. The email will only show jobs matching these keywords, but the keywords themselves are not displayed in the email.

## Email-Friendly Design

The template uses:
- ✅ Inline styles (no external CSS files)
- ✅ Tables/divs with inline styles for layout
- ✅ Maximum width of 600px (standard for emails)
- ✅ Web-safe fonts (Arial)
- ✅ Absolute URLs for images
- ✅ Simple, clean design compatible with most email clients

## Future Enhancements

Potential improvements:
- [ ] Add date range filtering (e.g., jobs from last 24 hours)
- [ ] Support for HTML email service integration (SendGrid, AWS SES)
- [ ] Cron job to automatically send emails
- [ ] Unsubscribe link
- [ ] Preference center for email frequency
- [ ] Job count threshold (only send if X+ new jobs)
- [ ] Plaintext version for email clients that don't support HTML
- [ ] Optional: Show keywords in email footer for transparency

## Testing

### Test the API directly:
```bash
# Replace USER_ID with actual user UUID
curl "http://localhost:3000/api/email-jobs?userId=USER_ID"
```

### Test the page:
1. Sign in to the application
2. Set some keywords in your user preferences
3. Navigate to `/email-template`
4. Verify jobs displayed match your keywords
5. Verify only NEW status jobs appear
6. Verify keywords are NOT displayed in the email (no filter pills)
7. Click on the logo and verify it redirects to /results page

## Security Considerations

- ✅ Requires authentication (user must be logged in)
- ✅ Uses Supabase RLS (Row Level Security) for database queries
- ✅ User can only see their own jobs
- ✅ API validates userId parameter
- ✅ No sensitive data exposed in frontend

## Performance

- Fetches ALL NEW jobs then filters by keywords (no limit on initial query)
- Database may limit to 1000 rows max (Supabase default)
- Uses database indexes on:
  - `user_jobs(user_id, status)`
  - `user_jobs(created_at)`
- Efficient keyword filtering in API (single pass, client-side filter)
- No additional database queries for keyword filtering
