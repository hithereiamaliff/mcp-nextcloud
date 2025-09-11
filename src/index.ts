import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { NotesClient } from './client/notes.js';
import { CalendarClient } from './client/calendar.js';
import { ContactsClient } from './client/contacts.js';
import { TablesClient } from './client/tables.js';
import { WebDAVClient } from './client/webdav.js';

// Define the config schema
export const configSchema = z.object({
  nextcloudHost: z.string()
    .optional()
    .describe('Nextcloud server URL (e.g., https://cloud.example.com)'),
  nextcloudUsername: z.string()
    .optional()
    .describe('Nextcloud username for authentication'),
  nextcloudPassword: z.string()
    .optional()
    .describe('Nextcloud password for authentication'),
});

let notesClient: NotesClient | undefined;
let calendarClient: CalendarClient | undefined;
let contactsClient: ContactsClient | undefined;
let tablesClient: TablesClient | undefined;
let webDAVClient: WebDAVClient | undefined;

function initializeClients(config: z.infer<typeof configSchema>) {
  const {
    NEXTCLOUD_HOST,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD,
  } = process.env;

  // Use config values or fall back to environment variables
  const host = config.nextcloudHost || NEXTCLOUD_HOST;
  const username = config.nextcloudUsername || NEXTCLOUD_USERNAME;
  const password = config.nextcloudPassword || NEXTCLOUD_PASSWORD;

  if (!host || !username || !password) {
    throw new Error('Missing Nextcloud credentials in environment variables or config');
  }

  notesClient = new NotesClient(host, username, password);
  calendarClient = new CalendarClient(host, username, password);
  contactsClient = new ContactsClient(host, username, password);
  tablesClient = new TablesClient(host, username, password);
  webDAVClient = new WebDAVClient(host, username, password);
}

export function getClient<T>(client: new (...args: any[]) => T): T {
  if (client === NotesClient) {
    return notesClient as any;
  }
  if (client === CalendarClient) {
    return calendarClient as any;
  }
  if (client === ContactsClient) {
    return contactsClient as any;
  }
  if (client === TablesClient) {
    return tablesClient as any;
  }
  if (client === WebDAVClient) {
    return webDAVClient as any;
  }
  throw new Error(`Unknown client type: ${client}`);
}

/**
 * Creates a stateless MCP server for Nextcloud
 */
