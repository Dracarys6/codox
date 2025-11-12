import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from '@y/websocket-server/utils';

const wss = new WebSocketServer({ port: 1234 });

wss.on('connection', (ws, req) => {
  // 从 URL 或 headers 中获取文档 ID 和用户信息
  const url = new URL(req.url || '', 'http://localhost');
  const docId = url.searchParams.get('docId');
  const token = url.searchParams.get('token');
  
  // TODO: 验证 token（从业务后端验证）
  
  setupWSConnection(ws, req, {
    docName: `doc-${docId}`, // 房间名称
  });
});

console.log('y-websocket server running on ws://localhost:1234');
