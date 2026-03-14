# VPS Deployment Guide for Nextcloud MCP

This guide explains how to deploy the Nextcloud MCP server on your VPS at `mcp.techmavie.digital/nextcloud`.

## Prerequisites

- VPS with Ubuntu/Debian
- Docker and Docker Compose installed
- Nginx installed
- Domain `mcp.techmavie.digital` pointing to your VPS IP
- SSL certificate (via Certbot/Let's Encrypt)
- Nextcloud instance with credentials

## Architecture

```
Client (Claude, Cursor, etc.)
    ↓ HTTPS
https://mcp.techmavie.digital/nextcloud/mcp
    ↓
Nginx (SSL termination + reverse proxy)
    ↓ HTTP
Docker Container (port 8085 → 8080)
    ↓
Your Nextcloud Instance
```

## Deployment Steps

### 1. SSH into your VPS

```bash
ssh root@your-vps-ip
```

### 2. Create directory for the MCP server

```bash
mkdir -p /opt/mcp-servers/nextcloud
cd /opt/mcp-servers/nextcloud
```

### 3. Clone the repository

```bash
git clone https://github.com/hithereiamaliff/mcp-nextcloud.git .
```

### 4. Create environment file

```bash
cp .env.sample .env
nano .env
```

Add your server configuration:
```env
# --- Choose one auth mode ---

# Option A: Key Service mode (multi-user, recommended for hosted deployment)
MCP_API_KEY=your-generated-api-key-here  # required for /analytics admin access
KEY_SERVICE_URL=https://mcpkeys.techmavie.digital/internal/resolve
KEY_SERVICE_TOKEN=your-key-service-bearer-token

# Option B: Self-hosted mode (single-operator)
# Leave KEY_SERVICE_URL and KEY_SERVICE_TOKEN unset, then keep MCP_API_KEY set.
# MCP_API_KEY=your-generated-api-key-here  # openssl rand -hex 32

# --- Optional ---
ALLOWED_ORIGINS=https://smithery.ai,https://claude.ai
```

> **Security Notes:**
> - Do NOT add `NEXTCLOUD_HOST`, `NEXTCLOUD_USERNAME`, or `NEXTCLOUD_PASSWORD` to this file. The HTTP server never uses environment variables for Nextcloud credentials.
> - In Key Service mode, user API keys (`usr_...`) are resolved automatically.
> - In Self-Hosted mode, each client provides credentials via `X-Nextcloud-*` headers.
> - Generate a strong API key: `openssl rand -hex 32`

### 5. Build and start the Docker container

```bash
docker compose up -d --build
```

### 6. Verify the container is running

```bash
docker compose ps
docker compose logs -f
```

### 7. Test the health endpoint

```bash
curl http://localhost:8085/health
```

### 8. Configure Nginx

Add the location block from `deploy/nginx-mcp.conf` to your existing nginx config for `mcp.techmavie.digital`:

```bash
# Edit your existing nginx config
sudo nano /etc/nginx/sites-available/mcp.techmavie.digital

# Add the location block from deploy/nginx-mcp.conf inside the server block
# Make sure it's at the same level as other location blocks (not nested)

# Test nginx config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 9. Test the MCP endpoint

```bash
# Test health endpoint (no auth required)
curl https://mcp.techmavie.digital/nextcloud/health

# Test MCP endpoint — Key Service mode
curl -X POST "https://mcp.techmavie.digital/nextcloud/mcp?api_key=usr_XXXXXXXX" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Test MCP endpoint — Self-Hosted mode
curl -X POST https://mcp.techmavie.digital/nextcloud/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -H "X-API-Key: your-api-key" \
  -H "X-Nextcloud-Host: https://cloud.example.com" \
  -H "X-Nextcloud-Username: your_user" \
  -H "X-Nextcloud-Password: your_app_password" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Client Configuration

### Key Service Mode (recommended)

```json
{
  "mcpServers": {
    "nextcloud": {
      "transport": "streamable-http",
      "url": "https://mcp.techmavie.digital/nextcloud/mcp?api_key=usr_XXXXXXXX"
    }
  }
}
```

### Self-Hosted Mode (requires custom headers)

```json
{
  "mcpServers": {
    "nextcloud": {
      "transport": "streamable-http",
      "url": "https://mcp.techmavie.digital/nextcloud/mcp",
      "headers": {
        "X-API-Key": "your-api-key",
        "X-Nextcloud-Host": "https://cloud.example.com",
        "X-Nextcloud-Username": "your_user",
        "X-Nextcloud-Password": "your_app_password"
      }
    }
  }
}
```

> If your MCP client cannot send custom headers, use Key Service mode or the local CLI/stdio mode.

### For MCP Inspector

```bash
npx @modelcontextprotocol/inspector
# Select "Streamable HTTP"
# Key Service mode: Enter URL with ?api_key=usr_XXXXXXXX
# Self-Hosted mode: Enter URL and add headers: X-API-Key, X-Nextcloud-Host, X-Nextcloud-Username, X-Nextcloud-Password
```

## Management Commands

### View logs

```bash
cd /opt/mcp-servers/nextcloud
docker compose logs -f
```

### Restart the server

```bash
docker compose restart
```

### Update to latest version

```bash
git pull origin main
docker compose up -d --build
```

### Stop the server

```bash
docker compose down
```

## GitHub Actions Auto-Deploy

The repository includes a GitHub Actions workflow (`.github/workflows/deploy-vps.yml`) that automatically deploys to your VPS when you push to the `main` branch.

### Required GitHub Secrets

Set these in your repository settings (Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `VPS_HOST` | Your VPS IP address |
| `VPS_USERNAME` | SSH username (e.g., root) |
| `VPS_SSH_KEY` | Your private SSH key |
| `VPS_PORT` | SSH port (usually 22) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | HTTP server port (internal) |
| `HOST` | 0.0.0.0 | Bind address |
| `MCP_API_KEY` | - | API key for self-hosted `/mcp` auth and `/analytics` admin access |
| `KEY_SERVICE_URL` | - | MCP Key Service endpoint (enables key service mode) |
| `KEY_SERVICE_TOKEN` | - | Bearer token for key service authentication |
| `ALLOWED_ORIGINS` | `https://smithery.ai,https://claude.ai` | Comma-separated list of browser origins allowed by CORS |

## Analytics Dashboard

The MCP server includes a built-in analytics dashboard:

- **Dashboard:** `https://mcp.techmavie.digital/nextcloud/analytics/dashboard`
- **API:** `https://mcp.techmavie.digital/nextcloud/analytics`
- Enter the API key inside the dashboard page when prompted. Do not add it to the URL.

Features:
- Total requests and tool calls
- Tool usage distribution (doughnut chart)
- Hourly request trends (last 24 hours)
- Recent tool calls feed
- Auto-refreshes every 30 seconds

## Troubleshooting

### Container not starting

```bash
docker compose logs mcp-nextcloud
```

### Nginx 502 Bad Gateway

- Check if container is running: `docker compose ps`
- Check container logs: `docker compose logs`
- Verify port binding: `docker port mcp-nextcloud`

### Authentication errors

- Verify your Nextcloud credentials are correct
- Make sure you're using an App Password if 2FA is enabled
- Check that the Nextcloud host URL is correct (include https://)

### Test MCP connection

```bash
# List tools (Key Service mode)
curl -X POST "https://mcp.techmavie.digital/nextcloud/mcp?api_key=usr_XXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# Call hello tool (Key Service mode)
curl -X POST "https://mcp.techmavie.digital/nextcloud/mcp?api_key=usr_XXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nextcloud_hello","arguments":{}}}'
```

## Port Allocation

Based on your existing MCP servers:
- **8180** - Malaysia Transit MCP
- **3003** - Keywords Everywhere MCP
- **8083** - Malaysia Open Data MCP
- **8084** - GitHub MCP
- **8085** - Nextcloud MCP (this server)

## Security Notes

- The MCP server runs behind nginx with SSL
- In Key Service mode, user API keys are resolved server-side — no raw credentials in transit from the client
- In Self-Hosted mode, each request requires `X-API-Key` plus `X-Nextcloud-*` headers
- The HTTP server never uses `NEXTCLOUD_*` environment variables for credentials
- Use App Passwords instead of your main Nextcloud password
- Consider adding rate limiting at nginx level if needed
