import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { NotesClient } from './client/notes.js';
import { CalendarClient } from './client/calendar.js';
import { ContactsClient } from './client/contacts.js';
import { TablesClient } from './client/tables.js';
import { WebDAVClient } from './client/webdav.js';

// Import tool registration functions
import { registerNotesTools } from './tools/notes.tools.js';
import { registerCalendarTools } from './tools/calendar.tools.js';
import { registerContactsTools } from './tools/contacts.tools.js';
import { registerTablesTools } from './tools/tables.tools.js';
import { registerWebDAVTools } from './tools/webdav.tools.js';

// Type definition for tool registration functions
type ToolRegistrationFn = (server: McpServer) => void;

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
    name: 'Nextcloud MCP Server',
    version: '1.0.0',
  });

  // Initialize clients with config
  initializeClients(config);

  // Register all tool sets
  const toolSets: ToolRegistrationFn[] = [
    registerNotesTools,
    registerCalendarTools,
    registerContactsTools,
    registerTablesTools,
    registerWebDAVTools,
  ];

  // Register all tools
  toolSets.forEach((toolSet) => toolSet(server));

  // Register a simple hello tool for testing
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
              total_tools: 29,
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