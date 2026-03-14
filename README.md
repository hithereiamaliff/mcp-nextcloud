# Nextcloud MCP Server

**MCP Endpoint:** `https://mcp.techmavie.digital/nextcloud/mcp`

> **Note:** This project is a complete rewrite in TypeScript of the original Python-based [cbcoutinho/nextcloud-mcp-server](https://github.com/cbcoutinho/nextcloud-mcp-server), now with **self-hosted VPS deployment** and **Smithery deployment support**.
>
> ### Key Differences from the Original Repository:
> *   **Language:** This project is written in TypeScript, while the original is in Python.
> *   **Smithery Support:** Added full support for Smithery deployment and local testing via Smithery playground.
> *   **Project Structure:** The project structure has been adapted for a Node.js/TypeScript environment with MCP SDK integration.
> *   **Dependencies:** This project uses npm for package management, whereas the original uses Python's dependency management tools.
> *   **Deployment:** Now supports both local development and cloud deployment via Smithery.

The Nextcloud MCP (Model Context Protocol) server allows Large Language Models (LLMs) like OpenAI's GPT, Google's Gemini, or Anthropic's Claude to interact with your Nextcloud instance. This enables automation of various Nextcloud actions across Notes, Calendar, Contacts, Tables, and WebDAV file operations.

The hosted HTTP integration now supports a safer multi-user flow through the MCP Key Service. Instead of embedding raw Nextcloud credentials in the connector URL, hosted clients can use a user-scoped `usr_...` key and let the server resolve credentials server-side.

## Features

The server provides integration with multiple Nextcloud apps, enabling LLMs to interact with your Nextcloud data through a comprehensive set of **30 tools** across 5 main categories.

## Supported Nextcloud Apps

| App | Support Status | Description |
|-----|----------------|-------------|
| **Notes** | ✅ Full Support | Create, read, update, delete, search, and append to notes. |
| **Calendar** | ✅ Full Support | Complete calendar integration - manage calendars and events via CalDAV. |
| **Tables** | ✅ Full Support | Complete table operations - list tables, get schemas, and perform CRUD operations on rows. |
| **Files (WebDAV)** | ✅ Full Support | Complete file system access - browse directories, read/write files, create/delete resources. |
| **Contacts** | ✅ Full Support | Create, read, update, and delete contacts and address books via CardDAV. |

## Available Tools (30 Total)

### 📝 Notes Tools (5 tools)

| Tool | Description |
|------|-------------|
| `nextcloud_notes_create_note` | Create a new note with title, content, and category |
| `nextcloud_notes_update_note` | Update an existing note by ID with optional title, content, or category |
| `nextcloud_notes_append_content` | Append content to an existing note with a clear separator |
| `nextcloud_notes_search_notes` | Search notes by title or content with result filtering |
| `nextcloud_notes_delete_note` | Delete a note by ID |

### 📅 Calendar Tools (6 tools)

| Tool | Description |
|------|-------------|
| `nextcloud_calendar_list_calendars` | List all available calendars for the user |
| `nextcloud_calendar_create_event` | Create a calendar event with summary, description, dates, and location |
| `nextcloud_calendar_list_events` | List events from a calendar with optional date filtering |
| `nextcloud_calendar_get_event` | Get detailed information about a specific event |
| `nextcloud_calendar_update_event` | Update any aspect of an existing event |
| `nextcloud_calendar_delete_event` | Delete a calendar event |

### 👥 Contacts Tools (6 tools)

| Tool | Description |
|------|-------------|
| `nextcloud_contacts_list_addressbooks` | List all available addressbooks for the user |
| `nextcloud_contacts_create_addressbook` | Create a new addressbook with display name and description |
| `nextcloud_contacts_delete_addressbook` | Delete an addressbook by ID |
| `nextcloud_contacts_list_contacts` | List all contacts in a specific addressbook |
| `nextcloud_contacts_create_contact` | Create a new contact with full name, emails, phones, addresses, and organizations |
| `nextcloud_contacts_delete_contact` | Delete a contact from an addressbook |

### 📊 Tables Tools (6 tools)

| Tool | Description |
|------|-------------|
| `nextcloud_tables_list_tables` | List all tables available to the user |
| `nextcloud_tables_get_schema` | Get the schema/structure of a specific table including columns |
| `nextcloud_tables_read_table` | Read all rows from a table |
| `nextcloud_tables_insert_row` | Insert a new row into a table with key-value data |
| `nextcloud_tables_update_row` | Update an existing row in a table |
| `nextcloud_tables_delete_row` | Delete a row from a table |

### 📁 WebDAV File System Tools (6 tools)

| Tool | Description |
|------|-------------|
| `nextcloud_webdav_search_files` | **🔍 NEW!** Unified search across filenames, content, and metadata - no need to specify exact paths |
| `nextcloud_webdav_list_directory` | List files and directories in any Nextcloud path |
| `nextcloud_webdav_read_file` | Read file content from Nextcloud |
| `nextcloud_webdav_write_file` | Create or update files in Nextcloud with content |
| `nextcloud_webdav_create_directory` | Create new directories in Nextcloud |
| `nextcloud_webdav_delete_resource` | Delete files or directories from Nextcloud |

## 🔍 Revolutionary Unified WebDAV Search Feature

The crown jewel of this MCP server is the powerful **unified search system** for WebDAV files, inspired by modern search interfaces like on an another MCP that I have created: [mcp-datagovmy](https://github.com/hithereiamaliff/mcp-datagovmy). This completely transforms how you interact with your Nextcloud files by eliminating the need to specify exact file paths.

### ✨ Key Features

- **🎯 Multi-scope Search**: Search across filenames, file content, and metadata simultaneously
- **🧠 Smart File Type Detection**: Automatically handles text files, code, configuration files, documents, and media
- **🔧 Advanced Filtering**: Filter by file type, size range, modification date, and directory
- **📈 Intelligent Ranking**: Results ranked by relevance with bonuses for recent files and exact matches
- **👀 Content Preview**: Optional content previews for matched text files
- **⚡ Performance Optimized**: Intelligent caching, timeout protection, and parallel processing
- **🛡️ Error Recovery**: Fallback strategies prevent timeouts and provide helpful suggestions

### 🚀 Usage Examples

```typescript
// Basic search - find all files containing "FAQ Dean List"
await nextcloud_webdav_search_files({
  query: "FAQ Dean List"
});

// Advanced search - find PDF reports from 2024
await nextcloud_webdav_search_files({
  query: "report 2024",
  fileTypes: ["pdf"],
  searchIn: ["filename", "content"],
  limit: 20,
  includeContent: true,
  quickSearch: true
});

// Directory-specific search with date range
await nextcloud_webdav_search_files({
  query: "meeting notes",
  basePath: "/Documents",
  searchIn: ["filename", "content"],
  dateRange: {
    from: "2024-01-01",
    to: "2024-12-31"
  }
});

// Search by file characteristics
await nextcloud_webdav_search_files({
  query: "configuration files",
  sizeRange: { min: 1024, max: 102400 }, // 1KB - 100KB
  fileTypes: ["json", "yaml", "xml", "conf"]
});

// Quick search for large directories (optimized)
await nextcloud_webdav_search_files({
  query: "budget",
  basePath: "/", // Root directory
  quickSearch: true, // Enables optimizations
  limit: 25,
  maxDepth: 2 // Limit search depth
});
```

### 📋 Complete Parameter Reference

| Parameter | Type | Default | Description | Example |
|-----------|------|---------|-------------|---------|
| `query` | string | *required* | Search terms - supports multiple words | `"FAQ Dean List"` |
| `searchIn` | array | `["filename", "content"]` | Search scope: `filename`, `content`, `metadata` | `["filename", "content", "metadata"]` |
| `fileTypes` | array | *all types* | File extensions to include | `["pdf", "txt", "md", "docx"]` |
| `basePath` | string | `"/"` | Directory to search in | `"/Documents/Reports"` |
| `limit` | number | `50` | Maximum results to return | `20` |
| `includeContent` | boolean | `false` | Include content previews for text files | `true` |
| `caseSensitive` | boolean | `false` | Case-sensitive matching | `true` |
| `quickSearch` | boolean | `true` | Use optimized mode for root searches | `false` |
| `maxDepth` | number | `3` | Maximum directory depth (1-10) | `5` |
| `sizeRange` | object | *unlimited* | File size filters in bytes | `{min: 1024, max: 1048576}` |
| `dateRange` | object | *all dates* | Last modified date filters | `{from: "2024-01-01", to: "2024-12-31"}` |

### 🎯 Performance Tips

- **For root directory searches**: Use `quickSearch: true` and `maxDepth: 2-3` for faster results
- **For specific directories**: Use `basePath: "/Documents"` instead of searching root "/"
- **For large result sets**: Add `fileTypes` filter to narrow scope
- **For timeout issues**: Enable `quickSearch` and use smaller `limit` values

### 🧪 Test Tool (1 tool)

| Tool | Description |
|------|-------------|
| `hello` | Verify server connectivity and list all available tools |

## 🔄 Before vs After: The Search Revolution

### **Before Unified Search**
```typescript
// You had to know exact paths
await nextcloud_webdav_read_file({
  path: "/Documents/Finance/Reports/Q4_Budget_Analysis_2024.pdf"
});

// Multiple calls needed to explore
await nextcloud_webdav_list_directory({ path: "/" });
await nextcloud_webdav_list_directory({ path: "/Documents" });
await nextcloud_webdav_list_directory({ path: "/Documents/Finance" });
// ... and so on
```

### **After Unified Search** ✨
```typescript
// Natural language search across entire Nextcloud!
await nextcloud_webdav_search_files({
  query: "Q4 budget analysis 2024",
  fileTypes: ["pdf"]
});

// Finds files instantly regardless of location!
```

## 🛠️ Advanced Search Strategies

### Content-Aware Search
The system intelligently extracts and searches content from:

- **📝 Text Files**: `.txt`, `.md`, `.csv` - Full content indexing
- **💻 Code Files**: `.js`, `.ts`, `.py`, `.html`, `.css` - Syntax-aware search
- **⚙️ Config Files**: `.json`, `.xml`, `.yaml` - Structure-aware indexing
- **📄 Documents**: `.pdf`, `.docx` - Metadata and properties
- **🎬 Media Files**: Images, videos - EXIF data and metadata

### Smart Ranking System
Results are ranked using advanced algorithms:

1. **Exact filename matches** → 100 points
2. **Word boundaries in filenames** → 80 points
3. **Partial filename matches** → 60+ points (position bonus)
4. **Content frequency matches** → 50+ points (term density)
5. **Recent file bonus** → +10 points (last 30 days)
6. **File type preference** → +5 points (text/code files)
7. **Size convenience** → +5 points (files under 100KB)

### Error Handling & Recovery
- **🕐 20-second timeout protection** - Prevents hanging operations
- **🔄 Automatic fallback search** - Falls back to directory listing if indexing fails
- **💡 Intelligent suggestions** - Provides helpful tips for optimization
- **📊 Performance metrics** - Shows search duration and result counts

## Installation

### Quick Start with npm (Recommended)

Install directly from npm and run as an MCP server:

```bash
# Install globally
npm install -g mcp-nextcloud

# Or install locally in your project
npm install mcp-nextcloud
```

### Usage as MCP Server

After installation, you can run the MCP server directly:

```bash
# If installed globally
mcp-nextcloud

# If installed locally
npx mcp-nextcloud

# Or using npm script
npm exec mcp-nextcloud
```

**Environment Setup**: Create a `.env` file with your Nextcloud credentials:

```bash
NEXTCLOUD_HOST=https://your.nextcloud.instance.com
NEXTCLOUD_USERNAME=your_nextcloud_username
NEXTCLOUD_PASSWORD=your_nextcloud_app_password
```

### Integration with LLM Applications

Add to your MCP client configuration (e.g., Claude Desktop, Continue, etc.):

**For CLI mode (local, single-user):**
```json
{
  "mcpServers": {
    "nextcloud": {
      "command": "mcp-nextcloud",
      "env": {
        "NEXTCLOUD_HOST": "https://your.nextcloud.instance.com",
        "NEXTCLOUD_USERNAME": "your_username",
        "NEXTCLOUD_PASSWORD": "your_app_password"
      }
    }
  }
}
```

**For hosted HTTP mode (via MCP Key Service):**
```json
{
  "mcpServers": {
    "nextcloud": {
      "transport": "streamable-http",
      "url": "https://mcp.techmavie.digital/nextcloud/mcp/usr_XXXXXXXX"
    }
  }
}
```

> **Recommended for hosted clients:** Use the path-based URL form (`/mcp/usr_...`) for Claude.ai and similar hosted connectors. Keep the query-param form as a compatibility option for inspectors and clients that preserve query params reliably.

**For self-hosted HTTP mode (your own server):**
```json
{
  "mcpServers": {
    "nextcloud": {
      "transport": "streamable-http",
      "url": "https://mcp.techmavie.digital/nextcloud/mcp",
      "headers": {
        "X-API-Key": "your-server-api-key",
        "X-Nextcloud-Host": "https://your.nextcloud.instance.com",
        "X-Nextcloud-Username": "your_username",
        "X-Nextcloud-Password": "your_app_password"
      }
    }
  }
}
```

### Prerequisites

*   Node.js 18+
*   Access to a Nextcloud instance
*   npm or yarn package manager

### Local Development Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/hithereiamaliff/mcp-nextcloud.git
    cd mcp-nextcloud
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure your Nextcloud credentials (see Configuration section)

4.  Build the project:
    ```bash
    npm run build
    ```

## Configuration

### Environment Variables

Create a `.env` file in the root directory based on `.env.sample`:

```dotenv
# --- CLI/stdio mode only ---
# These are used when running the server in CLI mode (npm run dev, npm run cli).
# They are NOT used by the HTTP server.
NEXTCLOUD_HOST=https://your.nextcloud.instance.com
NEXTCLOUD_USERNAME=your_nextcloud_username
NEXTCLOUD_PASSWORD=your_nextcloud_app_password

# --- HTTP server: Self-Hosted mode ---
# Required for self-hosted /mcp auth, and also used for /analytics access.
MCP_API_KEY=your-secret-api-key-here

# --- HTTP server: Key Service mode ---
# Set both to enable user api_key=usr_... resolution via the MCP Key Service.
KEY_SERVICE_URL=https://mcpkeys.techmavie.digital/internal/resolve
KEY_SERVICE_TOKEN=your-key-service-bearer-token

# Optional: Comma-separated list of allowed CORS origins.
ALLOWED_ORIGINS=https://smithery.ai,https://claude.ai

# Optional diagnostics for remote MCP debugging.
# These are intended for temporary troubleshooting in hosted HTTP mode.
MCP_TRACE_HTTP=false
ENABLE_MCP_DIAGNOSTICS=false
```

**Important Security Notes:**
- Use a dedicated Nextcloud App Password instead of your regular login password. Generate one in your Nextcloud Security settings.
- In HTTP mode, `NEXTCLOUD_*` environment variables are **never used**. Self-hosted clients provide credentials via `X-Nextcloud-*` headers, while key-service clients send only a `usr_...` key.
- Generate a strong API key: `openssl rand -hex 32`

### Smithery Configuration

When deploying via Smithery, you can configure credentials through:
- Smithery configuration interface (recommended for cloud deployment)

## Deployment & Usage

### Option 1: Hosted Server (Recommended)

The easiest way to use this MCP server is via the hosted endpoint. **No installation required!**

**Endpoint:** `https://mcp.techmavie.digital/nextcloud/mcp`

#### Authentication

The hosted server uses the **MCP Key Service** for authentication. You get a personal API key (`usr_XXXXXXXX`) from the portal, and the server resolves your Nextcloud credentials automatically.

Why this is safer than the old query-credential approach:

- raw Nextcloud credentials are not embedded in the connector URL
- revoking a `usr_...` key is easier than rotating a user's underlying Nextcloud password everywhere
- server-side auditing and policy are easier to centralize
- support/debug workflows are safer because users share a scoped key, not their real Nextcloud password

**Claude.ai / hosted connector URL (recommended):**

```
https://mcp.techmavie.digital/nextcloud/mcp/usr_XXXXXXXX
```

**Alternative URL for clients that preserve query params correctly:**

```
https://mcp.techmavie.digital/nextcloud/mcp?api_key=usr_XXXXXXXX
```

#### Client Configuration

```json
{
  "mcpServers": {
    "nextcloud": {
      "transport": "streamable-http",
      "url": "https://mcp.techmavie.digital/nextcloud/mcp/usr_XXXXXXXX"
    }
  }
}
```

#### Test with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
# Select "Streamable HTTP"
# Enter URL: https://mcp.techmavie.digital/nextcloud/mcp/usr_XXXXXXXX
```

### Option 2: Self-Hosted (VPS)

If you prefer to run your own instance, see [deploy/DEPLOYMENT.md](deploy/DEPLOYMENT.md) for detailed VPS deployment instructions with Docker and Nginx.

```bash
# Set required environment variables
export MCP_API_KEY=your-secret-api-key  # Required for self-hosted /mcp auth and /analytics
export KEY_SERVICE_URL=https://mcpkeys.techmavie.digital/internal/resolve  # Optional: enables key service mode
export KEY_SERVICE_TOKEN=your-key-service-bearer-token                      # Optional: enables key service mode

# Using Docker
docker compose up -d --build

# Or run directly
npm run build
npm run start:http
```

> **Important:** The HTTP server does NOT use `NEXTCLOUD_*` environment variables. In self-hosted mode, each client must provide Nextcloud credentials via request headers. In key-service mode, clients send only `api_key=usr_...`.

> **Remote MCP note:** For hosted connectors such as Claude.ai, prefer the path-based URL form (`/mcp/usr_...`). Keep the query-param form as a compatibility option for inspectors and clients that preserve query params reliably.

> **Debugging note:** If a hosted client shows a generic auth prompt, it does not automatically mean OAuth is required. First verify the auth-free diagnostics route, the key-service resolver response, and the actual `initialize` SSE body.

### Option 3: npm Package (CLI)

Install and run as a local MCP server:

```bash
npm install -g mcp-nextcloud
mcp-nextcloud
```

> **Note:** In CLI mode, credentials are read from environment variables (`NEXTCLOUD_HOST`, `NEXTCLOUD_USERNAME`, `NEXTCLOUD_PASSWORD`). This is safe because CLI mode runs locally for a single user.

### Option 4: Smithery Deployment

For cloud deployment via Smithery:

```bash
npm run dev    # Local development with Smithery playground
npm run deploy # Deploy to Smithery cloud
```

## Publishing to npm

### For Maintainers

To publish this package to npm:

1. **Prepare the release:**
   ```bash
   npm run build
   npm version patch|minor|major
   ```

2. **Publish to npm:**
   ```bash
   npm publish
   ```

3. **Verify the publication:**
   ```bash
   npm view mcp-nextcloud
   ```

### Publishing Checklist

- [ ] All tests pass (Smithery deployment confirmed working)
- [ ] TypeScript builds without errors (`npm run build`)
- [ ] Version bumped appropriately (`npm version`)
- [ ] README updated with changes
- [ ] `.npmignore` properly excludes development files
- [ ] CLI executable works (`dist/cli.js`)

### Dual Deployment Strategy

This project supports both deployment methods simultaneously:

- **Smithery**: For cloud deployment and development testing
- **npm**: For end-user installation and MCP client integration

The Smithery configuration (`smithery.yaml`) and npm package configuration coexist without interference.

## Smithery Integration

This project includes full Smithery support with:

- **`smithery.yaml`**: Specifies TypeScript runtime
- **Development server**: Local testing with hot reload
- **One-click deployment**: Deploy to cloud with a single command
- **Configuration management**: Secure credential handling
- **Playground integration**: Immediate testing interface

## Security

### HTTP Server Security Model

The HTTP server (`http-server.ts`) supports two authentication modes:

**Key Service Mode** (hosted/multi-user):
- User API keys (`usr_...`) are resolved via the MCP Key Service which returns encrypted Nextcloud credentials.
- No raw credentials are sent by the client - only the user-scoped API key.
- Credentials are cached for 60 seconds to reduce key service load, then re-validated.

**Self-Hosted Mode** (single-operator):
- A server-side `MCP_API_KEY` validates access.
- Each client provides Nextcloud credentials via `X-Nextcloud-*` headers.

**Common security measures:**
- **Per-Request Credential Isolation**: Each request gets its own isolated set of Nextcloud clients via `AsyncLocalStorage`. No credential state is shared between requests.
- **No Environment Variable Fallback**: The HTTP server never falls back to `NEXTCLOUD_*` environment variables for credentials. These are only used in CLI mode.
- **Restricted CORS**: Only origins listed in `ALLOWED_ORIGINS` are permitted (defaults to `smithery.ai` and `claude.ai`).
- **Protected Analytics**: The `/analytics` endpoint requires `MCP_API_KEY` authentication in both modes. The dashboard page stores the key in session storage, never in the URL. Client IPs are hashed before storage.
- **Debug Tools Disabled in Production**: Calendar debug tools are automatically disabled when `NODE_ENV=production`.

### Self-Hosting Checklist

If you deploy your own instance:

1. Choose an auth mode: set `KEY_SERVICE_URL` + `KEY_SERVICE_TOKEN` for key service, or `MCP_API_KEY` for self-hosted
2. Set `MCP_API_KEY` for analytics access (required in both modes)
3. Do NOT set `NEXTCLOUD_*` environment variables on the HTTP server
4. Use HTTPS (TLS) for all connections
5. Configure `ALLOWED_ORIGINS` to restrict which domains can connect
6. Use Nextcloud App Passwords (not your main login password)

## Troubleshooting

### Common Issues

1. **404 Errors on WebDAV/Calendar/Contacts**: 
   - Ensure your Nextcloud credentials are correct
   - Verify the Nextcloud apps (Calendar, Contacts) are installed and enabled
   - Check that your app password has the necessary permissions

2. **Authentication Failures**:
   - Use an App Password instead of your regular password
   - Verify the `NEXTCLOUD_HOST` URL is correct (including https://)
   - Ensure the Nextcloud instance is accessible

3. **Missing Tools**:
   - Run the `hello` tool to verify all 30 tools are available
   - Check the server logs for any initialization errors

4. **Search Timeout Issues**:
   - Use `quickSearch: true` for root directory searches
   - Specify a `basePath` like "/Documents" instead of searching root "/"
   - Add `fileTypes` filters to narrow the search scope
   - Reduce `maxDepth` parameter for faster results

### Hosted HTTP / Claude.ai Debugging

If the hosted connector still fails, use this order:

1. Verify the auth-free diagnostics route first:
   - enable `ENABLE_MCP_DIAGNOSTICS=true`
   - test `/mcp-debug/open`
   - if this works, the issue is likely auth or an upstream dependency, not basic MCP transport
2. Verify the key-service resolver directly from the deployed MCP host:
   ```bash
   curl -i -X POST "$KEY_SERVICE_URL" \
     -H "Authorization: Bearer $KEY_SERVICE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"key":"usr_..."}'
   ```
   Expected:
   - `200 OK`
   - `Content-Type: application/json`
   - valid JSON response
3. Verify the MCP initialize response body, not just the status code:
   ```bash
   curl -N --max-time 10 -X POST "https://mcp.techmavie.digital/nextcloud/mcp/usr_XXXXXXXX" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json, text/event-stream" \
     -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"probe","version":"1.0.0"}}}'
   ```
   Expected:
   - `200 OK`
   - `Content-Type: text/event-stream`
   - non-empty SSE initialize response body
4. If the hosted client keeps retrying the same initialize request every few seconds, suspect an empty or malformed SSE initialize response even if the HTTP status is `200`.
5. Enable temporary tracing with `MCP_TRACE_HTTP=true` and inspect:
   - final status code
   - request `accept`
   - request `content-type`
   - `content-type` response header
   - auth outcome (`resolved`, `invalid_key`, `service_unavailable`, `malformed_response`)

## Development

### Project Structure

```
├── src/
│   ├── index.ts          # Main Smithery entry point
│   ├── http-server.ts    # Streamable HTTP server for VPS deployment
│   ├── app.ts            # Legacy entry point
│   ├── client/           # Nextcloud API clients
│   ├── models/           # TypeScript interfaces
│   ├── tools/            # Tool implementations
│   └── utils/            # Utility functions
├── deploy/
│   ├── DEPLOYMENT.md     # VPS deployment guide
│   └── nginx-mcp.conf    # Nginx reverse proxy config
├── .github/
│   └── workflows/
│       └── deploy-vps.yml # GitHub Actions auto-deploy
├── docker-compose.yml    # Docker deployment config
├── Dockerfile            # Container build config
├── smithery.yaml         # Smithery configuration
├── package.json          # Project dependencies and scripts
└── README.md             # This file
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with `npm run dev`
5. Submit a pull request

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0) - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original Python implementation by [cbcoutinho](https://github.com/cbcoutinho/nextcloud-mcp-server)
- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Deployable via [Smithery](https://smithery.ai/)
