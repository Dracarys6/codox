import 'dotenv/config';
import { WebSocket, WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { setupWSConnection } from '@y/websocket-server/utils';
import jwt, { JwtPayload } from 'jsonwebtoken';

// --- 配置部分 ---
const PORT = Number(process.env.PORT || 1234);
// 文档协作专用密钥 (从环境变量读取，与 cpp-service 的 jwt_secret 保持一致)
const COLLAB_JWT_SECRET =process.env.COLLAB_JWT_SECRET || 'default-secret';
const CHAT_JWT_SECRET =process.env.CHAT_JWT_SECRET || 'default-secret';
const CHAT_API_BASE = process.env.CHAT_API_BASE || 'http://localhost:8080/api';

console.log('-----------------------------------------');
console.log(`服务启动在端口: ${PORT}`);
console.log('协作服务 JWT 密钥 (前5位):', COLLAB_JWT_SECRET.substring(0, 5) + '...');
console.log('聊天/通知服务 JWT 密钥 (前5位):', CHAT_JWT_SECRET.substring(0, 5) + '...');
console.log('-----------------------------------------');

// --- 类型定义 ---
type ConnectionStatus = 'collab' | 'chat';

interface ChatContext {
  roomId: number;
  userId: number;
  token: string;
}

type ChatSocket = WebSocket & { chatContext?: ChatContext };

interface ChatMessagePayload {
  type: 'join' | 'message' | 'typing' | 'read';
  room_id: number;
  content?: string;
  message_type?: string;
  reply_to?: number;
  message_id?: number;
}

// --- 全局状态存储 ---
const roomSockets = new Map<number, Set<ChatSocket>>();
// 【新增】存储通知连接：Map<UserId, Set<WebSocket>>
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

  // 【关键修改：正确的路由分发】
  if (pathname.startsWith('/chat')) {
    console.log('[ROUTING] -> 进入聊天处理器');
    handleChatConnection(ws as ChatSocket, url);
  } else if (pathname.startsWith('/ws/notifications')) {
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

// 2. 【新增】通知连接处理器
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
    // 使用 CHAT_JWT_SECRET (用户身份密钥) 进行验证
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

// 3. 聊天连接处理器 (保持原有逻辑，稍加日志)
function handleChatConnection(ws: ChatSocket, url: URL) {
  const roomIdParam = url.searchParams.get('room_id');
  const token = url.searchParams.get('token');
  if (!roomIdParam || !token) {
    console.error('[CHAT ERROR] Missing params');
    ws.close(1008, 'Missing room_id or token');
    return;
  }

  const roomId = Number(roomIdParam);
  if (!Number.isInteger(roomId) || roomId <= 0) {
    console.error('[CHAT ERROR] Invalid room_id');
    ws.close(1008, 'Invalid room_id');
    return;
  }

  let userId = 0;
  try {
    const decoded = jwt.verify(token, CHAT_JWT_SECRET) as JwtPayload & { user_id?: number };
    if (!decoded.user_id) {
      throw new Error('Token missing user_id');
    }
    userId = decoded.user_id;
  } catch (error) {
    console.error('[CHAT AUTH FAILED]', (error as Error).message);
    ws.close(1008, 'Invalid token');
    return;
  }

  console.log(`[CHAT SUCCESS] 用户 ${userId} 加入房间 ${roomId}`);
  const context: ChatContext = { roomId, userId, token };
  ws.chatContext = context;
  addSocketToRoom(roomId, ws);

  ws.on('message', (raw) => {
    handleChatMessage(ws, raw);
  });

  ws.on('close', () => {
    console.log(`[CHAT DISCONNECT] 用户 ${userId} 离开房间 ${roomId}`);
    removeSocketFromRoom(roomId, ws);
  });

  ws.send(JSON.stringify({ type: 'join', room_id: roomId, user_id: userId }));
}


// --- 聊天辅助函数 (保持不变) ---
function addSocketToRoom(roomId: number, ws: ChatSocket) {
  if (!roomSockets.has(roomId)) {
    roomSockets.set(roomId, new Set());
  }
  roomSockets.get(roomId)!.add(ws);
}

function removeSocketFromRoom(roomId: number, ws: ChatSocket) {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;
  sockets.delete(ws);
  if (sockets.size === 0) {
    roomSockets.delete(roomId);
  }
}

function broadcast(roomId: number, payload: Record<string, unknown>, exclude?: ChatSocket) {
  const sockets = roomSockets.get(roomId);
  if (!sockets) return;
  const data = JSON.stringify(payload);
  sockets.forEach((socket) => {
    if (socket !== exclude && socket.readyState === WebSocket.OPEN) {
      socket.send(data);
    }
  });
}

function handleChatMessage(socket: ChatSocket, raw: WebSocket.RawData) {
  const ctx = socket.chatContext;
  if (!ctx) {
    socket.close(1011, 'Context missing');
    return;
  }

  let payload: ChatMessagePayload;
  try {
    payload = JSON.parse(raw.toString());
  } catch (error) {
    console.error('Invalid chat payload', error);
    socket.send(JSON.stringify({ type: 'error', message: 'Invalid payload' }));
    return;
  }

  switch (payload.type) {
    case 'message':
      if (!payload.content || !payload.content.trim()) {
        socket.send(JSON.stringify({ type: 'error', message: 'Content is required' }));
        return;
      }
      forwardChatMessage(ctx, payload).catch((error) => {
        console.error('Failed to forward chat message', error);
        socket.send(JSON.stringify({ type: 'error', message: 'Failed to send message' }));
      });
      break;
    case 'typing':
      broadcast(ctx.roomId, { type: 'typing', room_id: ctx.roomId, user_id: ctx.userId }, socket);
      break;
    case 'read':
      if (payload.message_id) {
        markMessageRead(ctx, payload.message_id).catch((error) => {
          console.error('Failed to mark read', error);
        });
      }
      break;
    case 'join':
    default:
      break;
  }
}

async function forwardChatMessage(ctx: ChatContext, payload: ChatMessagePayload) {
  // 这里需要确保 CHAT_API_BASE 是正确的 C++ 后端地址
  const response = await fetch(`${CHAT_API_BASE}/chat/rooms/${ctx.roomId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify({
      content: payload.content,
      message_type: payload.message_type || 'text',
      reply_to: payload.reply_to,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText);
  }

  const savedMessage = await response.json();
  broadcast(ctx.roomId, { type: 'message', ...savedMessage });
}

async function markMessageRead(ctx: ChatContext, messageId: number) {
  await fetch(`${CHAT_API_BASE}/chat/messages/${messageId}/read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ctx.token}`,
    },
    body: JSON.stringify({}),
  });
}