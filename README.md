# Nextcloud MCP Server

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

The server provides integration with multiple Nextcloud apps, enabling LLMs to interact with your Nextcloud data through a comprehensive set of **29 tools** across 5 main categories.

## Supported Nextcloud Apps

| App | Support Status | Description |
|-----|----------------|-------------|
| **Notes** | ✅ Full Support | Create, read, update, delete, search, and append to notes. |
| **Calendar** | ✅ Full Support | Complete calendar integration - manage calendars and events via CalDAV. |
| **Tables** | ✅ Full Support | Complete table operations - list tables, get schemas, and perform CRUD operations on rows. |
| **Files (WebDAV)** | ✅ Full Support | Complete file system access - browse directories, read/write files, create/delete resources. |
| **Contacts** | ✅ Full Support | Create, read, update, and delete contacts and address books via CardDAV. |

## Available Tools (29 Total)

### 📝 Notes Tools (5 tools)

| Tool | Description |
|------|-------------|
| `nc_notes_create_note` | Create a new note with title, content, and category |
| `nc_notes_update_note` | Update an existing note by ID with optional title, content, or category |
| `nc_notes_append_content` | Append content to an existing note with a clear separator |
| `nc_notes_search_notes` | Search notes by title or content with result filtering |
| `nc_notes_delete_note` | Delete a note by ID |

### 📅 Calendar Tools (6 tools)

| Tool | Description |
|------|-------------|
| `nc_calendar_list_calendars` | List all available calendars for the user |
| `nc_calendar_create_event` | Create a calendar event with summary, description, dates, and location |
| `nc_calendar_list_events` | List events from a calendar with optional date filtering |
| `nc_calendar_get_event` | Get detailed information about a specific event |
| `nc_calendar_update_event` | Update any aspect of an existing event |
| `nc_calendar_delete_event` | Delete a calendar event |

### 👥 Contacts Tools (6 tools)

| Tool | Description |
|------|-------------|
| `nc_contacts_list_addressbooks` | List all available addressbooks for the user |
| `nc_contacts_create_addressbook` | Create a new addressbook with display name and description |
| `nc_contacts_delete_addressbook` | Delete an addressbook by ID |
| `nc_contacts_list_contacts` | List all contacts in a specific addressbook |
| `nc_contacts_create_contact` | Create a new contact with full name, emails, phones, addresses, and organizations |
| `nc_contacts_delete_contact` | Delete a contact from an addressbook |

### 📊 Tables Tools (6 tools)

| Tool | Description |
|------|-------------|
| `nc_tables_list_tables` | List all tables available to the user |
| `nc_tables_get_schema` | Get the schema/structure of a specific table including columns |
| `nc_tables_read_table` | Read all rows from a table |
| `nc_tables_insert_row` | Insert a new row into a table with key-value data |
| `nc_tables_update_row` | Update an existing row in a table |
| `nc_tables_delete_row` | Delete a row from a table |

### 📁 WebDAV File System Tools (5 tools)

| Tool | Description |
|------|-------------|
| `nc_webdav_list_directory` | List files and directories in any Nextcloud path |
| `nc_webdav_read_file` | Read file content from Nextcloud |
| `nc_webdav_write_file` | Create or update files in Nextcloud with content |
| `nc_webdav_create_directory` | Create new directories in Nextcloud |
| `nc_webdav_delete_resource` | Delete files or directories from Nextcloud |

### 🧪 Test Tool (1 tool)

| Tool | Description |
|------|-------------|
| `hello` | Verify server connectivity and list all available tools |

## Installation

### Prerequisites

*   Node.js 18+
*   Access to a Nextcloud instance
*   npm or yarn package manager

### Local Development Setup

1.  Clone the repository:
    ```bash
    git clone https://github.com/your-username/nextcloud-mcp-server.git
    cd nextcloud-mcp-server
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
   - Run the `hello` tool to verify all 29 tools are available
   - Check the server logs for any initialization errors

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

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Original Python implementation by [cbcoutinho](https://github.com/cbcoutinho/nextcloud-mcp-server)
- Built with [Model Context Protocol](https://modelcontextprotocol.io/)
- Deployable via [Smithery](https://smithery.ai/)