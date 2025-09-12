import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../utils/client-manager.js';
import { CalendarClient } from '../client/calendar.js';
import { prefixToolName } from '../utils/tool-naming.js';

/**
 * Register Calendar debugging tools with the MCP server
 * @param server MCP server instance
 */
export function registerCalendarDebugTools(server: McpServer) {
  server.tool(
    prefixToolName('calendar_debug_list_calendars'),
    'Debug: List all calendars with detailed info',
    {},
    async () => {
      const client = getClient(CalendarClient);
      const calendars = await client.listCalendars();
      
      return {
        content: [
          {
            type: 'text',
            text: `Found ${calendars.length} calendars:\n\n${JSON.stringify(calendars, null, 2)}`,
          },
        ],
      };
    }
  );

  server.tool(
    prefixToolName('calendar_debug_verify_calendar'),
    'Debug: Verify if a specific calendar exists and is accessible',
    {
      calendarId: z.string().describe('The ID of the calendar to verify'),
    },
    async ({ calendarId }) => {
      const client = getClient(CalendarClient);
      const calendars = await client.listCalendars();
      const targetCalendar = calendars.find(cal => cal.id === calendarId);
      
      if (targetCalendar) {
        // Try to list events from this calendar to verify access
        try {
          const events = await client.listEvents(calendarId);
          return {
            content: [
              {
                type: 'text',
                text: `✅ Calendar "${calendarId}" exists and is accessible.\n\nCalendar details:\n${JSON.stringify(targetCalendar, null, 2)}\n\nExisting events: ${events.length}`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `⚠️ Calendar "${calendarId}" exists but may not be accessible for events.\n\nCalendar details:\n${JSON.stringify(targetCalendar, null, 2)}\n\nError: ${error}`,
              },
            ],
          };
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Calendar "${calendarId}" not found.\n\nAvailable calendars:\n${calendars.map(cal => `- ${cal.id}: ${cal.displayName}`).join('\n')}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    prefixToolName('calendar_debug_create_test_event'),
    'Debug: Create a test event with proper formatting',
    {
      calendarId: z.string().describe('The ID of the calendar'),
      testType: z.enum(['simple', 'with_timezone']).describe('Type of test event to create'),
    },
    async ({ calendarId, testType }) => {
      const client = getClient(CalendarClient);
      
      let event;
      if (testType === 'simple') {
        event = {
          summary: 'Test Event (Simple)',
          description: 'A simple test event created for debugging',
          dtstart: '20250913T140000Z',  // UTC format
          dtend: '20250913T150000Z',    // UTC format
          location: 'Test Location'
        };
      } else {
        event = {
          summary: 'Test Event (With Timezone)',
          description: 'A test event with timezone for debugging',
          dtstart: '2025-09-13T14:00:00+08:00',  // ISO format
          dtend: '2025-09-13T15:00:00+08:00',    // ISO format
          location: 'Test Location'
        };
      }

      try {
        const result = await client.createEvent(calendarId, event);
        return {
          content: [
            {
              type: 'text',
              text: `✅ Test event created successfully!\n\nResult:\n${JSON.stringify(result, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to create test event.\n\nError: ${error}\n\nEvent data:\n${JSON.stringify(event, null, 2)}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    prefixToolName('calendar_debug_list_events_verbose'),
    'Debug: List events from a calendar with detailed logging',
    {
      calendarId: z.string().describe('The ID of the calendar'),
    },
    async ({ calendarId }) => {
      const client = getClient(CalendarClient);
      
      try {
        const events = await client.listEvents(calendarId);
        return {
          content: [
            {
              type: 'text',
              text: `Found ${events.length} events in calendar "${calendarId}":\n\n${JSON.stringify(events, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to list events from calendar "${calendarId}".\n\nError: ${error}`,
            },
          ],
        };
      }
    }
  );
}