/**
 * Nextcloud MCP Server - Streamable HTTP Transport
 *
 * This file provides an HTTP server for self-hosting the MCP server on a VPS.
 * It uses the Streamable HTTP transport for MCP communication.
 *
 * Two authentication modes:
 * - Key Service Mode (KEY_SERVICE_URL + KEY_SERVICE_TOKEN): user provides api_key=usr_...
 *   which is resolved via the MCP Key Service to get Nextcloud credentials.
 * - Self-Hosted Mode (MCP_API_KEY): user provides X-API-Key header plus
 *   X-Nextcloud-* headers for credentials.
 *
 * Usage:
 *   npm run build
 *   MCP_API_KEY=your-secret node dist/http-server.js
 */

import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { type ClientSet, createClientSet, runWithClients } from './utils/client-manager.js';
import { isKeyServiceEnabled, resolveKeyCredentials } from './utils/key-service.js';

// Import tool registration functions
import { registerNotesTools } from './tools/notes.tools.js';
import { registerCalendarTools } from './tools/calendar.tools.js';
import { registerCalendarDebugTools } from './tools/calendar-debug.tools.js';
import { registerContactsTools } from './tools/contacts.tools.js';
import { registerTablesTools } from './tools/tables.tools.js';
import { registerWebDAVTools } from './tools/webdav.tools.js';
import { prefixToolName } from './utils/tool-naming.js';

// Type definition for tool registration functions
type ToolRegistrationFn = (server: McpServer) => void;

// Configuration
const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const ANALYTICS_FILE = process.env.ANALYTICS_FILE || '/app/data/nextcloud-mcp-analytics.json';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ENABLE_MCP_DIAGNOSTICS = /^(1|true|yes|on)$/i.test(process.env.ENABLE_MCP_DIAGNOSTICS || '');
const ENABLE_SMITHERY_ENDPOINT = /^(1|true|yes|on)$/i.test(process.env.ENABLE_SMITHERY_ENDPOINT || '');
const MCP_TRACE_HTTP = ENABLE_MCP_DIAGNOSTICS || /^(1|true|yes|on)$/i.test(process.env.MCP_TRACE_HTTP || '');

// API key for protecting endpoints (used in self-hosted mode and for analytics)
const MCP_API_KEY = process.env.MCP_API_KEY;

if (isKeyServiceEnabled()) {
  console.log('Key Service mode enabled. User keys will be resolved via:', process.env.KEY_SERVICE_URL);
  if (!MCP_API_KEY) {
    console.warn('WARNING: MCP_API_KEY is not set.');
    console.warn('   /mcp will work via the key service, but /analytics will reject all requests.');
  }
} else if (!MCP_API_KEY) {
  console.warn('WARNING: MCP_API_KEY is not set and KEY_SERVICE_URL is not configured.');
  console.warn('   The /mcp endpoint will reject all requests.');
}

// CORS configuration
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['https://smithery.ai', 'https://claude.ai'];

// Hash an IP address for analytics (privacy-preserving)
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 12);
}

function maskSecret(value: string | undefined | null, visiblePrefix = 10, visibleSuffix = 4): string {
  if (!value) {
    return 'missing';
  }

  if (value.length <= visiblePrefix + visibleSuffix) {
    return `${value.substring(0, Math.max(1, value.length - 2))}..`;
  }

  return `${value.substring(0, visiblePrefix)}...${value.substring(value.length - visibleSuffix)}`;
}

function sanitizeUrlForLogs(url: string): string {
  let sanitized = url.replace(
    /\/mcp\/(usr_[A-Za-z0-9]+)/g,
    (_match, apiKey: string) => `/mcp/${maskSecret(apiKey)}`
  );

  sanitized = sanitized.replace(
    /([?&]api_key=)(usr_[^&]+)/g,
    (_match, prefix: string, apiKey: string) => `${prefix}${maskSecret(apiKey)}`
  );

  return sanitized;
}

function shouldTraceHttpRequest(req: Request): boolean {
  return req.path.startsWith('/mcp')
    || req.path.startsWith('/smithery/')
    || req.path.startsWith('/.well-known/')
    || req.path.startsWith('/mcp-debug/');
}

