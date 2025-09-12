#!/usr/bin/env node
import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import createStatelessServer, { configSchema } from './index.js';

async function main() {
  // Get credentials from environment variables
  const {
    NEXTCLOUD_HOST,
    NEXTCLOUD_USERNAME,
    NEXTCLOUD_PASSWORD,
  } = process.env;

  // Validate required environment variables
  if (!NEXTCLOUD_HOST || !NEXTCLOUD_USERNAME || !NEXTCLOUD_PASSWORD) {
    console.error('ERROR: Missing required environment variables:');
    console.error('- NEXTCLOUD_HOST: Nextcloud server URL (e.g., https://cloud.example.com)');
    console.error('- NEXTCLOUD_USERNAME: Nextcloud username');
    console.error('- NEXTCLOUD_PASSWORD: Nextcloud password (preferably an app password)');
    console.error('\nCreate a .env file or set these environment variables before running the server.');
    process.exit(1);
  }

  try {
    // Parse and validate config
    const config = configSchema.parse({
      nextcloudHost: NEXTCLOUD_HOST,
      nextcloudUsername: NEXTCLOUD_USERNAME,
      nextcloudPassword: NEXTCLOUD_PASSWORD,
    });

    // Create the server
    const server = createStatelessServer({ config });

    // Create stdio transport for MCP communication
    const transport = new StdioServerTransport();
    
    // Connect server to transport
    await server.connect(transport);

    // Log successful startup
    console.error('Nextcloud MCP Server started successfully');
    console.error(`Connected to: ${NEXTCLOUD_HOST}`);
    console.error(`Username: ${NEXTCLOUD_USERNAME}`);
    console.error('Listening for MCP requests...');

  } catch (error) {
    console.error('Failed to start Nextcloud MCP Server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('\nShutting down Nextcloud MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('\nShutting down Nextcloud MCP Server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});