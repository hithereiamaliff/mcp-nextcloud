import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../index.js';
import { WebDAVClient } from '../client/webdav.js';

/**
 * Register WebDAV tools with the MCP server
 * @param server MCP server instance
 */
export function registerWebDAVTools(server: McpServer) {
  server.tool(
    'nc_webdav_list_directory',
    'List files and directories in Nextcloud',
    {
      path: z.string().describe('The path to list (e.g., "/" for root)'),
    },
    async ({ path }) => {
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
    async ({ path }) => {
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
    async ({ path, content }) => {
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
    async ({ path }) => {
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
    async ({ path }) => {
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
}