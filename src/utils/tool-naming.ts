/**
 * Helper functions for consistent tool naming
 */

/**
 * Adds the "nextcloud_" prefix to a tool name
 * @param toolName The original tool name
 * @returns The prefixed tool name
 */
export function prefixToolName(toolName: string): string {
  // Don't add prefix if it already exists
  if (toolName.startsWith('nextcloud_')) {
    return toolName;
  }
  return `nextcloud_${toolName}`;
}