function selectRequestHeadersForLog(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  const entries: Array<[string, string | undefined]> = [
    ['origin', req.get('origin') || undefined],
    ['user-agent', req.get('user-agent') || undefined],
    ['accept', req.get('accept') || undefined],
    ['content-type', req.get('content-type') || undefined],
    ['content-length', req.get('content-length') || undefined],
    ['mcp-protocol-version', req.get('mcp-protocol-version') || undefined],
    ['mcp-session-id', req.get('mcp-session-id') ? 'present' : undefined],
    ['authorization', req.get('authorization') ? 'present' : undefined],
    ['x-api-key', req.get('x-api-key') ? 'present' : undefined],
  ];

  for (const [key, value] of entries) {
    if (value) {
      headers[key] = value;
    }
  }

  return headers;
}

function selectResponseHeadersForLog(res: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  const entries: Array<[string, string | string[] | number | undefined]> = [
    ['content-type', res.getHeader('content-type') as string | undefined],
    ['content-length', res.getHeader('content-length') as string | number | undefined],
    ['cache-control', res.getHeader('cache-control') as string | undefined],
    ['www-authenticate', res.getHeader('www-authenticate') as string | undefined],
    ['mcp-session-id', res.getHeader('mcp-session-id') ? 'present' : undefined],
    ['location', res.getHeader('location') as string | undefined],
    ['allow', res.getHeader('allow') as string | undefined],
    ['access-control-allow-origin', res.getHeader('access-control-allow-origin') as string | undefined],
  ];

  for (const [key, value] of entries) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      headers[key] = value.join(', ');
    } else {
      headers[key] = String(value);
    }
  }

  return headers;
}

function logAuthOutcome(
  source: 'path' | 'query' | 'self-hosted' | 'smithery',
  outcome: string,
  details?: Record<string, string | number | boolean>
): void {
  const payload = details ? ` ${JSON.stringify(details)}` : '';
  console.log(`[${new Date().toISOString()}] MCP auth [${source}] ${outcome}${payload}`);
}

// Analytics tracking
interface Analytics {
  serverStartTime: string;
  totalRequests: number;
  totalToolCalls: number;
  requestsByMethod: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  toolCalls: Record<string, number>;
  recentToolCalls: Array<{ tool: string; timestamp: string }>;
  clientsByIp: Record<string, number>;
  clientsByUserAgent: Record<string, number>;
  hourlyRequests: Record<string, number>;
}

const defaultAnalytics: Analytics = {
  serverStartTime: new Date().toISOString(),
  totalRequests: 0,
  totalToolCalls: 0,
  requestsByMethod: {},
  requestsByEndpoint: {},
  toolCalls: {},
  recentToolCalls: [],
  clientsByIp: {},
  clientsByUserAgent: {},
  hourlyRequests: {},
};

// Load analytics from file or use defaults
function loadAnalytics(): Analytics {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = fs.readFileSync(ANALYTICS_FILE, 'utf-8');
      const loaded = JSON.parse(data) as Analytics;
      console.log(`Loaded analytics from ${ANALYTICS_FILE}`);
      return loaded;
    }
  } catch (error) {
    console.warn('Could not load analytics file, starting fresh:', error);
  }
  return { ...defaultAnalytics };
}

// Save analytics to file
function saveAnalytics(): void {
  try {
    const dir = path.dirname(ANALYTICS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
  } catch (error) {
    console.warn('Could not save analytics file:', error);
  }
}

// Auto-save analytics every 5 minutes
setInterval(saveAnalytics, 5 * 60 * 1000);

// Save on process exit
process.on('SIGTERM', () => {
  console.log('Saving analytics before shutdown...');
  saveAnalytics();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Saving analytics before shutdown...');
  saveAnalytics();
  process.exit(0);
});

const analytics: Analytics = loadAnalytics();

function getUptime(): string {
  const start = new Date(analytics.serverStartTime).getTime();
  const now = Date.now();
  const diff = now - start;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

function trackRequest(req: Request, endpoint: string): void {
  analytics.totalRequests++;
  analytics.requestsByMethod[req.method] = (analytics.requestsByMethod[req.method] || 0) + 1;
  analytics.requestsByEndpoint[endpoint] = (analytics.requestsByEndpoint[endpoint] || 0) + 1;

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || 'unknown';
  const hashedIp = hashIp(clientIp);
  analytics.clientsByIp[hashedIp] = (analytics.clientsByIp[hashedIp] || 0) + 1;

  const userAgent = req.headers['user-agent'] || 'unknown';
  const shortAgent = userAgent.split('/')[0] || userAgent.substring(0, 30);
  analytics.clientsByUserAgent[shortAgent] = (analytics.clientsByUserAgent[shortAgent] || 0) + 1;

  const hourKey = new Date().toISOString().substring(0, 13) + ':00';
  analytics.hourlyRequests[hourKey] = (analytics.hourlyRequests[hourKey] || 0) + 1;
}

function trackToolCall(toolName: string): void {
  analytics.totalToolCalls++;
  analytics.toolCalls[toolName] = (analytics.toolCalls[toolName] || 0) + 1;
  analytics.recentToolCalls.unshift({
    tool: toolName,
    timestamp: new Date().toISOString(),
  });
  if (analytics.recentToolCalls.length > 100) {
    analytics.recentToolCalls.pop();
  }
}

// --- Authentication helpers ---

// Validate API key from request headers or query param
function validateApiKey(req: Request): boolean {
  if (!MCP_API_KEY) return false;
  const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string);
  return apiKey === MCP_API_KEY;
}

// API key middleware for protected endpoints
function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (!validateApiKey(req)) {
    res.status(403).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Forbidden: Invalid or missing API key. Provide a valid X-API-Key header.',
      },
      id: null,
    });
    return;
  }
  next();
}

