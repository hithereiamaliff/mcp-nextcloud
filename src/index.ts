import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { setCredentials } from './utils/client-manager.js';

// Import tool registration functions
import { registerNotesTools } from './tools/notes.tools.js';
import { registerCalendarTools } from './tools/calendar.tools.js';
import { registerContactsTools } from './tools/contacts.tools.js';
import { registerTablesTools } from './tools/tables.tools.js';
import { registerWebDAVTools } from './tools/webdav.tools.js';
import { prefixToolName } from './utils/tool-naming.js';

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

  // Set credentials for lazy initialization (don't initialize clients yet)
  const {
    NEXTCLOUD_HOST,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD,
  } = process.env;

  // Use config values or fall back to environment variables
  const host = config.nextcloudHost || NEXTCLOUD_HOST;
  const username = config.nextcloudUsername || NEXTCLOUD_USERNAME;
  const password = config.nextcloudPassword || NEXTCLOUD_PASSWORD;

  // Only set credentials if they exist, don't throw error during server initialization
  if (host && username && password) {
    setCredentials(host, username, password);
  }

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
    prefixToolName('hello'),
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
                'Notes: nextcloud_notes_create_note, nextcloud_notes_update_note, nextcloud_notes_append_content, nextcloud_notes_search_notes, nextcloud_notes_delete_note',
                'Calendar: nextcloud_calendar_list_calendars, nextcloud_calendar_create_event, nextcloud_calendar_list_events, nextcloud_calendar_get_event, nextcloud_calendar_update_event, nextcloud_calendar_delete_event',
                'Contacts: nextcloud_contacts_list_addressbooks, nextcloud_contacts_create_addressbook, nextcloud_contacts_delete_addressbook, nextcloud_contacts_list_contacts, nextcloud_contacts_create_contact, nextcloud_contacts_delete_contact',
                'Tables: nextcloud_tables_list_tables, nextcloud_tables_get_schema, nextcloud_tables_read_table, nextcloud_tables_insert_row, nextcloud_tables_update_row, nextcloud_tables_delete_row',
                'WebDAV: nextcloud_webdav_list_directory, nextcloud_webdav_read_file, nextcloud_webdav_write_file, nextcloud_webdav_create_directory, nextcloud_webdav_delete_resource'
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