import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../index.js';
import { TablesClient } from '../client/tables.js';

/**
 * Register Tables tools with the MCP server
 * @param server MCP server instance
 */
export function registerTablesTools(server: McpServer) {
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
    async ({ tableId }) => {
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
    async ({ tableId }) => {
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
    async ({ tableId, row }) => {
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
    async ({ tableId, rowId, row }) => {
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
    async ({ tableId, rowId }) => {
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
}