// Extract Nextcloud credentials from request headers only.
// Used in self-hosted mode where each client provides their own credentials.
// No env var or query param fallback — prevents credential leaking between users.
function extractCredentials(req: Request): { host: string; username: string; password: string } | null {
  const host = req.headers['x-nextcloud-host'] as string || '';
  const username = req.headers['x-nextcloud-username'] as string || '';
  const password = req.headers['x-nextcloud-password'] as string || '';

  if (!host || !username || !password) {
    return null;
  }

  return { host, username, password };
}

// Register all tool sets (skip debug tools in production)
const toolSets: ToolRegistrationFn[] = [
  registerNotesTools,
  registerCalendarTools,
  registerContactsTools,
  registerTablesTools,
  registerWebDAVTools,
];

if (!IS_PRODUCTION) {
  toolSets.push(registerCalendarDebugTools);
}

function createScopedRegistrationServer(server: McpServer, clientSet: ClientSet): McpServer {
  const registrationServer = Object.create(server) as McpServer;
  const originalTool = server.tool.bind(server);

  registrationServer.tool = ((name: string, description: string, paramsSchema: any, handler: any) => {
    return originalTool(name, description, paramsSchema, async (args: unknown, extra: unknown) => {
      return runWithClients(clientSet, () => Promise.resolve(handler(args, extra)));
    });
  }) as typeof server.tool;

  return registrationServer;
}

function createHttpMcpServer(clientSet: ClientSet): McpServer {
  const server = new McpServer({
    name: 'Nextcloud MCP Server',
    version: '1.0.0',
  });

  const registrationServer = createScopedRegistrationServer(server, clientSet);

  toolSets.forEach((toolSet) => toolSet(registrationServer));

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
              transport: 'streamable-http',
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

  return server;
}

function createDiagnosticMcpServer(): McpServer {
  const server = new McpServer({
    name: 'Nextcloud MCP Diagnostics',
    version: '1.0.0',
  });

  server.tool(
    prefixToolName('diagnostics_ping'),
    'Minimal unauthenticated MCP tool for transport and connector troubleshooting',
    {},
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Nextcloud MCP diagnostics endpoint is reachable.',
              timestamp: new Date().toISOString(),
              authentication: 'none',
              diagnosticsEnabled: true,
            }, null, 2),
          },
        ],
      };
    }
  );

  return server;
}

// Create Express app
const app = express();

// Middleware - restricted CORS
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (non-browser clients like curl, MCP clients)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Accept',
    'Authorization',
    'Mcp-Session-Id',
    'MCP-Protocol-Version',
    'Last-Event-ID',
    'X-API-Key',
    'X-Nextcloud-Host',
    'X-Nextcloud-Username',
    'X-Nextcloud-Password',
  ],
  exposedHeaders: ['Mcp-Session-Id'],
}));

