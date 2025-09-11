const { exec } = require('child_process');
const http = require('http');

function openUrl(url) {
    const command = process.platform === 'win32' ? 'start' : 'open';
    exec(`${command} "${url}"`);
}

function checkTunnel() {
    http.get('http://localhost:4040/api/tunnels', (res) => {
        let data = '';
        res.on('data', (chunk) => {
            data += chunk;
        });
        res.on('end', () => {
            try {
                const tunnels = JSON.parse(data).tunnels;
                const tunnel = tunnels.find(t => t.proto === 'https');
                if (tunnel) {
                    openUrl(`https://mcp.smithery.com/?connect=${tunnel.public_url}`);
                } else {
                    setTimeout(checkTunnel, 1000);
                }
            } catch (e) {
                setTimeout(checkTunnel, 1000);
            }
        });
    }).on('error', () => {
        setTimeout(checkTunnel, 1000);
    });
}

setTimeout(checkTunnel, 3000); // Wait for localtunnel to start