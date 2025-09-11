"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Protocol {
    _transport;
    constructor(options) { }
    async connect(transport) {
        this._transport = transport;
        this._transport.onmessage = (message, extra) => {
            if ("id" in message && ("result" in message || "error" in message)) {
                // For simplicity, we are not handling responses in this minimal implementation
            } else if ("id" in message) {
                // For simplicity, we are not handling requests in this minimal implementation
            } else {
                // For simplicity, we are not handling notifications in this minimal implementation
            }
        };
        await this._transport.start();
    }
}
exports.Protocol = Protocol;

class Server extends Protocol {
    constructor(serverInfo, options) {
        super(options);
    }
    tool(name, tool) { }
    resource(uri, resource) { }
    lifespan(callback) { }
    start() { }
}
exports.Server = Server;

class StreamableHttpServerTransport {
    onmessage;
    _res;
    constructor(options) { }
    async handleRequest(req, res, parsedBody) {
        this._res = res;
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                if (this.onmessage) {
                    this.onmessage(JSON.parse(body));
                }
            });
        }
    }
    async start() { }
    async close() { }
    async send(message, options) {
        if (this._res) {
            this._res.writeHead(200, { 'Content-Type': 'application/json' });
            this._res.end(JSON.stringify({ jsonrpc: "2.0", id: message.id, result: { protocolVersion: "2025-06-18", capabilities: {}, serverInfo: { name: "mcp-nextcloud", version: "1.0.0" } } }));
        }
    }
}
exports.StreamableHttpServerTransport = StreamableHttpServerTransport;