// Request logging with sanitized URLs and finish-time response metadata.
app.use((req: Request, res: Response, next) => {
  const startedAt = Date.now();
  const sanitizedUrl = sanitizeUrlForLogs(req.originalUrl);
  const shouldTrace = shouldTraceHttpRequest(req);

  console.log(`[${new Date().toISOString()}] ${req.method} ${sanitizedUrl}`);

  if (MCP_TRACE_HTTP && shouldTrace) {
    console.log(`[${new Date().toISOString()}] Request headers ${JSON.stringify(selectRequestHeadersForLog(req))}`);
  }

  res.on('finish', () => {
    if (!shouldTrace) {
      return;
    }

    console.log(
      `[${new Date().toISOString()}] ${req.method} ${sanitizedUrl} -> ${res.statusCode} (${Date.now() - startedAt}ms)`
    );

    if (MCP_TRACE_HTTP || res.statusCode >= 400) {
      console.log(`[${new Date().toISOString()}] Response headers ${JSON.stringify(selectResponseHeadersForLog(res))}`);
    }
  });

  next();
});

app.use(express.json());

app.use((error: Error & { status?: number; type?: string }, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const sanitizedUrl = sanitizeUrlForLogs(req.originalUrl || req.url);

  if (error.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    console.warn(`[${new Date().toISOString()}] Invalid JSON body for ${req.method} ${sanitizedUrl}: ${error.message}`);
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: 'Invalid JSON request body.',
      },
      id: null,
    });
    return;
  }

  console.error(`[${new Date().toISOString()}] HTTP middleware error for ${req.method} ${sanitizedUrl}:`, error);
  res.status(error.status || 500).json({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: 'HTTP middleware error.',
    },
    id: null,
  });
});

// Health check endpoint (no auth required - used by Docker healthcheck)
app.get('/health', (req: Request, res: Response) => {
  trackRequest(req, '/health');
  res.json({
    status: 'healthy',
    server: 'Nextcloud MCP',
    version: '1.0.0',
    transport: 'streamable-http',
    timestamp: new Date().toISOString(),
  });
});

// Analytics endpoint - protected by API key
app.get('/analytics', requireApiKey, (req: Request, res: Response) => {
  trackRequest(req, '/analytics');

  const sortedTools = Object.entries(analytics.toolCalls)
    .sort(([, a], [, b]) => b - a)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

  const sortedClients = Object.entries(analytics.clientsByIp)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

  const last24Hours = Object.entries(analytics.hourlyRequests)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 24)
    .reverse()
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

  res.json({
    server: 'Nextcloud MCP',
    uptime: getUptime(),
    serverStartTime: analytics.serverStartTime,
    summary: {
      totalRequests: analytics.totalRequests,
      totalToolCalls: analytics.totalToolCalls,
      uniqueClients: Object.keys(analytics.clientsByIp).length,
    },
    breakdown: {
      byMethod: analytics.requestsByMethod,
      byEndpoint: analytics.requestsByEndpoint,
      byTool: sortedTools,
    },
    clients: {
      byHashedIp: sortedClients,
      byUserAgent: analytics.clientsByUserAgent,
    },
    hourlyRequests: last24Hours,
    recentToolCalls: analytics.recentToolCalls.slice(0, 20),
  });
});