export default function createStatelessServer({
  config,
}: {
  config: z.infer<typeof configSchema>;
}) {
  const server = new McpServer({
    name: 'mcp-nextcloud',
    version: '1.0.0',
  });

  // Initialize clients with config
  initializeClients(config);

  // ===== NOTES TOOLS =====
  server.tool(
    'nc_notes_create_note',
    'Create a new note in Nextcloud Notes',
    {
      title: z.string().describe('The title of the note'),
      content: z.string().describe('The content of the note'),
      category: z.string().describe('The category of the note'),
    },
    async (args) => {
      const { title, content, category } = args;
      const note = await getClient(NotesClient).createNote(title, content, category);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: note.id,
              title: note.title,
              category: note.category,
              etag: note.etag,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_notes_update_note',
    'Update an existing note in Nextcloud Notes',
    {
      note_id: z.number().describe('The ID of the note to update'),
      etag: z.string().describe('The etag of the note for concurrency control'),
      title: z.string().optional().describe('The new title of the note'),
      content: z.string().optional().describe('The new content of the note'),
      category: z.string().optional().describe('The new category of the note'),
    },
    async (args) => {
      const { note_id, etag, title, content, category } = args;
      const note = await getClient(NotesClient).updateNote(note_id, etag, title, content, category);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: note.id,
              title: note.title,
              category: note.category,
              etag: note.etag,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_notes_append_content',
    'Append content to an existing note',
    {
      note_id: z.number().describe('The ID of the note to append to'),
      content: z.string().describe('The content to append'),
    },
    async (args) => {
      const { note_id, content } = args;
      const note = await getClient(NotesClient).getNote(note_id);
      const newContent = `${note.content}\n---\n${content}`;
      const updatedNote = await getClient(NotesClient).updateNote(
        note_id,
        note.etag,
        undefined,
        newContent
      );
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: updatedNote.id,
              title: updatedNote.title,
              category: updatedNote.category,
              etag: updatedNote.etag,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_notes_search_notes',
    'Search for notes in Nextcloud Notes',
    {
      query: z.string().describe('The search query'),
    },
    async (args) => {
      const { query } = args;
      const notes = await getClient(NotesClient).getAllNotes();
      const results = notes
        .filter((note: any) => note.title.includes(query) || note.content.includes(query))
        .map((note: any) => ({
          id: note.id,
          title: note.title,
          category: note.category,
        }));
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results,
              query,
              total_found: results.length,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_notes_delete_note',
    'Delete a note from Nextcloud Notes',
    {
      note_id: z.number().describe('The ID of the note to delete'),
    },
    async (args) => {
      const { note_id } = args;
      await getClient(NotesClient).deleteNote(note_id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Note ${note_id} deleted successfully`,
              deleted_id: note_id,
            }, null, 2),
          },
        ],
      };
    }
  );

  // ===== CALENDAR TOOLS =====
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
    async (args) => {
      const { calendarId, event } = args;
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
    async (args) => {
      const { calendarId, start, end } = args;
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
    async (args) => {
      const { calendarId, eventId } = args;
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
    async (args) => {
      const { calendarId, eventId, event } = args;
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
    async (args) => {
      const { calendarId, eventId } = args;
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

  // ===== CONTACTS TOOLS =====
  server.tool(
    'nc_contacts_list_addressbooks',
    'List all address books',
    {},
    async () => {
      const addressBooks = await getClient(ContactsClient).listAddressBooks();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(addressBooks, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_contacts_create_addressbook',
    'Create a new address book',
    {
      displayName: z.string().describe('Display name for the address book'),
      description: z.string().describe('Description of the address book'),
    },
    async (args) => {
      const { displayName, description } = args;
      const addressBook = await getClient(ContactsClient).createAddressBook(displayName, description);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(addressBook, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_contacts_delete_addressbook',
    'Delete an address book',
    {
      addressBookId: z.string().describe('The ID of the address book to delete'),
    },
    async (args) => {
      const { addressBookId } = args;
      await getClient(ContactsClient).deleteAddressBook(addressBookId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Address book ${addressBookId} deleted successfully`,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_contacts_list_contacts',
    'List contacts from an address book',
    {
      addressBookId: z.string().describe('The ID of the address book'),
    },
    async (args) => {
      const { addressBookId } = args;
      const contacts = await getClient(ContactsClient).listContacts(addressBookId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(contacts, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_contacts_create_contact',
    'Create a new contact',
    {
      addressBookId: z.string().describe('The ID of the address book'),
      contact: z.object({
        fn: z.string().optional().describe('Full name'),
        email: z.array(z.string()).optional().describe('Array of email addresses'),
        tel: z.array(z.string()).optional().describe('Array of phone numbers'),
        adr: z.array(z.string()).optional().describe('Array of addresses'),
        org: z.array(z.string()).optional().describe('Array of organizations'),
        note: z.string().optional().describe('Note'),
      }).describe('Contact information'),
    },
    async (args) => {
      const { addressBookId, contact } = args;
      const result = await getClient(ContactsClient).createContact(addressBookId, contact);
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
    'nc_contacts_delete_contact',
    'Delete a contact',
    {
      addressBookId: z.string().describe('The ID of the address book'),
      contactId: z.string().describe('The ID of the contact to delete'),
    },
    async (args) => {
      const { addressBookId, contactId } = args;
      await getClient(ContactsClient).deleteContact(addressBookId, contactId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Contact ${contactId} deleted successfully from address book ${addressBookId}`,
            }, null, 2),
          },
        ],
      };
    }
  );

  // ===== TABLES TOOLS =====
  server.tool(
    'nc_tables_list_tables',
    'List all tables in Nextcloud Tables',
    {},
    async () => {
      const tables = await getClient(TablesClient).listTables();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(tables, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_tables_get_schema',
    'Get schema of a specific table',
    {
      tableId: z.string().describe('The ID of the table'),
    },
    async (args) => {
      const { tableId } = args;
      const table = await getClient(TablesClient).getTable(tableId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(table, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_tables_read_table',
    'Read data from a table',
    {
      tableId: z.string().describe('The ID of the table'),
    },
    async (args) => {
      const { tableId } = args;
      const rows = await getClient(TablesClient).readTable(tableId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_tables_insert_row',
    'Insert a new row into a table',
    {
      tableId: z.string().describe('The ID of the table'),
      row: z.record(z.any()).describe('Row data as key-value pairs'),
    },
    async (args) => {
      const { tableId, row } = args;
      const result = await getClient(TablesClient).insertRow(tableId, row);
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
    'nc_tables_update_row',
    'Update an existing row in a table',
    {
      tableId: z.string().describe('The ID of the table'),
      rowId: z.string().describe('The ID of the row'),
      row: z.record(z.any()).describe('Updated row data as key-value pairs'),
    },
    async (args) => {
      const { tableId, rowId, row } = args;
      const result = await getClient(TablesClient).updateRow(tableId, rowId, row);
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
    'nc_tables_delete_row',
    'Delete a row from a table',
    {
      tableId: z.string().describe('The ID of the table'),
      rowId: z.string().describe('The ID of the row to delete'),
    },
    async (args) => {
      const { tableId, rowId } = args;
      await getClient(TablesClient).deleteRow(tableId, rowId);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Row ${rowId} deleted successfully from table ${tableId}`,
            }, null, 2),
          },
        ],
      };
    }
  );

  // ===== WEBDAV TOOLS =====
  server.tool(
    'nc_webdav_list_directory',
    'List files and directories in Nextcloud',
    {
      path: z.string().describe('The path to list (e.g., "/" for root)'),
    },
    async (args) => {
      const { path } = args;
      const contents = await getClient(WebDAVClient).listDirectory(path);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(contents, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_webdav_read_file',
    'Read content of a file from Nextcloud',
    {
      path: z.string().describe('The path to the file to read'),
    },
    async (args) => {
      const { path } = args;
      const content = await getClient(WebDAVClient).readFile(path);
      return {
        content: [
          {
            type: 'text',
            text: content,
          },
        ],
      };
    }
  );

  server.tool(
    'nc_webdav_write_file',
    'Write content to a file in Nextcloud',
    {
      path: z.string().describe('The path to the file to write'),
      content: z.string().describe('The content to write to the file'),
    },
    async (args) => {
      const { path, content } = args;
      await getClient(WebDAVClient).writeFile(path, content);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `File written successfully to ${path}`,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_webdav_create_directory',
    'Create a new directory in Nextcloud',
    {
      path: z.string().describe('The path of the directory to create'),
    },
    async (args) => {
      const { path } = args;
      await getClient(WebDAVClient).createDirectory(path);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Directory created successfully at ${path}`,
            }, null, 2),
          },
        ],
      };
    }
  );

  server.tool(
    'nc_webdav_delete_resource',
    'Delete a file or directory from Nextcloud',
    {
      path: z.string().describe('The path to the file or directory to delete'),
    },
    async (args) => {
      const { path } = args;
      await getClient(WebDAVClient).deleteResource(path);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status_code: 200,
              message: `Resource deleted successfully at ${path}`,
            }, null, 2),
          },
        ],
      };
    }
  );

  // ===== TEST TOOL =====
  server.tool(
    'hello',
    'A simple test tool to verify that the MCP server is working correctly',
    {},
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Hello from Nextcloud MCP!',
              timestamp: new Date().toISOString(),
              available_tools: [
                'Notes: nc_notes_create_note, nc_notes_update_note, nc_notes_append_content, nc_notes_search_notes, nc_notes_delete_note',
                'Calendar: nc_calendar_list_calendars, nc_calendar_create_event, nc_calendar_list_events, nc_calendar_get_event, nc_calendar_update_event, nc_calendar_delete_event',
                'Contacts: nc_contacts_list_addressbooks, nc_contacts_create_addressbook, nc_contacts_delete_addressbook, nc_contacts_list_contacts, nc_contacts_create_contact, nc_contacts_delete_contact',
                'Tables: nc_tables_list_tables, nc_tables_get_schema, nc_tables_read_table, nc_tables_insert_row, nc_tables_update_row, nc_tables_delete_row',
                'WebDAV: nc_webdav_list_directory, nc_webdav_read_file, nc_webdav_write_file, nc_webdav_create_directory, nc_webdav_delete_resource'
              ],
              total_tools: 23,
            }, null, 2),
          },
        ],
      };
    }
  );

  return server.server;
}

// If this file is run directly, log a message
console.log('Nextcloud MCP module loaded');