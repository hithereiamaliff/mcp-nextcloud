# Nextcloud MCP Server

[![smithery badge](https://smithery.ai/badge/@hithereiamaliff/mcp-nextcloud)](https://smithery.ai/server/@hithereiamaliff/mcp-nextcloud)

> **Note:** This project is a complete rewrite in TypeScript of the original Python-based [cbcoutinho/nextcloud-mcp-server](https://github.com/cbcoutinho/nextcloud-mcp-server), now with **Smithery deployment support** for one-click cloud deployment.
>
> ### Key Differences from the Original Repository:
> *   **Language:** This project is written in TypeScript, while the original is in Python.
> *   **Smithery Support:** Added full support for Smithery deployment and local testing via Smithery playground.
> *   **Project Structure:** The project structure has been adapted for a Node.js/TypeScript environment with MCP SDK integration.
> *   **Dependencies:** This project uses npm for package management, whereas the original uses Python's dependency management tools.
> *   **Deployment:** Now supports both local development and cloud deployment via Smithery.

The Nextcloud MCP (Model Context Protocol) server allows Large Language Models (LLMs) like OpenAI's GPT, Google's Gemini, or Anthropic's Claude to interact with your Nextcloud instance. This enables automation of various Nextcloud actions across Notes, Calendar, Contacts, Tables, and WebDAV file operations.

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

The crown jewel of this MCP server is the powerful **unified search system** for WebDAV files, inspired by modern search interfaces like mcp-datagovmy. This completely transforms how you interact with your Nextcloud files by eliminating the need to specify exact file paths.

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
# .env
NEXTCLOUD_HOST=https://your.nextcloud.instance.com
NEXTCLOUD_USERNAME=your_nextcloud_username
NEXTCLOUD_PASSWORD=your_nextcloud_app_password_or_login_password
```

**Important Security Note:** Use a dedicated Nextcloud App Password instead of your regular login password. Generate one in your Nextcloud Security settings.

### Smithery Configuration

When deploying via Smithery, you can configure credentials through:
- Environment variables (as above)
- Smithery configuration interface (recommended for cloud deployment)

## Deployment & Usage

### Local Development with Smithery Playground

The fastest way to test your server locally:

```bash
npm run dev
```

This will:
1. Build the TypeScript project
2. Start the Smithery development server
3. Automatically open the Smithery playground in your browser
4. Connect to your local server for immediate testing

### Cloud Deployment via Smithery

1. Ensure your project is configured:
   ```bash
   npm run build
   ```

2. Deploy to Smithery:
   ```bash
   npm run deploy
   ```

3. Follow the Smithery deployment prompts to configure your Nextcloud credentials securely.

### Manual Local Development

For traditional local development:

```bash
npm run start
```

The server will start and listen for MCP connections.

## Smithery Integration

This project includes full Smithery support with:

- **`smithery.yaml`**: Specifies TypeScript runtime
- **Development server**: Local testing with hot reload
- **One-click deployment**: Deploy to cloud with a single command
- **Configuration management**: Secure credential handling
- **Playground integration**: Immediate testing interface

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

## Development

### Project Structure

```
├── src/
│   ├── index.ts          # Main Smithery entry point
│   ├── app.ts            # Legacy entry point
│   ├── client/           # Nextcloud API clients
│   ├── models/           # TypeScript interfaces
│   └── server/           # Tool implementations
├── smithery.yaml         # Smithery configuration
├── package.json          # Project dependencies and scripts
└── README.md            # This file
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