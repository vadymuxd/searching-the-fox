# User Preferences - Database Storage

## Overview

User search preferences and parameters are now stored in the database for authenticated users instead of localStorage. This allows users to maintain their search history and preferences across devices.

---

## What Gets Stored

### For Authenticated Users (Database)

Stored in `users.preferences` JSONB field:

```json
{
  "lastSearch": {
    "jobTitle": "Software Engineer",
    "location": "London",
    "site": "all",
    "resultsWanted": 1000,
    "hoursOld": "24"
  },
  "defaultLocation": "London",
  "defaultSite": "all",
  "defaultHoursOld": "24",
  "defaultResultsWanted": 1000,
  "sortPreference": "posted-recent",
  "displayMode": "table",
  "pageFilter": "Senior, Lead, Principal"
}
```

### For Anonymous Users (localStorage)

Stored in browser localStorage:
- `searchingTheFox_searchData` - Last search parameters
- `searchingTheFox_searchResults` - Search results and jobs
- `searchingTheFox_pageFilter` - Page filter preferences
- `searchingTheFox_selectedJobs` - Selected job IDs

---

## How It Works

### User Signs In

1. **Load preferences from database**:
   ```typescript
   const result = await getUserPreferences(userId);
   if (result.success && result.preferences?.lastSearch) {
     setCurrentSearch(result.preferences.lastSearch);
   }
   ```

2. **Load jobs from database**:
   ```typescript
   const result = await getUserJobs(userId);
   if (result.success && result.jobs.length > 0) {
     setJobs(result.jobs);
     setSearchStarted(true);
   }
   ```

3. **Search form pre-fills** with last search parameters

### User Performs Search

1. **Save to database** (if authenticated):
   ```typescript
   await saveLastSearch(user.id, searchData);
   ```

2. **Auto-save jobs**:
   ```typescript
   await saveJobsToDatabase(jobs, user.id);
   ```

3. **Preferences updated** with latest search parameters

### User Signs Out → Signs In Again

1. Search form shows their **last search parameters**
2. Jobs are **loaded from database**
3. Can continue where they left off

---

## Implementation Files

### New Files Created

#### `src/lib/db/userPreferences.ts`

Server actions for user preferences:

**Functions:**
- `getUserPreferences(userId)` - Get all user preferences
- `saveLastSearch(userId, searchData)` - Save search parameters
- `savePageFilter(userId, filterValue)` - Save page filter
- `updateUserPreferences(userId, preferences)` - Partial update
- `getLastSearch(userId)` - Get last search parameters only
- `clearUserPreferences(userId)` - Reset to defaults

**Example Usage:**
```typescript
// Save search when user performs search
await saveLastSearch(user.id, {
  jobTitle: 'Software Engineer',
  location: 'London',
  site: 'all',
  resultsWanted: 1000,
  hoursOld: '24',
});

// Load preferences when user signs in
const result = await getUserPreferences(user.id);
if (result.success) {
  const lastSearch = result.preferences?.lastSearch;
  // Pre-fill search form
}
```

### Updated Files

#### `src/app/page.tsx`

**Changes:**
1. Added `loadUserPreferencesFromDb()` function
2. Load preferences when user signs in
3. Save to database instead of localStorage for authenticated users
4. Keep localStorage for anonymous users

**Key Code:**
```typescript
// On auth state change
if (user) {
  loadUserJobsFromDb(user.id);
  loadUserPreferencesFromDb(user.id); // ← New
}

// On search
if (user) {
  await saveLastSearch(user.id, searchData); // ← New
} else {
  searchStorage.saveSearchData(searchData); // ← localStorage fallback
}
```

#### `src/components/PageFilter.tsx`

**Changes:**
1. Integrated with AuthContext to check if user is authenticated
2. Load page filter from database for authenticated users on mount
3. Save page filter to database when user clicks save button
4. Fallback to localStorage for anonymous users

**Key Code:**
```typescript
// On save
if (user) {
  await savePageFilterToDb(user.id, filterValue); // ← Database
} else {
  searchStorage.savePageFilter(filterValue); // ← localStorage
}

// On load
if (user) {
  const { preferences } = await getUserPreferences(user.id);
  savedFilter = preferences?.pageFilter; // ← Database
} else {
  savedFilter = searchStorage.loadPageFilter(); // ← localStorage
}
```

---

## User Experience Flow

### Anonymous User

```
Search → Results stored in localStorage
       → Search parameters in localStorage
       → Refresh page → Data restored from localStorage
```

### Authenticated User