// Analytics dashboard shell. The HTML is public, but data loading still requires an API key.
app.get('/analytics/dashboard', (req: Request, res: Response) => {
  trackRequest(req, '/analytics/dashboard');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nextcloud MCP - Analytics Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0082c9 0%, #00678c 100%);
      min-height: 100vh;
      color: #e4e4e7;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background: rgba(255,255,255,0.1);
      border-radius: 16px;
      backdrop-filter: blur(10px);
    }
    header h1 {
      font-size: 2rem;
      background: linear-gradient(90deg, #fff, #a0d8ef);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    header p { color: rgba(255,255,255,0.8); }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      border: 1px solid rgba(255,255,255,0.2);
      transition: transform 0.2s;
    }
    .stat-card:hover { transform: translateY(-4px); }
    .stat-card h3 { font-size: 2.5rem; margin-bottom: 8px; color: #fff; }
    .stat-card p { color: rgba(255,255,255,0.7); font-size: 0.9rem; }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .chart-card {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .chart-card h2 {
      font-size: 1.2rem;
      margin-bottom: 16px;
      color: #fff;
    }
    .auth-card {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(255,255,255,0.2);
      margin-bottom: 20px;
    }
    .auth-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 12px;
    }
    .auth-input {
      flex: 1 1 320px;
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 10px;
      background: rgba(0,0,0,0.2);
      color: #fff;
      padding: 12px 14px;
    }
    .auth-input::placeholder { color: rgba(255,255,255,0.5); }
    .auth-button {
      border: 0;
      border-radius: 10px;
      padding: 12px 16px;
      font-weight: 600;
      cursor: pointer;
    }
    .auth-button.primary {
      background: #fff;
      color: #00678c;
    }
    .auth-button.secondary {
      background: rgba(255,255,255,0.14);
      color: #fff;
    }
    .auth-status {
      margin-top: 10px;
      color: rgba(255,255,255,0.72);
      font-size: 0.9rem;
    }
    .recent-calls {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 20px;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .recent-calls h2 { margin-bottom: 16px; color: #fff; }
    .call-item {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      margin-bottom: 8px;
    }
    .call-tool { font-weight: 600; color: #a0d8ef; }
    .call-time { color: rgba(255,255,255,0.6); font-size: 0.85rem; }
    .refresh-note {
      text-align: center;
      margin-top: 20px;
      color: rgba(255,255,255,0.5);
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Nextcloud MCP Analytics</h1>
      <p>Usage statistics for your Nextcloud MCP server</p>
    </header>

    <div class="auth-card">
      <h2>API Key</h2>
      <p>Enter your MCP API key to load analytics. The key stays in this tab's session storage and is never added to the URL.</p>
      <div class="auth-row">
        <input id="api-key-input" class="auth-input" type="password" placeholder="Paste MCP_API_KEY" autocomplete="off" />
        <button id="load-dashboard" class="auth-button primary" type="button">Load Dashboard</button>
        <button id="clear-api-key" class="auth-button secondary" type="button">Clear Key</button>
      </div>
      <div id="auth-status" class="auth-status"></div>
    </div>

    <div class="stats-grid" id="stats-grid"></div>

    <div class="charts-grid">
      <div class="chart-card">
        <h2>Tool Usage Distribution</h2>
        <canvas id="toolsChart"></canvas>
      </div>
      <div class="chart-card">
        <h2>Hourly Requests (Last 24h)</h2>
        <canvas id="hourlyChart"></canvas>
      </div>
      <div class="chart-card">
        <h2>Clients by User Agent</h2>
        <canvas id="clientsChart"></canvas>
      </div>
    </div>

    <div class="recent-calls">
      <h2>Recent Tool Calls</h2>
      <div id="recent-calls-list"></div>
    </div>

    <p class="refresh-note">Auto-refreshes every 30 seconds</p>
  </div>

  <script>
    const API_KEY_STORAGE_KEY = 'nextcloud_mcp_analytics_api_key';
    let toolsChart, hourlyChart, clientsChart;
    const apiKeyInput = document.getElementById('api-key-input');
    const authStatus = document.getElementById('auth-status');

    function setAuthStatus(message, isError = false) {
      authStatus.textContent = message;
      authStatus.style.color = isError ? '#fecaca' : 'rgba(255,255,255,0.72)';
    }

    function getApiKey() {
      return apiKeyInput.value.trim() || sessionStorage.getItem(API_KEY_STORAGE_KEY) || '';
    }

    function saveApiKey(apiKey) {
      sessionStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
      apiKeyInput.value = apiKey;
    }

    function clearApiKey() {
      sessionStorage.removeItem(API_KEY_STORAGE_KEY);
      apiKeyInput.value = '';
      setAuthStatus('API key cleared for this tab.');
    }

    async function fetchData(apiKey) {
      const basePath = window.location.pathname.replace('/analytics/dashboard', '');
      const res = await fetch(basePath + '/analytics', {
        headers: { 'X-API-Key': apiKey }
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error?.message || \`Request failed with status \${res.status}\`);
      }

      return res.json();
    }

    function updateStats(data) {
      document.getElementById('stats-grid').innerHTML = \`
        <div class="stat-card">
          <h3>\${data.summary.totalRequests.toLocaleString()}</h3>
          <p>Total Requests</p>
        </div>
        <div class="stat-card">
          <h3>\${data.summary.totalToolCalls.toLocaleString()}</h3>
          <p>Tool Calls</p>
        </div>
        <div class="stat-card">
          <h3>\${data.summary.uniqueClients}</h3>
          <p>Unique Clients</p>
        </div>
        <div class="stat-card">
          <h3>\${data.uptime}</h3>
          <p>Uptime</p>
        </div>
      \`;
    }

    function updateCharts(data) {
      const toolLabels = Object.keys(data.breakdown.byTool).slice(0, 10);
      const toolValues = Object.values(data.breakdown.byTool).slice(0, 10);

      if (toolsChart) toolsChart.destroy();
      toolsChart = new Chart(document.getElementById('toolsChart'), {
        type: 'doughnut',
        data: {
          labels: toolLabels,
          datasets: [{
            data: toolValues,
            backgroundColor: [
              '#0082c9', '#00678c', '#a0d8ef', '#5bc0de', '#4a90d9',
              '#3498db', '#2980b9', '#1abc9c', '#16a085', '#27ae60'
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'right', labels: { color: '#fff' } } }
        }
      });

      const hourlyLabels = Object.keys(data.hourlyRequests).map(h => h.split('T')[1] || h);
      const hourlyValues = Object.values(data.hourlyRequests);

      if (hourlyChart) hourlyChart.destroy();
      hourlyChart = new Chart(document.getElementById('hourlyChart'), {
        type: 'line',
        data: {
          labels: hourlyLabels,
          datasets: [{
            label: 'Requests',
            data: hourlyValues,
            borderColor: '#a0d8ef',
            backgroundColor: 'rgba(160, 216, 239, 0.2)',
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          scales: {
            x: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
            y: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
          },
          plugins: { legend: { labels: { color: '#fff' } } }
        }
      });

      const clientLabels = Object.keys(data.clients.byUserAgent).slice(0, 8);
      const clientValues = Object.values(data.clients.byUserAgent).slice(0, 8);

      if (clientsChart) clientsChart.destroy();
      clientsChart = new Chart(document.getElementById('clientsChart'), {
        type: 'bar',
        data: {
          labels: clientLabels,
          datasets: [{
            label: 'Requests',
            data: clientValues,
            backgroundColor: [
              '#0082c9', '#00678c', '#a0d8ef', '#5bc0de',
              '#4a90d9', '#3498db', '#2980b9', '#1abc9c'
            ]
          }]
        },
        options: {
          responsive: true,
          indexAxis: 'y',
          scales: {
            x: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } },
            y: { ticks: { color: '#fff' }, grid: { color: 'rgba(255,255,255,0.1)' } }
          },
          plugins: { legend: { display: false } }
        }
      });
    }

    function updateRecentCalls(data) {
      const list = document.getElementById('recent-calls-list');
      list.innerHTML = data.recentToolCalls.slice(0, 10).map(call => \`
        <div class="call-item">
          <span class="call-tool">\${call.tool}</span>
          <span class="call-time">\${new Date(call.timestamp).toLocaleString()}</span>
        </div>
      \`).join('');
    }

    async function refresh() {
      const apiKey = getApiKey();
      if (!apiKey) {
        setAuthStatus('Enter your API key to load analytics.');
        return;
      }

      saveApiKey(apiKey);
      setAuthStatus('Loading analytics...');

      try {
        const data = await fetchData(apiKey);
        updateStats(data);
        updateCharts(data);
        updateRecentCalls(data);
        setAuthStatus('Analytics loaded. API key is stored only in session storage for this tab.');
      } catch (error) {
        setAuthStatus(error instanceof Error ? error.message : 'Failed to load analytics.', true);
      }
    }

    document.getElementById('load-dashboard').addEventListener('click', refresh);
    document.getElementById('clear-api-key').addEventListener('click', clearApiKey);
    apiKeyInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        refresh();
      }
    });

    const storedApiKey = sessionStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedApiKey) {
      apiKeyInput.value = storedApiKey;
      refresh();
    } else {
      setAuthStatus('Enter your API key to load analytics. It will not be placed in the URL.');
    }

    setInterval(() => {
      if (sessionStorage.getItem(API_KEY_STORAGE_KEY)) {
        refresh();
      }
    }, 30000);
  </script>
</body>
</html>
`;
  res.send(html);
});

// Explicitly advertise that this deployment does not expose OAuth metadata.
// This keeps auth discovery deterministic when the MCP server is mounted under a subpath.
function handleNoOAuthMetadata(req: Request, res: Response): void {
  trackRequest(req, '/.well-known');
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).json({
    supported: false,
    authentication: 'none',
    message: 'This MCP deployment does not advertise OAuth metadata.',
    path: req.path,
  });
}

app.all(/^\/\.well-known\/oauth-protected-resource(?:\/.*)?$/, handleNoOAuthMetadata);
app.all(/^\/\.well-known\/oauth-authorization-server(?:\/.*)?$/, handleNoOAuthMetadata);

async function handleServerRequest(req: Request, res: Response, server: McpServer): Promise<void> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    void transport.close();
    void server.close();
  };

  try {
    res.once('finish', cleanup);
    res.once('close', cleanup);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    // Streamable HTTP may return before async handlers have written their
    // JSON-RPC response. Only clean up immediately if the response already ended.
    if (res.writableEnded) {
      cleanup();
    }
  } catch (error) {
    console.error('MCP request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
      cleanup();
    }
  }
}

// Shared handler for MCP requests once credentials are resolved
async function handleMcpRequest(
  req: Request,
  res: Response,
  credentials: { host: string; username: string; password: string }
) {
  // Track tool calls
  if (req.body?.method === 'tools/call' && req.body?.params?.name) {
    trackToolCall(req.body.params.name);
  }

  // Create per-request client set and run within isolated context
  const clientSet = createClientSet(credentials.host, credentials.username, credentials.password);
  const server = createHttpMcpServer(clientSet);
  await handleServerRequest(req, res, server);
}

function sendMissingCredentialsResponse(res: Response): void {
  res.status(401).json({
    jsonrpc: '2.0',
    error: {
      code: -32600,
      message: 'Missing Nextcloud credentials. Provide X-Nextcloud-Host, X-Nextcloud-Username, and X-Nextcloud-Password headers.',
    },
    id: null,
  });
}

// MCP endpoint with API key in URL path (for clients like Claude.ai that don't support header/query auth)
app.all('/mcp/:apiKey', async (req: Request, res: Response) => {
  trackRequest(req, '/mcp');

  if (!isKeyServiceEnabled()) {
    logAuthOutcome('path', 'key_service_disabled');
    res.status(404).json({
      jsonrpc: '2.0',
      error: { code: -32600, message: 'Path-based auth requires Key Service mode.' },
      id: null,
    });
    return;
  }

  const result = await resolveKeyCredentials(req.params.apiKey);
  if (!result.ok) {
    logAuthOutcome('path', result.reason, {
      apiKey: maskSecret(req.params.apiKey),
      method: req.method,
    });
    const status = result.reason === 'invalid_key' ? 403 : 503;
    const message = result.reason === 'service_unavailable'
      ? 'Authentication service temporarily unavailable. Try again later.'
      : result.reason === 'malformed_response'
        ? 'Authentication service returned incomplete credentials.'
        : 'Invalid or expired API key.';
    res.status(status).json({
      jsonrpc: '2.0',
      error: { code: -32600, message },
      id: null,
    });
    return;
  }

  if (MCP_TRACE_HTTP) {
    logAuthOutcome('path', 'resolved', {
      apiKey: maskSecret(req.params.apiKey),
      method: req.method,
    });
  }

  await handleMcpRequest(req, res, result.credentials);
});

// MCP endpoint - dual-mode authentication (query param / header)
app.all('/mcp', async (req: Request, res: Response) => {
  trackRequest(req, '/mcp');

  let credentials: { host: string; username: string; password: string } | null = null;

  const apiKey = (req.headers['x-api-key'] as string) || (req.query.api_key as string);

  if (isKeyServiceEnabled()) {
    // --- Key Service Mode ---
    if (!apiKey) {
      logAuthOutcome('query', 'missing_api_key', {
        method: req.method,
      });
      res.status(403).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Missing api_key parameter.' },
        id: null,
      });
      return;
    }

    const result = await resolveKeyCredentials(apiKey);
    if (!result.ok) {
      logAuthOutcome('query', result.reason, {
        apiKey: maskSecret(apiKey),
        method: req.method,
      });
      const status = result.reason === 'invalid_key' ? 403 : 503;
      const message = result.reason === 'service_unavailable'
        ? 'Authentication service temporarily unavailable. Try again later.'
        : result.reason === 'malformed_response'
          ? 'Authentication service returned incomplete credentials.'
          : 'Invalid or expired API key.';
      res.status(status).json({
        jsonrpc: '2.0',
        error: { code: -32600, message },
        id: null,
      });
      return;
    }

    if (MCP_TRACE_HTTP) {
      logAuthOutcome('query', 'resolved', {
        apiKey: maskSecret(apiKey),
        method: req.method,
      });
    }

    credentials = result.credentials;
  } else {
    // --- Self-Hosted Mode ---
    if (!validateApiKey(req)) {
      logAuthOutcome('self-hosted', 'invalid_server_api_key', {
        method: req.method,
      });
      res.status(403).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Forbidden: Invalid or missing API key. Provide a valid X-API-Key header.',
        },
        id: null,
      });
      return;
    }

    credentials = extractCredentials(req);
    if (!credentials) {
      logAuthOutcome('self-hosted', 'missing_nextcloud_headers', {
        method: req.method,
      });
      sendMissingCredentialsResponse(res);
      return;
    }
  }

  await handleMcpRequest(req, res, credentials);
});

