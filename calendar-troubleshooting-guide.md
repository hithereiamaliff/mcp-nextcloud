# Nextcloud Calendar Event Creation Troubleshooting Guide

## Issues Identified

### 1. **Date Format Problem** (Primary Issue)
**Problem**: The events were created with ISO 8601 format dates (`2025-09-18T20:00:00+08:00`) but iCalendar format requires specific datetime formatting.

**Root Cause**: The `createICalendar` method was not converting ISO 8601 datetime to proper iCalendar format (`YYYYMMDDTHHMMSSZ`).

**Fix Applied**: 
- Added `convertToICalDateTime()` method that properly converts ISO 8601 to UTC iCalendar format
- Example: `2025-09-18T20:00:00+08:00` → `20250918T120000Z` (converted to UTC)

### 2. **Text Escaping Issue**
**Problem**: Special characters in event summaries and descriptions could break iCalendar format.

**Fix Applied**: Added `escapeICalProperty()` method to properly escape:
- Backslashes (`\` → `\\`)
- Semicolons (`;` → `\;`) 
- Commas (`,` → `\,`)
- Newlines (`\n` → `\\n`)

### 3. **Calendar Validation Missing**
**Problem**: No verification that the target calendar exists before creating events.

**Fix Applied**: Added debug tools to verify calendar existence.

## Debug Tools Added

I've added several diagnostic tools to help troubleshoot calendar issues:

1. **`nextcloud_calendar_debug_list_calendars`** - List all calendars with detailed info
2. **`nextcloud_calendar_debug_verify_calendar`** - Check if specific calendar exists and is accessible
3. **`nextcloud_calendar_debug_create_test_event`** - Create test events with different formats
4. **`nextcloud_calendar_debug_list_events_verbose`** - List events with detailed logging

## How to Test the Fix

### Step 1: Verify Calendar Exists
Use the debug tool to check if your `priority-events` calendar exists:
```
nextcloud_calendar_debug_verify_calendar
calendarId: "priority-events"
```

### Step 2: Test Event Creation
Try creating a simple test event:
```
nextcloud_calendar_debug_create_test_event
calendarId: "priority-events"
testType: "with_timezone"
```

### Step 3: Verify Events Are Created
Check if events appear in your calendar:
```
nextcloud_calendar_debug_list_events_verbose
calendarId: "priority-events"
```

## Why Events Weren't Appearing

The main reason your events weren't appearing despite successful API responses was the **incorrect datetime format**. 

Your original events used:
- `dtstart: "2025-09-18T20:00:00+08:00"`
- `dtend: "2025-09-18T22:30:00+08:00"`

But Nextcloud/CalDAV expects iCalendar format:
- `DTSTART:20250918T120000Z` (converted to UTC)
- `DTEND:20250918T143000Z` (converted to UTC)

The server accepted the malformed iCalendar data but couldn't properly parse/display the events because of the invalid datetime format.

## Next Steps

1. **Test the fix**: Try creating new events with the updated code
2. **Clean up**: You may need to delete the malformed events using the calendar_delete_event tool
3. **Verify**: Check that new events appear correctly in your Nextcloud calendar interface

## Prevention

- Always use the debug tools first to verify calendar existence
- The new code automatically handles ISO 8601 to iCalendar conversion
- Proper escaping prevents text formatting issues