```
Search → Results saved to database (jobs + user_jobs tables)
       → Search parameters saved to database (users.preferences)
       → Refresh page → Data loaded from database
       → Sign out → Sign in → Everything restored from database
```

### Migration Path

```
Anonymous User with localStorage data
  ↓
Signs up / Signs in
  ↓
Clicks "Move Local Data to DB"
  ↓
Jobs moved to database
Search preferences can be loaded from form state
  ↓
Future searches saved to database
```

---

## Benefits

### ✅ **Cross-Device Sync**
- Sign in on laptop, see same searches on phone
- Search parameters consistent across devices

### ✅ **Persistent History**
- Preferences saved permanently in database
- Not lost when clearing browser cache

### ✅ **Personalization**
- Each user has their own default search settings
- Can track search behavior over time

### ✅ **Better UX**
- Returning users see familiar search interface
- No need to re-enter common search parameters

---

## Database Schema

### users table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  preferences JSONB DEFAULT '{}',  -- ← Search preferences stored here
  metadata JSONB DEFAULT '{}'
);
```

### Preferences Structure

```typescript
interface UserPreferences {
  lastSearch?: SearchFormData;      // Complete last search
  defaultLocation?: string;          // Default location
  defaultSite?: string;              // Default job board
  defaultHoursOld?: string;          // Default time range
  defaultResultsWanted?: number;     // Default results count
  sortPreference?: string;           // Sort preference
  displayMode?: string;              // Table/card view
  pageFilter?: string;               // Page filter (comma-separated job titles)
}
```

---

## Testing

### Test 1: Save Search Parameters

1. Sign in
2. Perform a search:
   - Job title: "Product Manager"
   - Location: "New York"
   - Site: "LinkedIn"
3. Sign out
4. Sign in again
5. ✅ Search form should show "Product Manager", "New York", "LinkedIn"

### Test 2: Cross-Device

1. Sign in on Device A
2. Perform a search
3. Sign in on Device B
4. ✅ Should see same search parameters

### Test 3: Anonymous to Authenticated

1. As anonymous user, perform search
2. Sign up/Sign in
3. Perform new search
4. ✅ New search parameters saved to database
5. Refresh page
6. ✅ Last search parameters loaded from database

### Test 4: Database Verification

1. Perform a search while signed in
2. Save a page filter (e.g., "Senior, Lead, Principal")
3. Go to Supabase Dashboard
4. Table Editor → `users` table
5. Find your user
6. Check `preferences` column
7. ✅ Should see your search parameters and page filter in JSON format

### Test 5: Page Filter Cross-Device

1. Sign in on Device A
2. Enter and save a page filter: "Senior, Principal, Staff"
3. Sign in on Device B
4. ✅ Filter should be automatically loaded and applied

---

## API Reference

### getUserPreferences(userId)

**Parameters:**
- `userId: string` - User's UUID

**Returns:**
```typescript
{
  success: boolean;
  preferences: UserPreferences | null;
  error?: string;
}
```

**Example:**
```typescript
const result = await getUserPreferences(user.id);
if (result.success) {
  console.log(result.preferences?.lastSearch);
}
```

### saveLastSearch(userId, searchData)

**Parameters:**
- `userId: string` - User's UUID
- `searchData: SearchFormData` - Search parameters to save

**Returns:**
```typescript
{
  success: boolean;
  error?: string;
}
```

**Example:**
```typescript
await saveLastSearch(user.id, {
  jobTitle: 'Data Scientist',
  location: 'San Francisco',
  site: 'all',
  resultsWanted: 500,
  hoursOld: '72',
});
```

### updateUserPreferences(userId, preferences)

**Parameters:**
- `userId: string` - User's UUID
- `preferences: Partial<UserPreferences>` - Preferences to update

**Returns:**
```typescript
{
  success: boolean;
  error?: string;
}
```

**Example:**
```typescript
await updateUserPreferences(user.id, {
  sortPreference: 'company-asc',
  displayMode: 'card',
});
```

---

## Troubleshooting

### Issue: Search parameters not loading

**Solution:**
- Check user is authenticated
- Check `users.preferences` in Supabase
- Check browser console for errors
- Verify `getUserPreferences()` is being called

### Issue: Parameters saved but not persisting

**Solution:**
- Check `updated_at` timestamp in database
- Verify RLS policies allow user to update their own row
- Check for errors in Supabase logs

### Issue: Old localStorage data interfering

**Solution:**
- Clear localStorage: `searchStorage.clearSearchData()`
- Sign out and sign in again
- Database preferences should override localStorage

---

**Status**: ✅ User preferences now stored in database for authenticated users!

Anonymous users continue to use localStorage, with seamless migration when they sign up.
