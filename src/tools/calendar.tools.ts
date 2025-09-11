import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../index.js';
import { CalendarClient } from '../client/calendar.js';

/**
 * Register Calendar tools with the MCP server
 * @param server MCP server instance
 */
export function registerCalendarTools(server: McpServer) {
  server.tool(
    'nc_calendar_list_calendars',
    'List all calendars in Nextcloud',
    {},
    async () => {
      const calendars = await getClient(CalendarClient).listCalendars();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(calendars, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_calendar_create_event',
    'Create a new calendar event',
    {
      calendarId: z.string().describe('The ID of the calendar'),
      event: z.object({
        summary: z.string().optional().describe('Event title/summary'),
        description: z.string().optional().describe('Event description'),
        dtstart: z.string().optional().describe('Start date/time (ISO format)'),
        dtend: z.string().optional().describe('End date/time (ISO format)'),
        location: z.string().optional().describe('Event location'),
      }).describe('Event data'),
    },
    async ({ calendarId, event }) => {
      const result = await getClient(CalendarClient).createEvent(calendarId, event);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_calendar_list_events',
    'List events from a calendar',
    {
      calendarId: z.string().describe('The ID of the calendar'),
      start: z.string().optional().describe('Start date filter (ISO format)'),
      end: z.string().optional().describe('End date filter (ISO format)'),
    },
    async ({ calendarId, start, end }) => {
      const events = await getClient(CalendarClient).listEvents(calendarId, start, end);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(events, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_calendar_get_event',
    'Get details of a specific event',
    {
      calendarId: z.string().describe('The ID of the calendar'),
      eventId: z.string().describe('The ID of the event'),
    },
    async ({ calendarId, eventId }) => {
      const event = await getClient(CalendarClient).getEvent(calendarId, eventId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(event, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_calendar_update_event',
    'Update an existing event',
    {
      calendarId: z.string().describe('The ID of the calendar'),
      eventId: z.string().describe('The ID of the event'),
      event: z.object({
        summary: z.string().optional().describe('Event title/summary'),
        description: z.string().optional().describe('Event description'),
        dtstart: z.string().optional().describe('Start date/time (ISO format)'),
        dtend: z.string().optional().describe('End date/time (ISO format)'),
        location: z.string().optional().describe('Event location'),
      }).describe('Updated event data'),
    },
    async ({ calendarId, eventId, event }) => {
      const result = await getClient(CalendarClient).updateEvent(calendarId, eventId, event);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_calendar_delete_event',
    'Delete an event from calendar',
    {
      calendarId: z.string().describe('The ID of the calendar'),
      eventId: z.string().describe('The ID of the event'),
    },
    async ({ calendarId, eventId }) => {
      await getClient(CalendarClient).deleteEvent(calendarId, eventId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Event ${eventId} deleted successfully from calendar ${calendarId}`,
            }, null, 2),
          },
        ],
      };
    }
  );
}