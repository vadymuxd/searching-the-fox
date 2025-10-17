# Filter Persistence Fix

## Problem
The PageFilter component was loading multiple times and the "filter disabled" state was not persisting across browser refreshes and tab changes.

## Root Causes

### 1. Multiple Loads Issue
- The `handleFilteredJobsChange` callback in `JobsPageContent` was recreating on every `jobs.length` change
- This triggered the `useEffect` in `PageFilter` to run multiple times
- No protection against concurrent loads

### 2. State Not Persisting
- Filter disabled state wasn't being checked from localStorage on fresh loads
- In-memory metadata wasn't always available when checking filter state

## Solutions Implemented

### 1. Stable Callback in JobsPageContent
**File**: `src/components/JobsPageContent.tsx`

```typescript
// Use ref to track jobs length without triggering effects
const jobsLengthRef = useRef(jobs.length);

useEffect(() => {
  jobsLengthRef.current = jobs.length;
}, [jobs.length]);

// Stable callback with empty dependencies
const handleFilteredJobsChange = useCallback((filteredJobs: Job[]) => {
  setFilteredJobs(filteredJobs);
  setIsFiltered(filteredJobs.length < jobsLengthRef.current);
}, []); // Empty deps - stable function
```

**Benefits**:
- Callback never recreates
- PageFilter doesn't reload unnecessarily
- Filter state remains stable

### 2. Prevent Concurrent Loads in PageFilter
**File**: `src/components/PageFilter.tsx`

```typescript
const loadingRef = useRef(false);

useEffect(() => {
  // Prevent concurrent loads
  if (loadingRef.current) {
    console.log('PageFilter: Already loading, skipping');
    return;
  }
  
  const loadFilter = async () => {
    loadingRef.current = true;
    // ... loading logic
    loadingRef.current = false;
  };
  
  // ... rest of effect
}, [jobs, user, applyFilter, onFilteredJobsChange, onReady]);
```

**Benefits**:
- Only one load at a time
- Prevents race conditions
- Cleaner console logs

### 3. Component Unmount Protection
**File**: `src/components/PageFilter.tsx`

```typescript
useEffect(() => {
  let isMounted = true;
  
  const loadFilter = async () => {
    if (isMounted) {
      setIsLoading(true);
      // ... other state updates only if mounted
    }
  };
  
  // Cleanup
  return () => {
    isMounted = false;
  };
}, [/* deps */]);
```

**Benefits**:
- No state updates after component unmounts
- Prevents React warnings
- Cleaner component lifecycle

### 4. Persistent Filter Disabled State
**File**: `src/lib/jobsDataManager.ts`

```typescript
isFilterDisabled(userId: string): boolean {
  try {
    // First check in-memory metadata
    const metadata = this.getMetadataForUser(userId);
    if (metadata && metadata.filterDisabled !== undefined) {
      return metadata.filterDisabled;
    }
    
    // Fallback to localStorage if not in memory
    const cachedMetadata = localStorage.getItem(CACHED_JOBS_METADATA_KEY);
    if (cachedMetadata) {
      const parsed = JSON.parse(cachedMetadata);
      if (parsed.userId === userId) {
        return parsed.filterDisabled || false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking filter disabled state:', error);
    return false;
  }
}
```

**Benefits**:
- Always checks localStorage if in-memory data not available
- Works across browser refreshes
- Survives page reloads

### 5. Filter Disabled State Management
**Files**: 
- `src/lib/localStorage.ts` (for anonymous users)
- `src/lib/jobsDataManager.ts` (for authenticated users)

**When filter is cleared**:
```typescript
const handleClear = useCallback(() => {
  // ... clear UI state
  
  if (user) {
    jobsDataManager.setFilterDisabled(user.id, true);
  } else {
    searchStorage.setFilterDisabled('anonymous', true);
  }
}, [jobs, onFilteredJobsChange, user]);
```

**When filter is applied**:
```typescript
const handleFilter = useCallback(async () => {
  // ... save keywords
  
  if (user) {
    jobsDataManager.setFilterDisabled(user.id, false);
  } else {
    searchStorage.setFilterDisabled('anonymous', false);
  }
}, [/* deps */]);
```

**On load**:
```typescript
// Check if filters are disabled before auto-applying
const filterDisabled = user 
  ? jobsDataManager.isFilterDisabled(user.id)
  : searchStorage.isFilterDisabled('anonymous');

if (filterDisabled) {
  // Don't apply filters
  onFilteredJobsChange(jobs);
  return;
}
```

## Testing Checklist

- [ ] Clear filters and refresh browser - should not reapply
- [ ] Clear filters and switch tabs - should not reapply
- [ ] Apply filters and refresh browser - should persist
- [ ] Apply filters and switch tabs - should persist
- [ ] Sign in/out doesn't break filter state
- [ ] Console logs show only one load per tab change
- [ ] No React warnings about state updates after unmount

## Storage Keys

### For Authenticated Users
- **Metadata**: `searchingTheFox_cachedJobsMetadata`
  - Contains: `filterDisabled`, `filterDisabledUpdatedAt`
- **Keywords**: Stored in cached metadata
  - Contains: `keywords`, `keywordsUpdatedAt`

### For Anonymous Users
- **Filter Disabled**: `searchingTheFox_filterDisabled_anonymous`
- **Keywords**: `searchingTheFox_pageFilter`

## State Flow

```
User clears filter
  ├─> UI: setFilterValue(''), setFiltersApplied(false)
  ├─> Storage: setFilterDisabled(userId, true)
  └─> Next load: Checks filterDisabled → Skip auto-apply

User applies filter
  ├─> UI: Apply keywords, setFiltersApplied(true)
  ├─> Storage: Save keywords, setFilterDisabled(userId, false)
  └─> Next load: Checks filterDisabled → Auto-apply keywords

Tab change / Refresh
  ├─> PageFilter loads
  ├─> Check filterDisabled from storage
  ├─> If disabled: Show all jobs (no filter)
  └─> If enabled: Load and apply saved keywords
```
