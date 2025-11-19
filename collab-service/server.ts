import 'dotenv/config'; 
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from '@y/websocket-server/utils';
import jwt, { JwtPayload } from 'jsonwebtoken';

const PORT = Number(process.env.PORT || 1234);
const JWT_SECRET = process.env.COLLAB_JWT_SECRET || process.env.JWT_SECRET || 'default-secret';

const wss = new WebSocketServer({ 
  port: PORT ,
  // 添加跨域配置
  verifyClient: (info, done) => {
    // 允许所有来源，生产环境中应限制具体域名
    done(true);
  }
});

wss.on('connection', (ws, req) => {
 // 忽略URL路径，只处理查询参数
 const url = new URL(req.url || '', `http://${req.headers.host}`);
 const docId = url.searchParams.get('docId');
 const token = url.searchParams.get('token');
  
  if (!docId || !token) {
    ws.close(1008, 'Missing docId or token');
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & {
      doc_id?: number;
      user_id?: number;
      type?: string;
    };

    if (decoded.type !== 'collab') {
      throw new Error('Invalid token type');
    }

    if (decoded.doc_id === undefined || String(decoded.doc_id) !== docId) {
      throw new Error('Token doc mismatch');
    }
  } catch (error) {
    console.error('Token validation failed:', (error as Error).message);
    ws.close(1008, 'Invalid token');
    return;
  }
  
  setupWSConnection(ws, req, {
   // 从查询参数获取docName
  docName: url.searchParams.get('docName') || `doc-${docId}`,
  });
});

console.log(`y-websocket server running on ws://localhost:${PORT}`);
