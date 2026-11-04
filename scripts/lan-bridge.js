/**
 * RALT Logistics LAN Bridge
 * 
 * Bridges Docker container port 5001 (listening on 127.0.0.1) to 0.0.0.0:5001
 * so physical mobile devices on the same Wi-Fi network can connect to the local backend.
 */

const net = require('net');

const PORT = 5001;
const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 5001;

const server = net.createServer((clientSocket) => {
  const backendSocket = net.connect(TARGET_PORT, TARGET_HOST);

  clientSocket.pipe(backendSocket);
  backendSocket.pipe(clientSocket);

  clientSocket.on('error', (err) => {
    // Suppress expected client disconnects
    if (err.code !== 'ECONNRESET') {
      console.warn('[LAN Bridge] Client socket warning:', err.message);
    }
    backendSocket.destroy();
  });

  backendSocket.on('error', (err) => {
    // Suppress expected backend disconnects
    if (err.code !== 'ECONNRESET') {
      console.warn('[LAN Bridge] Backend socket warning:', err.message);
    }
    clientSocket.destroy();
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[LAN Bridge] Port ${PORT} already bound or in use.`);
  } else {
    console.error('[LAN Bridge] Server error:', err);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[LAN Bridge] Ready. Forwarding 0.0.0.0:${PORT} -> ${TARGET_HOST}:${TARGET_PORT}`);
});

