import 'dotenv/config';
import { WebSocket, WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from '@y/websocket-server/utils';
import jwt, { JwtPayload } from 'jsonwebtoken';

// --- 配置部分 ---
const PORT = Number(process.env.PORT || 1234);
// 文档协作专用密钥 (从环境变量读取，与 cpp-service 的 jwt_secret 保持一致)
const COLLAB_JWT_SECRET = process.env.COLLAB_JWT_SECRET || 'default-secret';

console.log('-----------------------------------------');
console.log(`服务启动在端口: ${PORT}`);
console.log('协作服务 JWT 密钥 (前5位):', COLLAB_JWT_SECRET.substring(0, 5) + '...');
console.log('-----------------------------------------');

// --- 全局状态存储 ---
const notificationSockets = new Map<number, Set<WebSocket>>();


// --- WebSocket 服务器初始化 ---
const wss = new WebSocketServer({
  port: PORT,
  verifyClient: (info, done) => {
    // 可以在这里打印连接尝试信息
    // console.log('Verify client origin:', info.origin);
    done(true);
  },
});


// --- 主连接路由处理器 ---
wss.on('connection', (ws, req) => {
  const requestUrl = req.url || '';
  console.log(`[NEW CONNECTION] 收到连接请求: ${requestUrl}`);

  const url = new URL(requestUrl, `http://${req.headers.host}`);
  const pathname = url.pathname || '/';

  console.log(`[ROUTING] 解析路径: ${pathname}`);

  if (pathname.startsWith('/ws/notifications')) {
    console.log('[ROUTING] -> 进入通知处理器');
    handleNotificationConnection(ws, url);
  } else {
    console.log('[ROUTING] -> 进入默认文档协作处理器');
    handleCollabConnection(ws, req, url);
  }
});


// --- 处理器实现 ---

// 1. 文档协作连接处理器
function handleCollabConnection(ws: WebSocket, req: any, url: URL) {
 const docId = url.searchParams.get('docId');
 const token = url.searchParams.get('token');
  if (!docId || !token) {
    console.error('[COLLAB ERROR] 缺少 docId 或 token，关闭连接');
    ws.close(1008, 'Missing docId or token');
    return;
  }

  try {
    const decoded = jwt.verify(token, COLLAB_JWT_SECRET) as JwtPayload & {
      doc_id?: number;
      type?: string;
    };
    // 增强的 Token 校验
    if (decoded.type !== 'collab') {
      throw new Error(`Token type error. Expected 'collab', got '${decoded.type}'`);
    }
    // 确保 doc_id 存在且匹配 (处理数字/字符串比较)
    if (decoded.doc_id === undefined || String(decoded.doc_id) !== String(docId)) {
      throw new Error(`Token docId mismatch. Token: ${decoded.doc_id}, URL: ${docId}`);
    }
    console.log(`[COLLAB SUCCESS] 文档 ${docId} 连接成功`);

  } catch (error) {
    console.error('[COLLAB AUTH FAILED] Token 验证失败:', (error as Error).message);
    ws.close(1008, 'Invalid token');
    return;
  }

  setupWSConnection(ws, req, {
    docName: url.searchParams.get('docName') || `doc-${docId}`,
  });
}

// 2. 通知连接处理器
function handleNotificationConnection(ws: WebSocket, url: URL) {
  const token = url.searchParams.get('token');
  if (!token) {
    console.error('[NOTIF ERROR] 缺少 token');
    ws.close(1008, 'Missing token');
    return;
  }

  let userId = 0;
  try {
    console.log('[NOTIF AUTH] 开始验证 Token...');
    const decoded = jwt.verify(token, COLLAB_JWT_SECRET) as JwtPayload;

    if (!decoded || !decoded.user_id) {
       throw new Error('Token missing user_id field');
    }

    // 确保转换为数字
    userId = Number(decoded.user_id);
    if (isNaN(userId) || userId <= 0) {
        throw new Error(`Invalid user_id format: ${decoded.user_id}`);
    }

    console.log(`[NOTIF AUTH SUCCESS] 用户 ID: ${userId} 验证通过`);

  } catch (error) {
    // 【重要】如果密钥不对，你会在这里看到错误
    console.error('[NOTIF AUTH FAILED] Token 验证失败:', (error as Error).message);
    ws.close(1008, 'Invalid token');
    return;
  }

  // 将连接加入管理集合
  if (!notificationSockets.has(userId)) {
    notificationSockets.set(userId, new Set());
  }
  notificationSockets.get(userId)!.add(ws);

  console.log(`[NOTIF CONNECTED] 用户 ${userId} 已加入通知通道 (当前连接数: ${notificationSockets.get(userId)?.size})`);

  // 连接关闭时的清理
  ws.on('close', () => {
    const userSockets = notificationSockets.get(userId);
    if (userSockets) {
      userSockets.delete(ws);
      console.log(`[NOTIF DISCONNECT] 用户 ${userId} 断开了一个连接 (剩余连接数: ${userSockets.size})`);
      if (userSockets.size === 0) {
        notificationSockets.delete(userId);
      }
    }
  });

  // 发送一个欢迎消息确认连接成功
  ws.send(JSON.stringify({ type: 'system', message: 'Notification channel connected' }));
}