if (ENABLE_SMITHERY_ENDPOINT) {
  app.all('/smithery/mcp', async (req: Request, res: Response) => {
    trackRequest(req, '/smithery/mcp');

    const credentials = extractCredentials(req);
    if (!credentials) {
      logAuthOutcome('smithery', 'missing_nextcloud_headers', {
        method: req.method,
      });
      sendMissingCredentialsResponse(res);
      return;
    }

    if (MCP_TRACE_HTTP) {
      logAuthOutcome('smithery', 'resolved', {
        method: req.method,
      });
    }

    await handleMcpRequest(req, res, credentials);
  });
}

if (ENABLE_MCP_DIAGNOSTICS) {
  app.all('/mcp-debug/open', async (req: Request, res: Response) => {
    trackRequest(req, '/mcp-debug/open');
    await handleServerRequest(req, res, createDiagnosticMcpServer());
  });
}

// Root endpoint with server info (no credentials or sensitive data exposed)
app.get('/', (req: Request, res: Response) => {
  trackRequest(req, '/');
  res.json({
    name: 'Nextcloud MCP Server',
    version: '1.0.0',
    description: 'MCP server for Nextcloud integration (Notes, Calendar, Contacts, Tables, WebDAV)',
    transport: 'streamable-http',
    endpoints: {
      mcp: '/mcp',
      mcp_with_key: '/mcp/:apiKey (for clients that cannot send headers or query params)',
      smithery_mcp: ENABLE_SMITHERY_ENDPOINT ? '/smithery/mcp (header-based direct credentials for Smithery)' : undefined,
      health: '/health',
    },
    authentication: isKeyServiceEnabled()
      ? {
          mode: 'key-service',
          description: 'Provide a user API key. Credentials are resolved via the MCP Key Service.',
          options: {
            queryParam: '/mcp?api_key=usr_XXXXXXXX (recommended for Claude.ai)',
            path: '/mcp/usr_XXXXXXXX (path fallback for clients that cannot preserve query params)',
            header: 'X-API-Key: usr_XXXXXXXX',
          },
        }
      : {
          mode: 'self-hosted',
          description: 'Provide an API key and Nextcloud credentials via headers.',
          headers: {
            'X-API-Key': 'Server API key (required)',
            'X-Nextcloud-Host': 'Nextcloud server URL',
            'X-Nextcloud-Username': 'Nextcloud username',
            'X-Nextcloud-Password': 'Nextcloud app password',
          },
        },
    documentation: 'https://github.com/hithereiamaliff/mcp-nextcloud',
    diagnostics: ENABLE_MCP_DIAGNOSTICS
      ? {
          open_mcp: '/mcp-debug/open',
        }
      : undefined,
  });
});

app.listen(PORT, HOST, () => {
  console.log('='.repeat(60));
  console.log('Nextcloud MCP Server (Streamable HTTP)');
  console.log('='.repeat(60));
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  if (isKeyServiceEnabled()) {
    console.log(`Auth mode: Key Service (${process.env.KEY_SERVICE_URL})`);
    console.log(`Analytics auth: ${MCP_API_KEY ? 'configured' : 'NOT SET (/analytics disabled)'}`);
  } else {
    console.log(`Auth mode: Self-hosted (MCP_API_KEY: ${MCP_API_KEY ? 'configured' : 'NOT SET'})`);
  }
  console.log(`HTTP trace logging: ${MCP_TRACE_HTTP ? 'enabled' : 'disabled'}`);
  console.log(`Smithery endpoint: ${ENABLE_SMITHERY_ENDPOINT ? '/smithery/mcp' : 'disabled'}`);
  console.log(`Diagnostics endpoint: ${ENABLE_MCP_DIAGNOSTICS ? '/mcp-debug/open' : 'disabled'}`);
  console.log(`Debug tools: ${IS_PRODUCTION ? 'disabled (production)' : 'enabled (development)'}`);
  console.log('='.repeat(60));
  console.log('');
});
