# AI-Generated Meeting Titles

**Feature Status**: ✅ Implemented
**Added**: February 13, 2024

## Overview

The app now automatically generates descriptive titles for each meeting using GPT-4o-mini, providing context at a glance instead of just showing timestamps.

## What Changed

### Before
Meetings were only identifiable by timestamp:
```
Feb 13, 2024 at 3:45 PM    [Ready]
Feb 12, 2024 at 10:23 AM   [Ready]
Feb 11, 2024 at 2:15 PM    [Processing]
```

### After
Meetings have meaningful, AI-generated titles:
```
Product Launch Planning    [Ready]
Budget Review Q1 2024      [Ready]
Team Standup - Sprint 12   [Processing]
```

## Implementation Details

### Database Migration

A new `title` column was added to the `meetings` table:

```sql
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS title TEXT;
```

**Migration file**: `supabase/migrations/add_meeting_titles.sql`

### Backend Changes

Modified the `/process-meeting` endpoint in `backend/main.py`:

1. **Updated GPT Prompt** to include title generation:
```json
{
  "title": "Brief descriptive title for the meeting (max 30 characters)",
  "clean_transcript": "...",
  "summary": "...",
  "key_points": [...],
  "action_items": [...]
}
```

2. **Character Limit Enforcement**: Titles are truncated to 30 characters server-side
3. **Database Update**: Title is saved alongside transcript and summary

### Frontend Changes

**TypeScript Types** (`services/meetingService.ts`):
- Added `title: string | null` to `Meeting` interface
- Added `title: string | null` to `MeetingListItem` interface

**Meetings List UI** (`app/(tabs)/meetings.tsx`):
- Title displayed prominently in bold (16pt) at top of card
- Date and duration shown below as metadata (13pt)
- Fallback to date/time if no title exists (backward compatibility)

**Query Updates**:
```typescript
const { data } = await supabase
  .from('meetings')
  .select('id, created_at, status, title, duration_millis')  // ← Added 'title'
  .eq('user_id', session.user.id)
```

## User Experience

### Visual Layout

```
┌─────────────────────────────────────┐
│ Product Launch Planning    [Ready] │  ← Title (bold, 16pt)
│ Feb 13, 2024 • 15:23               │  ← Date • Duration (13pt)
└─────────────────────────────────────┘
```

### Fallback Behavior

For meetings recorded before this feature was added (or if title generation fails):
- Display falls back to showing the date/time as the primary text
- No empty titles or UI gaps
- Ensures backward compatibility with existing data

## Technical Specifications

### Title Generation

**Model**: GPT-4o-mini (cost-effective, fast inference)
**Max Length**: 30 characters (enforced server-side)
**Input**: Raw meeting transcript
**Temperature**: 0.2 (consistent, focused output)

**Processing Time**: <1 second (generated alongside summary)
**Cost**: ~$0.0001 per title (included in existing GPT analysis call)

### Character Limit Rationale

30 characters was chosen because:
- Fits comfortably on mobile screens (320px+ width)
- Forces concise, scannable titles
- Prevents multi-line wrapping in list view
- Matches industry standards (Twitter handles, SMS headers)

**Examples at 30 chars**:
- ✅ "Product Launch Planning" (24 chars)
- ✅ "Q1 Budget Review Meeting" (26 chars)
- ✅ "Client Onboarding - Acme Co" (29 chars)
- ❌ "Detailed discussion about the new product launch strategy" → truncated to "Detailed discussion about t..."

## Files Modified

### Database
- `supabase/schema.sql` - Added `title TEXT` column with comment
- `supabase/migrations/add_meeting_titles.sql` - Migration script

### Backend
- `backend/main.py` - Updated GPT prompt and database update logic

### Frontend
- `services/meetingService.ts` - Updated TypeScript interfaces
- `app/(tabs)/meetings.tsx` - Updated UI to display titles

### Documentation
- `docs/FEATURES.md` - Added "AI-Generated Meeting Titles" section
- `docs/ARCHITECTURE.md` - Updated backend processing flow
- `README.md` - Added migration note and feature mention
- `docs/MEETING_TITLES.md` - This file

## Migration Guide

### For New Users
The feature works automatically - no action required. Just run the updated `schema.sql`.

### For Existing Users

**Step 1: Update Database Schema**

Run this SQL in Supabase SQL Editor:
```sql
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS title TEXT;
```

Or use the migration file:
```bash
# Navigate to Supabase dashboard → SQL Editor
# Upload: supabase/migrations/add_meeting_titles.sql
```

**Step 2: Update Backend**
```bash
cd backend
git pull  # Get latest code
# Restart backend
uvicorn main:app --reload
```

**Step 3: Update Mobile App**
```bash
git pull  # Get latest code
npm install  # Update any dependencies
npm start  # Restart development server
```

**Step 4: Test**
Record a new meeting and verify:
1. Processing completes successfully
2. Meeting detail shows the title field (even if empty for old meetings)
3. New meetings display AI-generated titles in the list

### Backward Compatibility

✅ Old meetings without titles display date/time as fallback
✅ Schema migration uses `IF NOT EXISTS` (safe to re-run)
✅ TypeScript types use `title: string | null` (nullable)
✅ Backend checks for `meeting_title` existence before saving

No breaking changes - existing functionality remains intact.

## Future Enhancements

Potential improvements for the title feature:

1. **Editable Titles**: Allow users to manually override AI-generated titles
2. **Title Templates**: Custom prompts per meeting type (standup, planning, review)
3. **Emoji Support**: Add contextual emoji to titles ("📊 Budget Review Q1")
4. **Longer Titles**: Support different character limits for tablet vs. phone
5. **Multi-language**: Generate titles in user's language preference
6. **Title History**: Track title edits/changes over time

## Testing Checklist

- [x] Database migration runs without errors
- [x] TypeScript types updated (no compilation errors)
- [x] Backend generates titles for new meetings
- [x] Titles are truncated to 30 characters
- [x] Frontend displays titles in meetings list
- [x] Fallback to date/time for meetings without titles
- [x] Realtime updates include title field
- [x] Documentation updated

## Support

If you encounter issues with meeting titles:

1. **Titles not appearing**: Check backend logs for GPT errors
2. **Titles too long**: Verify backend truncation logic (should be automatic)
3. **Old meetings missing titles**: Expected behavior - only new meetings get titles
4. **Migration errors**: Ensure you have admin access to Supabase SQL Editor

For additional help, see [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md).
