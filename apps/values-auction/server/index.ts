import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'node:http';
import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { URL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_PATH = join(__dirname, 'events.log');
const PORT = Number(process.env.PORT ?? 8787);

interface Client {
  ws: WebSocket;
  sessionId: string;
  role: string;
  id: string;
}

const clientsBySession = new Map<string, Set<Client>>();

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('values-auction ws hub — connect via /ws');
});

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const sessionId = url.searchParams.get('session') ?? 'default';
  const role = url.searchParams.get('role') ?? 'participant';
  const id = url.searchParams.get('id') ?? `c_${Math.random().toString(36).slice(2)}`;

  const client: Client = { ws, sessionId, role, id };
  let set = clientsBySession.get(sessionId);
  if (!set) {
    set = new Set();
    clientsBySession.set(sessionId, set);
  }
  set.add(client);

  ws.on('message', async (data) => {
    const raw = data.toString('utf8');
    try {
      const parsed = JSON.parse(raw);
      await appendFile(
        LOG_PATH,
        JSON.stringify({ sessionId, at: Date.now(), from: id, role, msg: parsed }) + '\n',
      );
      const peers = clientsBySession.get(sessionId);
      if (!peers) return;
      for (const peer of peers) {
        if (peer.ws !== ws && peer.ws.readyState === WebSocket.OPEN) {
          peer.ws.send(raw);
        }
      }
    } catch (err) {
      console.error('malformed message', err);
    }
  });

  ws.on('close', () => {
    const peers = clientsBySession.get(sessionId);
    peers?.delete(client);
    if (peers && peers.size === 0) clientsBySession.delete(sessionId);
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[values-auction] ws hub listening on ws://localhost:${PORT}`);
});
