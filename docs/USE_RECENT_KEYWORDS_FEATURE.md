# Use Recent Keywords Feature

## Overview
Added a "Use recent keywords" button that allows users to quickly restore their previously saved filter keywords after clearing them. This works as a toggle between cleared and applied filter states.

## User Flow

### Scenario 1: User Clears Filters
1. User has active filters applied
2. User clicks "Clear filters" button
3. **State saved**: 
   - `filterDisabled = true` (in localStorage/cache)
   - Keywords remain saved in storage
   - All jobs are shown (no filtering)
4. **UI changes**:
   - Label shows "Filter by job titles"
   - "Use recent keywords" button appears (if keywords were previously saved)

### Scenario 2: User Restores Filters
1. User sees "Use recent keywords" button
2. User clicks the button
3. **State updated**:
   - `filterDisabled = false` (in localStorage/cache)
   - Saved keywords are loaded and applied
   - Jobs are filtered
4. **UI changes**:
   - Label shows "X jobs filtered by keywords"
   - Filter input shows the applied keywords
   - "Clear filters" button appears

### Scenario 3: Browser Refresh
1. User refreshes the browser
2. **Behavior**:
   - If filters were disabled: Shows "Use recent keywords" button (keywords available but not applied)
   - If filters were enabled: Auto-applies keywords and shows filtered results
3. **State persists**: Both filter state and keywords survive refresh

## Implementation Details

### New State Variable
```typescript
const [hasSavedKeywords, setHasSavedKeywords] = useState(false);
```
Tracks whether there are saved keywords available for restoration.

### New Handler Function
```typescript
const handleUseRecentKeywords = useCallback(async () => {
  // Load saved keywords from storage
  // Re-enable filters (setFilterDisabled(false))
  // Apply the loaded keywords
}, [user, jobs, applyFilter]);
```

### UI Components

#### Desktop Layout
```tsx
<Group gap="md" align="end" wrap="nowrap">
  <TextInput {...inputProps} />
  
  {hasSavedKeywords && (
    <SecondaryButton
      onClick={handleUseRecentKeywords}
      leftSection={<IconDeviceFloppy size={16} />}
    >
      Use recent keywords
    </SecondaryButton>
  )}
  
  <Button onClick={handleFilter}>Filter</Button>
</Group>
```

#### Mobile Layout
```tsx
<Stack gap="xs">
  <TextInput {...inputProps} />
  
  {hasSavedKeywords && (
    <TextButton 
      onClick={handleUseRecentKeywords}
      leftSection={<IconDeviceFloppy size={16} />}
    >
      Use recent keywords
    </TextButton>
  )}
</Stack>
```

### Storage Keys

#### For Authenticated Users
- **Keywords**: Stored in `searchingTheFox_cachedJobsMetadata` (cached metadata)
  - Field: `keywords` (string array)
- **Filter Disabled**: Stored in same metadata
  - Field: `filterDisabled` (boolean)

#### For Anonymous Users
- **Keywords**: `searchingTheFox_pageFilter` (comma-separated string)
- **Filter Disabled**: `searchingTheFox_filterDisabled_anonymous`

## State Machine

```
┌─────────────────────┐
│  No Saved Keywords  │
│  (New User)         │
└──────────┬──────────┘
           │
           │ User applies filter
           ▼
┌─────────────────────┐
│  Filters Active     │
│  Keywords Saved     │
│  filterDisabled=F   │
└──────────┬──────────┘
           │
           │ User clicks "Clear"
           ▼
┌─────────────────────┐
│  Filters Cleared    │
│  Keywords Saved     │◄──┐
│  filterDisabled=T   │   │
│  "Use recent" shown │   │
└──────────┬──────────┘   │
           │               │
           │ User clicks   │
           │ "Use recent"  │
           │               │
           └───────────────┘
           (Returns to Filters Active)
```

## Icon Used
- **Icon**: `IconDeviceFloppy` from `@tabler/icons-react`
- **Symbolism**: Represents "saved" data, indicating restoration of previously saved keywords

## Edge Cases Handled

1. **No saved keywords**: Button doesn't show if user has never saved keywords
2. **Browser refresh with disabled filters**: Button shows, keywords remain available
3. **Tab navigation**: Button state persists across tab changes
4. **User sign in/out**: Each user (or anonymous) has their own saved keywords
5. **Empty keywords**: Button doesn't show if keyword list is empty or whitespace-only

## Benefits

✅ **Quick Toggle**: Users can quickly switch between filtered and unfiltered views  
✅ **Non-Destructive**: Clearing filters doesn't lose the keywords  
✅ **Discoverable**: Button appears when relevant (keywords exist but not applied)  
✅ **Persistent**: State survives browser refreshes and tab navigation  
✅ **User-Specific**: Each user has their own filter preferences  

## Testing Checklist

- [ ] Apply filters, clear them, "Use recent keywords" button appears
- [ ] Click "Use recent keywords", filters are re-applied correctly
- [ ] Clear filters, refresh browser, "Use recent keywords" still shows
- [ ] Apply filters using "Use recent keywords", refresh, filters persist
- [ ] Sign out and sign in, keywords are user-specific
- [ ] Anonymous user keywords work independently
- [ ] Button doesn't show for users who never applied filters
- [ ] Mobile and desktop layouts both show the button correctly
- [ ] Button click restores exact keywords that were saved
