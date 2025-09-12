import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getClient } from '../utils/client-manager.js';
import { WebDAVClient } from '../client/webdav.js';
import { prefixToolName } from '../utils/tool-naming.js';
import { SearchEngine } from '../utils/search-engine.js';
import { SearchScope } from '../models/webdav-search.js';

/**
 * Register WebDAV tools with the MCP server
 * @param server MCP server instance
 */
export function registerWebDAVTools(server: McpServer) {
  server.tool(
    prefixToolName('webdav_list_directory'),
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
    prefixToolName('webdav_read_file'),
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
    prefixToolName('webdav_write_file'),
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
    prefixToolName('webdav_create_directory'),
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
    prefixToolName('webdav_delete_resource'),
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

  server.tool(
    prefixToolName('webdav_search_files'),
    'Search for files across Nextcloud using unified search - supports filename, content, and metadata search',
    {
      query: z.string().describe('Search terms (supports multiple words, e.g., "budget report 2024")'),
      searchIn: z.array(z.enum(['filename', 'content', 'metadata']))
        .optional()
        .default(['filename', 'content'])
        .describe('What to search in: filename, content, and/or metadata'),
      fileTypes: z.array(z.string())
        .optional()
        .describe('Filter by file extensions (e.g., ["pdf", "txt", "md", "js"])'),
      basePath: z.string()
        .optional()
        .default('/')
        .describe('Limit search to specific directory (e.g., "/Documents", "/Projects")'),
      limit: z.number()
        .optional()
        .default(50)
        .describe('Maximum number of results to return'),
      includeContent: z.boolean()
        .optional()
        .default(false)
        .describe('Include content preview in results (for text files)'),
      caseSensitive: z.boolean()
        .optional()
        .default(false)
        .describe('Whether search should be case sensitive'),
      sizeRange: z.object({
        min: z.number().optional().describe('Minimum file size in bytes'),
        max: z.number().optional().describe('Maximum file size in bytes')
      }).optional()
        .describe('Filter by file size range'),
      dateRange: z.object({
        from: z.string().optional().describe('Start date (ISO format: YYYY-MM-DD)'),
        to: z.string().optional().describe('End date (ISO format: YYYY-MM-DD)')
      }).optional()
        .describe('Filter by last modified date range'),
      quickSearch: z.boolean()
        .optional()
        .default(true)
        .describe('Use quick search mode (faster, limited depth) for root directory searches'),
      maxDepth: z.number()
        .optional()
        .default(3)
        .describe('Maximum directory depth to search (1-10, default: 3)')
    },
    async (options) => {
      const searchStartTime = Date.now();
      console.log('WebDAV unified search started with options:', options);
      
      try {
        // Add timeout handling for the entire operation
        const SEARCH_TIMEOUT = 20000; // 20 seconds
        
        const searchPromise = (async () => {
          // Parse date ranges if provided
          const searchOptions = {
            ...options,
            searchIn: options.searchIn as SearchScope[],
            dateRange: options.dateRange ? {
              from: options.dateRange.from ? new Date(options.dateRange.from) : undefined,
              to: options.dateRange.to ? new Date(options.dateRange.to) : undefined
            } : undefined
          };

          // Optimize search parameters for root directory searches
          if (options.basePath === '/' || !options.basePath) {
            console.log('Root directory search detected, applying optimizations');
            
            // For root searches, use more aggressive limits
            if (options.quickSearch !== false) {
              searchOptions.limit = Math.min(options.limit || 25, 25);
              console.log(`Quick search enabled, limiting results to ${searchOptions.limit}`);
            }
          }

          // Create search engine instance
          const searchEngine = new SearchEngine();
          
          // Perform the search
          return await searchEngine.search(searchOptions);
        })();
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error('Search operation timed out after 20 seconds. Try using a more specific directory path or enabling quickSearch.'));
          }, SEARCH_TIMEOUT);
        });
        
        const results = await Promise.race([searchPromise, timeoutPromise]);
        
        // Format results for output
        const formattedResults = results.map(result => {
          const baseResult = {
            path: result.file.path,
            name: result.file.name,
            size: result.file.size,
            lastModified: result.file.lastModified.toISOString(),
            mimeType: result.file.mimeType,
            extension: result.file.extension,
            isDirectory: result.file.isDirectory,
            matchType: result.matchType,
            relevanceScore: Math.round(result.relevanceScore * 100) / 100,
            highlights: result.highlights
          };

          // Add content preview if requested and available
          if (options.includeContent && result.contentPreview) {
            return {
              ...baseResult,
              contentPreview: result.contentPreview.substring(0, 500) // Limit preview size
            };
          }

          return baseResult;
        });

        const searchDuration = Date.now() - searchStartTime;
        const searchStats = {
          query: options.query,
          searchScope: options.searchIn,
          totalResults: results.length,
          searchDurationMs: searchDuration,
          searchTime: new Date().toISOString(),
          basePath: options.basePath || '/',
          quickSearchEnabled: options.quickSearch !== false && (options.basePath === '/' || !options.basePath),
          ...(options.fileTypes && { fileTypesFilter: options.fileTypes }),
          ...(options.sizeRange && { sizeRangeFilter: options.sizeRange }),
          ...(options.dateRange && { dateRangeFilter: options.dateRange })
        };

        console.log(`Search completed in ${searchDuration}ms with ${results.length} results`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                searchStats,
                results: formattedResults
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        const searchDuration = Date.now() - searchStartTime;
        console.error(`WebDAV search failed after ${searchDuration}ms:`, error);
        
        let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        let suggestions = [
          'Try using a more specific directory path instead of root "/" ',
          'Enable quickSearch mode for faster results',
          'Reduce the file type filters or search scope',
          'Use a smaller limit parameter'
        ];
        
        // Add specific suggestions based on error type
        if (errorMessage.includes('timeout')) {
          suggestions = [
            'The search timed out. Try searching in a specific directory instead of root.',
            'Use quickSearch: true for faster results with limited depth',
            'Reduce the search scope by specifying fileTypes',
            'Try searching in a subdirectory like "/Documents" instead of "/"'
          ];
        }
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Search failed',
                message: errorMessage,
                searchDurationMs: searchDuration,
                suggestions,
                quickTips: {
                  forRootSearch: 'Use basePath like "/Documents" instead of "/" for faster searches',
                  forLargeResults: 'Add fileTypes filter like ["pdf", "txt"] to narrow results',
                  forTimeout: 'Try quickSearch: true and smaller limit values'
                }
              }, null, 2),
            },
          ],
        };
      }
    }
  );
}