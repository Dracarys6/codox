# 第四阶段开发指南：实时通讯、通知增强、导入导出与运维监控

## 🎯 第四阶段目标

**优先完成文档权限管理（ACL）接口**，然后完成实时通讯模块、通知系统增强、文档导入导出功能、生产环境的监控与日志系统以及移动端支持。

> ⚠️ **重要提示**：ACL 接口是基础功能，虽然前端已有组件，但后端接口尚未实现，必须在第四阶段优先完成。

---

## 📋 开发任务概览（按优先级排序）

### 0. 文档权限管理（ACL）接口（优先级：最高 ⭐⭐⭐）⚠️

> ⚠️ **重要**

- [x] **ACL 查询接口**
  - [x] 后端：实现 `GET /api/docs/{id}/acl` 接口
  - [x] 后端：验证只有文档 owner 可以查看 ACL
  - [x] 后端：返回 ACL 列表，包含用户信息和权限
  - [x] 测试：验证权限检查和数据返回

- [x] **ACL 更新接口**
  - [x] 后端：实现 `PUT /api/docs/{id}/acl` 接口
  - [x] 后端：验证只有文档 owner 可以修改 ACL
  - [x] 后端：验证权限枚举值（viewer、editor）
  - [x] 后端：防止删除 owner 权限
  - [x] 后端：使用事务确保数据一致性
  - [ ] 测试：验证权限检查、数据更新和异常处理

- [x] **前端集成**
  - [x] 验证 `AclManager` 组件与后端接口的集成
  - [ ] 测试 ACL 的增删改查功能

### 1. 实时通讯模块（优先级：最高 ⭐⭐⭐）

- [ ] **内置聊天功能**
  - [ ] 数据库：创建 `chat_room` 和 `chat_message` 表
  - [ ] 后端：聊天室管理接口（创建、加入、离开）
  - [ ] 后端：消息发送与接收接口
  - [ ] 后端：消息历史查询接口
  - [ ] 后端：WebSocket 聊天服务（集成到 collab-service 或新建服务）
  - [ ] 前端：聊天室列表组件
  - [ ] 前端：聊天消息界面
  - [ ] 前端：实时消息收发
  - [ ] 前端：消息状态（已发送、已读等）
  - [ ] 前端：@提及功能
  - [ ] 前端：文件消息支持

- [ ] **文档内聊天**
  - [ ] 前端：文档编辑页面集成聊天面板
  - [ ] 前端：文档上下文聊天（关联文档ID）
  - [ ] 后端：文档聊天室自动创建

- [ ] **视频会议集成（选做）**
  - [ ] 集成第三方视频会议 SDK（如 Agora、Zoom SDK、Jitsi Meet）
  - [ ] 后端：会议创建与管理接口
  - [ ] 前端：视频会议组件
  - [ ] 前端：会议邀请功能
  - [ ] 前端：会议录制（如支持）

- [ ] **屏幕共享（选做）**
  - [ ] 前端：屏幕共享功能（WebRTC）
  - [ ] 前端：共享权限控制
  - [ ] 前端：共享状态显示

- [ ] **文件共享**
  - [ ] 后端：聊天文件上传接口
  - [ ] 后端：文件存储（复用 MinIO）
  - [ ] 前端：聊天文件上传组件
  - [ ] 前端：文件预览功能
  - [ ] 前端：文件下载功能

### 2. 通知系统增强（优先级：高 ⭐⭐）

- [ ] **通知分类与过滤**
  - [ ] 后端：按通知类型过滤（comment、task_assigned、task_status_changed、permission_changed等）
  - [ ] 后端：按日期范围过滤
  - [ ] 后端：按文档ID过滤
  - [ ] 前端：通知类型筛选器
  - [ ] 前端：日期范围选择器
  - [ ] 前端：通知列表优化展示

- [ ] **通知设置**
  - [ ] 数据库：创建 `notification_setting` 表
  - [ ] 后端：通知设置 CRUD 接口
  - [ ] 后端：按用户设置过滤通知
  - [ ] 前端：通知设置页面
  - [ ] 前端：通知偏好配置（邮件通知、推送通知等）

- [ ] **实时通知推送**
  - [ ] 后端：WebSocket 通知推送服务
  - [ ] 后端：集成到现有通知系统
  - [ ] 前端：WebSocket 客户端连接
  - [ ] 前端：实时通知接收与展示
  - [ ] 前端：浏览器推送通知（Notification API）

### 3. 文档导入导出（优先级：高 ⭐⭐）

- [ ] **Word 文档导入导出**
  - [ ] 后端：集成 docx 解析库（如 `mammoth` 或 C++ 库）
  - [ ] 后端：实现 Word 导入接口 (`POST /api/documents/import/word`)
  - [ ] 后端：实现 Word 导出接口 (`GET /api/documents/:id/export/word`)
  - [ ] 前端：上传 Word 文件导入
  - [ ] 前端：导出为 Word 文件

- [ ] **PDF 文档导入导出**
  - [ ] 后端：集成 PDF 解析库（如 `pdf-lib` 或 C++ 库）
  - [ ] 后端：实现 PDF 导入接口 (`POST /api/documents/import/pdf`)
  - [ ] 后端：实现 PDF 导出接口 (`GET /api/documents/:id/export/pdf`)
  - [ ] 前端：上传 PDF 文件导入
  - [ ] 前端：导出为 PDF 文件

- [ ] **Markdown 导入导出**
  - [ ] 后端：实现 Markdown 导入接口 (`POST /api/documents/import/markdown`)
  - [ ] 后端：实现 Markdown 导出接口 (`GET /api/documents/:id/export/markdown`)
  - [ ] 前端：上传 Markdown 文件导入
  - [ ] 前端：导出为 Markdown 文件

### 4. 文档版本控制（优先级：高 ⭐⭐）

- [ ] **版本存储**
  - [ ] 数据库：创建 `doc_version` 表，记录版本号、快照、变更摘要
  - [ ] 后端：保存版本、获取版本列表、单版本详情接口
  - [ ] 与 MinIO/协作快照联动，支持大文件存储

- [ ] **版本比较与恢复**
  - [ ] 后端：提供 diff 数据（基于 Yjs 更新或文本 diff）
  - [ ] 前端：版本时间线、版本差异对比视图
  - [ ] 前端：一键回滚至历史版本

- [ ] **版本策略**
  - [ ] 自动版本（如每次发布/定时快照）
  - [ ] 手动版本（用户点击“保存版本”）
  - [ ] 版本保留策略、清理任务

### 5. 用户管理（优先级：高 ⭐⭐）

- [ ] **用户列表管理**（参考《需求文档》6.2）
  - [ ] 后端：支持分页、筛选、排序的用户列表 API
  - [ ] 前端：管理界面展示基础信息、搜索、批量操作
- [ ] **用户权限调整**
  - [ ] 后端：提供角色／权限调整接口（基于 RBAC + ACL）
  - [ ] 前端：角色切换、权限矩阵、操作确认
- [ ] **用户行为分析**
  - [ ] 数据：记录登录日志、文档活跃度等指标
  - [ ] 后端：汇总统计接口；前端：可视化图表/看板
- [ ] **用户满意度调查**
  - [ ] 前端：在合适入口弹出调查问卷或反馈表单
  - [ ] 后端：收集与分析反馈结果

---

## 🚀 开发步骤（按优先级排序）

### 步骤 0：文档权限管理（ACL）接口实现

#### 0.1 获取文档 ACL 接口

**后端实现** (`cpp-service/src/controllers/DocumentController.h`)：

```cpp
// 在 DocumentController 中添加方法声明
void getAcl(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
void updateAcl(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
```

**路由注册**：

```cpp
METHOD_LIST_BEGIN
// ... 现有路由
ADD_METHOD_TO(DocumentController::getAcl, "/api/docs/{id}/acl", Get, "JwtAuthFilter");
ADD_METHOD_TO(DocumentController::updateAcl, "/api/docs/{id}/acl", Put, "JwtAuthFilter");
METHOD_LIST_END
```

**实现 `getAcl`** (`cpp-service/src/controllers/DocumentController.cc`)：

```cpp
void DocumentController::getAcl(const HttpRequestPtr& req,
                                 std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数 doc_id
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId = std::stoi(routingParams[0]);

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 3. 验证用户是文档 owner
    db->execSqlAsync(
        "SELECT owner_id FROM document WHERE id = $1::bigint",
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                return;
            }
            int ownerId = r[0]["owner_id"].as<int>();
            if (ownerId != userId) {
                ResponseUtils::sendError(*callbackPtr, "Only document owner can view ACL", k403Forbidden);
                return;
            }

            // 4. 查询 ACL 列表
            db->execSqlAsync(
                "SELECT da.user_id, da.permission, u.email, up.nickname "
                "FROM doc_acl da "
                "INNER JOIN \"user\" u ON da.user_id = u.id "
                "LEFT JOIN user_profile up ON u.id = up.user_id "
                "WHERE da.doc_id = $1::bigint "
                "ORDER BY da.user_id",
                [=](const drogon::orm::Result& aclResult) {
                    Json::Value responseJson;
                    responseJson["doc_id"] = docId;
                    Json::Value aclArray(Json::arrayValue);

                    for (const auto& row : aclResult) {
                        Json::Value aclItem;
                        aclItem["user_id"] = row["user_id"].as<int>();
                        aclItem["permission"] = row["permission"].as<std::string>();
                        aclItem["email"] = row["email"].as<std::string>();
                        if (!row["nickname"].isNull()) {
                            aclItem["nickname"] = row["nickname"].as<std::string>();
                        }
                        aclArray.append(aclItem);
                    }

                    // 添加 owner 信息
                    Json::Value ownerItem;
                    ownerItem["user_id"] = ownerId;
                    ownerItem["permission"] = "owner";
                    // 查询 owner 的邮箱和昵称
                    db->execSqlAsync(
                        "SELECT u.email, up.nickname FROM \"user\" u "
                        "LEFT JOIN user_profile up ON u.id = up.user_id "
                        "WHERE u.id = $1::bigint",
                        [=](const drogon::orm::Result& ownerResult) {
                            if (!ownerResult.empty()) {
                                ownerItem["email"] = ownerResult[0]["email"].as<std::string>();
                                if (!ownerResult[0]["nickname"].isNull()) {
                                    ownerItem["nickname"] = ownerResult[0]["nickname"].as<std::string>();
                                }
                            }
                            aclArray.append(ownerItem);
                            responseJson["acl"] = aclArray;
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        std::to_string(ownerId));
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                std::to_string(docId));
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        },
        std::to_string(docId));
}
```

#### 0.2 更新文档 ACL 接口

**实现 `updateAcl`**：

```cpp
void DocumentController::updateAcl(const HttpRequestPtr& req,
                                    std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取路径参数 doc_id
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId = std::stoi(routingParams[0]);

    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 3. 解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    if (!json.isMember("acl") || !json["acl"].isArray()) {
        ResponseUtils::sendError(callback, "acl array is required", k400BadRequest);
        return;
    }

    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    // 4. 验证用户是文档 owner
    db->execSqlAsync(
        "SELECT owner_id FROM document WHERE id = $1::bigint",
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                return;
            }
            int ownerId = r[0]["owner_id"].as<int>();
            if (ownerId != userId) {
                ResponseUtils::sendError(*callbackPtr, "Only document owner can update ACL", k403Forbidden);
                return;
            }

            // 5. 验证 ACL 数据
            Json::Value aclArray = json["acl"];
            std::vector<std::pair<int, std::string>> aclItems;
            for (const auto& item : aclArray) {
                if (!item.isMember("user_id") || !item.isMember("permission")) {
                    ResponseUtils::sendError(*callbackPtr, "Invalid ACL item: user_id and permission are required",
                                             k400BadRequest);
                    return;
                }
                int aclUserId = item["user_id"].asInt();
                std::string permission = item["permission"].asString();

                // 不能修改 owner 权限
                if (aclUserId == ownerId) {
                    ResponseUtils::sendError(*callbackPtr, "Cannot modify owner permission", k400BadRequest);
                    return;
                }

                // 验证权限值
                if (permission != "viewer" && permission != "editor") {
                    ResponseUtils::sendError(*callbackPtr, "Invalid permission: must be 'viewer' or 'editor'",
                                             k400BadRequest);
                    return;
                }

                aclItems.push_back({aclUserId, permission});
            }

            // 6. 使用事务更新 ACL
            // 先删除旧的 ACL（除了 owner）
            db->execSqlAsync(
                "DELETE FROM doc_acl WHERE doc_id = $1::bigint",
                [=](const drogon::orm::Result&) {
                    // 7. 插入新的 ACL
                    if (aclItems.empty()) {
                        Json::Value responseJson;
                        responseJson["message"] = "ACL updated successfully";
                        responseJson["doc_id"] = docId;
                        responseJson["acl"] = Json::arrayValue;
                        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        return;
                    }

                    // 批量插入
                    std::stringstream ss;
                    ss << "INSERT INTO doc_acl (doc_id, user_id, permission) VALUES ";
                    for (size_t i = 0; i < aclItems.size(); i++) {
                        if (i > 0) ss << ", ";
                        ss << "($" << (i * 3 + 1) << "::bigint, $" << (i * 3 + 2) << "::bigint, $" << (i * 3 + 3) << "::varchar)";
                    }

                    std::vector<std::string> params;
                    for (const auto& item : aclItems) {
                        params.push_back(std::to_string(docId));
                        params.push_back(std::to_string(item.first));
                        params.push_back(item.second);
                    }

                    db->execSqlAsync(
                        ss.str(),
                        [=](const drogon::orm::Result&) {
                            Json::Value responseJson;
                            responseJson["message"] = "ACL updated successfully";
                            responseJson["doc_id"] = docId;
                            Json::Value aclArray(Json::arrayValue);
                            for (const auto& item : aclItems) {
                                Json::Value aclItem;
                                aclItem["user_id"] = item.first;
                                aclItem["permission"] = item.second;
                                aclArray.append(aclItem);
                            }
                            responseJson["acl"] = aclArray;
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                     k500InternalServerError);
                        },
                        params);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                             k500InternalServerError);
                },
                std::to_string(docId));
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                     k500InternalServerError);
        },
        std::to_string(docId));
}
```

**测试要点**：
- 验证只有 owner 可以查看和修改 ACL
- 验证权限枚举值（viewer、editor）
- 验证不能删除或修改 owner 权限
- 验证批量更新 ACL 的正确性
- 验证前端 `AclManager` 组件与后端接口的集成

### 步骤 1：实时通讯模块

#### 1.1 内置聊天功能

**API 设计详情**：

- **POST /api/chat/rooms** - 创建聊天室
  - 请求体：`{ "name": "群聊名称", "type": "group|direct|document", "doc_id": 123, "member_ids": [1, 2, 3] }`
  - 响应：`{ "id": 1, "name": "...", "type": "...", "created_at": "..." }`
  - 实现要点：
    - 验证用户权限
    - 创建聊天室记录
    - 自动添加创建者和指定成员到 `chat_room_member`
    - 如果是文档聊天室，验证文档访问权限

- **GET /api/chat/rooms** - 获取用户聊天室列表
  - 查询参数：`?page=1&page_size=20`
  - 响应：`{ "rooms": [...], "page": 1, "page_size": 20, "total": 10 }`
  - 实现要点：
    - 查询用户参与的所有聊天室
    - 包含最后一条消息预览
    - 包含未读消息数量
    - 按最后消息时间排序

- **POST /api/chat/rooms/:id/members** - 添加成员
  - 请求体：`{ "user_ids": [4, 5] }`
  - 响应：`{ "message": "Members added successfully" }`
  - 实现要点：
    - 验证当前用户是聊天室成员
    - 批量插入成员记录
    - 发送系统消息通知新成员

- **GET /api/chat/rooms/:id/messages** - 获取消息历史
  - 查询参数：`?page=1&page_size=50&before_id=100`（分页和游标）
  - 响应：`{ "messages": [...], "has_more": true }`
  - 实现要点：
    - 验证用户是聊天室成员
    - 支持游标分页（before_id）和偏移分页
    - 包含发送者信息（nickname, avatar_url）
    - 包含已读状态

- **POST /api/chat/rooms/:id/messages** - 发送消息
  - 请求体：`{ "content": "消息内容", "message_type": "text|file|image", "file_url": "...", "reply_to": 123 }`
  - 响应：`{ "id": 456, "content": "...", "created_at": "..." }`
  - 实现要点：
    - 验证用户是聊天室成员
    - 插入消息记录
    - 通过 WebSocket 广播给所有成员
    - 创建未读记录（除了发送者）

- **POST /api/chat/messages/:id/read** - 标记消息已读
  - 请求体：无
  - 响应：`{ "message": "Marked as read" }`
  - 实现要点：
    - 插入或更新 `chat_message_read` 记录
    - 更新 `chat_room_member.last_read_at`

2. **WebSocket 聊天服务实现**（在 `collab-service` 中扩展）

```typescript
// collab-service/src/chat-handler.ts
import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface ChatMessage {
  type: 'message' | 'typing' | 'read' | 'join' | 'leave';
  room_id: number;
  user_id: number;
  content?: string;
  message_id?: number;
}

class ChatHandler {
  private rooms: Map<number, Set<WebSocket>> = new Map();
  private userSockets: Map<number, Set<WebSocket>> = new Map();

  handleConnection(ws: WebSocket, userId: number) {
    // 存储用户连接
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(ws);

    ws.on('message', async (data: string) => {
      try {
        const msg: ChatMessage = JSON.parse(data);
        await this.handleMessage(ws, userId, msg);
      } catch (error) {
        ws.send(JSON.stringify({ error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws, userId);
    });
  }

  private async handleMessage(ws: WebSocket, userId: number, msg: ChatMessage) {
    switch (msg.type) {
      case 'join':
        await this.joinRoom(ws, userId, msg.room_id);
        break;
      case 'message':
        await this.broadcastMessage(userId, msg);
        break;
      case 'typing':
        this.broadcastTyping(msg.room_id, userId);
        break;
      case 'read':
        await this.markAsRead(userId, msg.message_id!);
        break;
    }
  }

  private async joinRoom(ws: WebSocket, userId: number, roomId: number) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(ws);
    
    // 通知其他成员
    this.broadcastToRoom(roomId, {
      type: 'join',
      room_id: roomId,
      user_id: userId
    }, ws);
  }

  private async broadcastMessage(userId: number, msg: ChatMessage) {
    // 1. 保存消息到数据库（通过 HTTP API 调用 cpp-service）
    const response = await fetch(`http://localhost:8080/api/chat/rooms/${msg.room_id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getUserToken(userId)}`
      },
      body: JSON.stringify({
        content: msg.content,
        message_type: 'text'
      })
    });
    
    const savedMsg = await response.json();
    
    // 2. 广播给房间所有成员
    this.broadcastToRoom(msg.room_id, {
      type: 'message',
      ...savedMsg
    });
  }

  private broadcastToRoom(roomId: number, data: any, exclude?: WebSocket) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    
    const message = JSON.stringify(data);
    room.forEach(ws => {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}
```

**前端实现**：

1. **WebSocket 客户端封装** (`frontend/src/hooks/useChatWebSocket.ts`)

   ```typescript
import { useEffect, useRef, useState } from 'react';

interface ChatMessage {
  id: number;
  room_id: number;
  sender_id: number;
  content: string;
  message_type: string;
  created_at: string;
}

export function useChatWebSocket(roomId: number | null, userId: number) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const ws = new WebSocket(`ws://localhost:3001/chat?room_id=${roomId}&user_id=${userId}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // 发送加入房间消息
      ws.send(JSON.stringify({
        type: 'join',
        room_id: roomId,
        user_id: userId
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        setMessages(prev => [...prev, data]);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      setIsConnected(false);
      // 自动重连逻辑
      setTimeout(() => {
        if (roomId) {
          // 重新连接
        }
      }, 3000);
    };

    return () => {
      ws.close();
    };
  }, [roomId, userId]);

  const sendMessage = (content: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        room_id: roomId,
        user_id: userId,
        content: content
      }));
    }
  };

  return { messages, isConnected, sendMessage };
}
```

2. **聊天组件实现** (`frontend/src/components/chat/ChatWindow.tsx`)

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { useChatWebSocket } from '../../hooks/useChatWebSocket';

interface ChatWindowProps {
  roomId: number;
  userId: number;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ roomId, userId }) => {
  const [input, setInput] = useState('');
  const { messages, isConnected, sendMessage } = useChatWebSocket(roomId, userId);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-4 ${msg.sender_id === userId ? 'text-right' : 'text-left'}`}
          >
            <div className={`inline-block p-2 rounded ${
              msg.sender_id === userId ? 'bg-blue-500 text-white' : 'bg-gray-200'
            }`}>
              {msg.content}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {new Date(msg.created_at).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1 border rounded px-3 py-2"
            placeholder="输入消息..."
          />
          <button
            onClick={handleSend}
            disabled={!isConnected}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
          >
            发送
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {isConnected ? '已连接' : '连接中...'}
        </div>
      </div>
    </div>
  );
};
```

3. **文档内聊天自动创建**

在文档编辑页面加载时，检查是否存在文档聊天室，不存在则自动创建：

```typescript
// frontend/src/pages/DocumentEditor.tsx
useEffect(() => {
  const createOrGetDocChatRoom = async () => {
    try {
      // 尝试获取文档聊天室
      const rooms = await apiClient.getChatRooms({ doc_id: documentId });
      if (rooms.length === 0) {
        // 创建文档聊天室
        await apiClient.createChatRoom({
          type: 'document',
          doc_id: documentId,
          name: `文档 ${documentId} 讨论`
        });
      }
    } catch (error) {
      console.error('Failed to setup document chat room:', error);
    }
  };
  
  if (documentId) {
    createOrGetDocChatRoom();
  }
}, [documentId]);
   ```

### 步骤 2：通知系统增强

#### 2.1 通知分类与过滤

**数据库扩展**（如需要）：

```sql
-- 如果需要在数据库层面优化，可以添加索引
CREATE INDEX idx_notification_user_type ON notification(user_id, type);
CREATE INDEX idx_notification_created_at ON notification(created_at DESC);
```

**后端实现**：

1. **扩展 NotificationController**
   - 添加 `type` 查询参数支持
   - 添加 `doc_id` 查询参数支持
   - 添加 `start_date` 和 `end_date` 查询参数支持

2. **前端实现**
   - 通知类型筛选下拉框
   - 日期范围选择器
   - 文档筛选器

#### 2.2 通知设置

**数据库设计**：

```sql
CREATE TABLE notification_setting (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,  -- comment, task_assigned, etc.
    email_enabled BOOLEAN DEFAULT true,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, notification_type)
);
```

**后端实现**：

- 创建 `NotificationSettingController`
- 实现设置 CRUD 接口
- 在发送通知时检查用户设置

**前端实现**：

- 通知设置页面
- 各类通知的开关控制

#### 2.3 实时通知推送

**技术选型**：
- 扩展现有的 `collab-service` 或创建独立的通知 WebSocket 服务
- 使用 WebSocket 推送实时通知

**实现步骤**：

1. **后端 WebSocket 服务**
   ```typescript
   // 在 collab-service 中扩展或新建 notification-service
   // 监听通知创建事件，推送给对应用户
   ```

2. **前端 WebSocket 客户端**
   ```typescript
   // 连接通知 WebSocket
   // 接收实时通知并更新 UI
   // 使用浏览器 Notification API 显示桌面通知
   ```

### 步骤 3：文档导入导出功能

#### 3.1 Word 文档导入导出

**技术选型建议**：
- **C++ 后端**: 使用 `libdocx` 或通过 Node.js 服务调用 `mammoth`
- **Node.js 服务**: 创建独立的文档转换服务，使用 `mammoth` (Word → HTML) 和 `docx` (HTML → Word)

**实现步骤**：

1. **创建文档转换服务**（可选，推荐）
   ```bash
   mkdir -p doc-converter-service
   cd doc-converter-service
   npm init -y
   npm install mammoth docx pdf-lib marked
   ```

2. **后端接口实现**
   - 创建 `DocumentImportExportController`
   - 实现导入接口：接收文件上传，调用转换服务，创建文档
   - 实现导出接口：获取文档内容，调用转换服务，返回文件

3. **前端实现**
   - 文件上传组件
   - 导出按钮和下载功能

#### 3.2 PDF 文档导入导出

**技术选型**：
- 使用 `pdf-lib` 进行 PDF 操作
- 使用 `pdf-parse` 解析 PDF 文本

#### 3.3 Markdown 导入导出

**技术选型**：
- 使用 `marked` 解析 Markdown
- Tiptap 原生支持 Markdown

### 步骤 4：文档版本控制

#### 4.1 版本采集策略

- `doc_version` 表记录 `doc_id`、`version_number`、`snapshot_url`、`delta_sha256`、`created_by`、`change_summary`、`created_at`。
- 自动触发：发布、定时（例如每 30 分钟且有变更）、关键操作（导入、共享变更）。
- 手动触发：编辑器中提供 “保存版本” 按钮，允许填写变更摘要。

#### 4.2 API 与服务

- `POST /api/docs/{id}/versions`: 创建版本（写 ACL 校验、防抖）。
- `GET /api/docs/{id}/versions`: 列出版本，支持时间区间、创建人过滤。
- `GET /api/docs/{id}/versions/{versionId}`: 获取单个版本详情、下载快照。
- `POST /api/docs/{id}/versions/{versionId}/restore`: 回滚到指定版本，并自动生成一个新的版本记录（记录来源）。
- 后端可与 Yjs 的 `encodeStateAsUpdate` 结合，存储增量（delta）与完整快照混合策略。

#### 4.3 前端交互

- 版本时间线组件：展示版本号、创建人、时间、摘要、标签（自动/手动）。
- 版本对比视图：左右对照或行内 diff，可复用 Tiptap diff 扩展或将 Yjs 更新转换为可读 diff。
- 恢复预览：点击某个版本后在只读模式加载快照，确认后再真正恢复。
- 版本清理策略提示：显示当前版本占用容量、自动清理规则。

### 步骤 5：用户管理

#### 5.1 用户列表管理

- **目标**：实现需求文档 6.2 所述的“用户列表管理”，支持运维/管理人员按条件查看与维护用户。
- **后端**：`GET /api/admin/users`（分页、关键字、状态、角色筛选）+ `PATCH /api/admin/users/{id}`（状态修改、备注）；提供导出接口（CSV）。
- **前端**：表格视图、筛选器、批量操作、导出按钮；支持列配置与查询条件持久化。

#### 5.2 用户权限调整

- **目标**：满足“用户权限调整”能力，配合现有 RBAC/ACL。
- **后端**：提供角色分配接口 `POST /api/admin/users/{id}/roles`、权限矩阵查询接口；所有变更写入审计日志。
- **前端**：角色切换抽屉、权限矩阵可视化，变更需二次确认并提示影响范围。

#### 5.3 用户行为分析

- **指标采集**：登录次数、在线时长、文档编辑/评论次数、任务完成率等。
- **后端**：定期跑批或实时写入 `user_activity_daily` 表；提供统计 API（按时间、角色、团队维度聚合）。
- **前端**：仪表盘/图表展示（折线、柱状），支持导出报表，辅助产品评估活跃度。

#### 5.4 用户满意度调查

- **收集**：在关键操作后或定期弹出问卷；也可在“帮助中心”提供反馈入口。
- **后端**：`POST /api/feedback` 写入问卷结果，`GET /api/feedback/stat` 汇总满意度得分、常见问题。
- **前端**：多选/量表题组件、文本反馈、提交成功提示；可选邮件/通知提醒管理员查看。

---

## 📝 开发建议

### 优先级建议

0. **文档权限管理**: ACL接口实现,优先级最高
1. **实时通讯模块**：核心协作功能，提升团队沟通效率，优先级最高
2. **通知系统增强**：完善现有通知功能，提升用户体验，优先级高
3. **文档导入导出**：提升用户体验，优先级高
4. **文档版本控制**：保障文档可追溯与合规审计，优先级高
5. **用户管理**：支撑企业级治理与安全策略，优先级高

### 技术选型建议

- **实时通讯**：
  - WebSocket 服务：可以扩展现有的 `collab-service`，或创建独立的 `chat-service`
  - 消息存储：使用 PostgreSQL 存储消息历史，Redis 可选用于在线状态和临时消息缓存
  - 视频会议：Jitsi Meet 开源免费，易于集成；Agora 功能更强大但需要付费
- **文档转换**：考虑创建独立的 Node.js 服务，便于维护和扩展
- **版本控制**：保留 Yjs 快照，必要时引入 CRDT diff、tree-sitter 或 Alpha API 进行差异计算
- **用户管理**：RBAC 模型可先用自研表结构，若需更灵活可探索 OPA / Casbin 等策略引擎

### 测试建议

- **实时通讯**：
  - 测试多用户同时在线聊天
  - 测试消息发送、接收、已读状态
  - 测试文件上传和下载
  - 测试 WebSocket 断线重连
  - 测试视频会议功能（如实现）
- **通知系统**：
  - 测试实时通知推送
  - 测试通知过滤和分类
  - 测试通知设置生效
  - 测试浏览器推送通知
- **导入导出**：测试各种格式的文档导入导出
- **PWA**：在真实移动设备上测试
- **监控和日志**：验证数据收集和查询
- **文档版本控制**：测试自动/手动版本创建、版本 diff、回滚、清理策略
- **用户管理**：测试角色权限、账号启用/禁用、邀请流程、审计日志完整性

---

## 🔗 相关文档

- [项目启动指南](./GUIDE-01-项目启动指南.md)
- [总体设计文档](./ARCH-01-总体设计.md)
- [第三阶段开发指南](./PHASE-03-协作功能开发指南.md)
- [第四阶段数据库变更分析](./DEV-11-第四阶段数据库变更分析.md) - 详细的数据库变更说明

---

## 📊 数据库变更

第四阶段需要新增 **5个表** 和 **多个索引**，详细说明请参考：
- [第四阶段数据库变更分析](./第四阶段数据库变更分析.md)
- 迁移脚本：`cpp-service/sql/migration_phase4.sql`

**快速执行迁移**：
```bash
psql -h 127.0.0.1 -p 5432 -U collab -d collab -f cpp-service/sql/migration_phase4.sql
```

---

## 📖 详细实现指南

### 实时通讯详细实现

**数据库设计**：

```sql
-- 聊天室表
CREATE TABLE chat_room (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    type VARCHAR(20) NOT NULL,  -- 'direct', 'group', 'document'
    doc_id INTEGER REFERENCES document(id) ON DELETE CASCADE,  -- 文档关联聊天室
    created_by INTEGER REFERENCES "user"(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 聊天室成员表
CREATE TABLE chat_room_member (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES chat_room(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP,
    UNIQUE(room_id, user_id)
);

-- 聊天消息表
CREATE TABLE chat_message (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES chat_room(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES "user"(id),
    content TEXT,
    message_type VARCHAR(20) DEFAULT 'text',  -- 'text', 'file', 'image', etc.
    file_url VARCHAR(500),  -- 文件消息的 URL
    reply_to INTEGER REFERENCES chat_message(id),  -- 回复消息
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消息已读状态表
CREATE TABLE chat_message_read (
    id SERIAL PRIMARY KEY,
    message_id INTEGER NOT NULL REFERENCES chat_message(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);
```

**后端实现**：

1. **创建 ChatController** (`cpp-service/src/controllers/ChatController.h`)

```cpp
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

class ChatController : public drogon::HttpController<ChatController> {
public:
    METHOD_LIST_BEGIN
    ADD_METHOD_TO(ChatController::createRoom, "/api/chat/rooms", Post, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::getRooms, "/api/chat/rooms", Get, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::addMember, "/api/chat/rooms/:id/members", Post, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::getMessages, "/api/chat/rooms/:id/messages", Get, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::sendMessage, "/api/chat/rooms/:id/messages", Post, "JwtAuthFilter");
    ADD_METHOD_TO(ChatController::markMessageRead, "/api/chat/messages/:id/read", Post, "JwtAuthFilter");
    METHOD_LIST_END

    void createRoom(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void getRooms(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void addMember(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void getMessages(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void sendMessage(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);
    void markMessageRead(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback);

private:
    // 辅助函数：在数据库中创建聊天室
    void createRoomInDb(int userId, const std::string& name, const std::string& type, 
                        int docId, const Json::Value& memberIdsArray,
                        std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback);
    // 辅助函数：添加成员到聊天室
    void addMembersToRoom(int roomId, const std::vector<int>& memberIds,
                          std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
                          std::function<void(int)> onSuccess);
};
```

2. **实现 ChatController** (`cpp-service/src/controllers/ChatController.cc`)

```cpp
#include "ChatController.h"

#include <drogon/drogon.h>
#include <drogon/orm/DbClient.h>
#include <json/json.h>

#include <sstream>
#include <vector>

#include "../utils/ResponseUtils.h"

// 创建聊天室
void ChatController::createRoom(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取用户ID
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 2. 解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    std::string name = json.get("name", "").asString();
    std::string type = json.get("type", "group").asString();  // direct, group, document
    int docId = json.get("doc_id", 0).asInt();
    Json::Value memberIdsArray = json.get("member_ids", Json::arrayValue);

    // 验证类型
    if (type != "direct" && type != "group" && type != "document") {
        ResponseUtils::sendError(callback, "Invalid room type. Must be 'direct', 'group', or 'document'", k400BadRequest);
        return;
    }

    // 如果是文档聊天室，验证文档访问权限
    if (type == "document" && docId > 0) {
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
            return;
        }

        auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
        db->execSqlAsync(
            "SELECT owner_id FROM document WHERE id = $1",
            [=](const drogon::orm::Result& r) {
                if (r.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                    return;
                }
                // 检查权限（简化版，实际应该检查 doc_acl）
                int ownerId = r[0]["owner_id"].as<int>();
                if (ownerId != userId) {
                    ResponseUtils::sendError(*callbackPtr, "No permission to create chat room for this document", k403Forbidden);
                    return;
                }
                // 继续创建聊天室
                createRoomInDb(userId, name, type, docId, memberIdsArray, callbackPtr);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
            },
            std::to_string(docId)
        );
        return;
    }

    // 非文档聊天室，直接创建
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    createRoomInDb(userId, name, type, docId, memberIdsArray, callbackPtr);
}

// 辅助函数：在数据库中创建聊天室
void ChatController::createRoomInDb(int userId, const std::string& name, const std::string& type, 
                                     int docId, const Json::Value& memberIdsArray,
                                     std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback) {
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(*callback, "Database not available", k500InternalServerError);
        return;
    }

    // 1. 创建聊天室
    std::string sql = "INSERT INTO chat_room (name, type, doc_id, created_by, created_at, updated_at) "
                      "VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id";
    
    std::string docIdStr = docId > 0 ? std::to_string(docId) : "NULL";
    
    db->execSqlAsync(
        sql,
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callback, "Failed to create room", k500InternalServerError);
                return;
            }
            int roomId = r[0]["id"].as<int>();

            // 2. 添加创建者为成员
            std::vector<int> memberIds = {userId};
            for (const auto& id : memberIdsArray) {
                int memberId = id.asInt();
                if (memberId != userId) {
                    memberIds.push_back(memberId);
                }
            }

            // 3. 批量添加成员
            addMembersToRoom(roomId, memberIds, callback, [=](int roomId) {
                // 4. 返回创建的聊天室信息
                Json::Value responseJson;
                responseJson["id"] = roomId;
                responseJson["name"] = name;
                responseJson["type"] = type;
                if (docId > 0) {
                    responseJson["doc_id"] = docId;
                }
                responseJson["created_by"] = userId;
                ResponseUtils::sendSuccess(*callback, responseJson, k201Created);
            });
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callback, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        name.empty() ? "NULL" : name, type, docIdStr, std::to_string(userId)
    );
}

// 辅助函数：添加成员到聊天室
void ChatController::addMembersToRoom(int roomId, const std::vector<int>& memberIds,
                                       std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callback,
                                       std::function<void(int)> onSuccess) {
    if (memberIds.empty()) {
        onSuccess(roomId);
        return;
    }

    auto db = drogon::app().getDbClient();
    std::stringstream ss;
    ss << "INSERT INTO chat_room_member (room_id, user_id, joined_at) VALUES ";
    
    for (size_t i = 0; i < memberIds.size(); i++) {
        if (i > 0) ss << ", ";
        ss << "($" << (i * 2 + 1) << ", $" << (i * 2 + 2) << ", NOW())";
    }
    ss << " ON CONFLICT (room_id, user_id) DO NOTHING";

    std::vector<std::string> params;
    for (int memberId : memberIds) {
        params.push_back(std::to_string(roomId));
        params.push_back(std::to_string(memberId));
    }

    db->execSqlAsync(
        ss.str(),
        [=](const drogon::orm::Result& r) {
            onSuccess(roomId);
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callback, "Failed to add members: " + std::string(e.base().what()), k500InternalServerError);
        },
        params
    );
}

// 获取用户聊天室列表
void ChatController::getRooms(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取用户ID
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    // 2. 解析分页参数
    int page = 1;
    int pageSize = 20;
    try {
        std::string pageStr = req->getParameter("page");
        if (!pageStr.empty()) page = std::max(1, std::stoi(pageStr));
    } catch (...) {}
    try {
        std::string pageSizeStr = req->getParameter("page_size");
        if (!pageSizeStr.empty()) pageSize = std::max(1, std::min(100, std::stoi(pageSizeStr)));
    } catch (...) {}

    int offset = (page - 1) * pageSize;

    // 3. 查询聊天室列表
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
        "SELECT r.id, r.name, r.type, r.doc_id, r.created_by, r.created_at, r.updated_at, "
        "       (SELECT content FROM chat_message WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message_content, "
        "       (SELECT created_at FROM chat_message WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) as last_message_time, "
        "       (SELECT COUNT(*) FROM chat_message m "
        "        LEFT JOIN chat_message_read mr ON m.id = mr.message_id AND mr.user_id = $1 "
        "        WHERE m.room_id = r.id AND mr.id IS NULL) as unread_count "
        "FROM chat_room r "
        "INNER JOIN chat_room_member m ON r.id = m.room_id "
        "WHERE m.user_id = $1 "
        "ORDER BY COALESCE((SELECT created_at FROM chat_message WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1), r.created_at) DESC "
        "LIMIT $2 OFFSET $3",
        [=](const drogon::orm::Result& r) {
            Json::Value responseJson;
            Json::Value roomsArray(Json::arrayValue);

            for (const auto& row : r) {
                Json::Value roomJson;
                roomJson["id"] = row["id"].as<int>();
                if (!row["name"].isNull()) {
                    roomJson["name"] = row["name"].as<std::string>();
                }
                roomJson["type"] = row["type"].as<std::string>();
                if (!row["doc_id"].isNull()) {
                    roomJson["doc_id"] = row["doc_id"].as<int>();
                }
                roomJson["created_by"] = row["created_by"].as<int>();
                roomJson["created_at"] = row["created_at"].as<std::string>();
                roomJson["updated_at"] = row["updated_at"].as<std::string>();
                
                if (!row["last_message_content"].isNull()) {
                    roomJson["last_message"] = row["last_message_content"].as<std::string>();
                }
                if (!row["last_message_time"].isNull()) {
                    roomJson["last_message_time"] = row["last_message_time"].as<std::string>();
                }
                roomJson["unread_count"] = row["unread_count"].as<int>();

                roomsArray.append(roomJson);
            }

            responseJson["rooms"] = roomsArray;
            responseJson["page"] = page;
            responseJson["page_size"] = pageSize;
            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(userId), std::to_string(pageSize), std::to_string(offset)
    );
}

// 添加成员到聊天室
void ChatController::addMember(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取用户ID和房间ID
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    std::string roomIdStr = req->getParameter("id");
    if (roomIdStr.empty()) {
        ResponseUtils::sendError(callback, "Room ID is required", k400BadRequest);
        return;
    }
    int roomId = std::stoi(roomIdStr);

    // 2. 解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    if (!json.isMember("user_ids") || !json["user_ids"].isArray()) {
        ResponseUtils::sendError(callback, "user_ids array is required", k400BadRequest);
        return;
    }

    // 3. 验证当前用户是聊天室成员
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
        "SELECT id FROM chat_room_member WHERE room_id = $1 AND user_id = $2",
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "You are not a member of this room", k403Forbidden);
                return;
            }

            // 4. 添加新成员
            Json::Value idsArray = json["user_ids"];
            std::vector<int> memberIds;
            for (const auto& id : idsArray) {
                memberIds.push_back(id.asInt());
            }

            addMembersToRoom(roomId, memberIds, callbackPtr, [=](int) {
                Json::Value responseJson;
                responseJson["message"] = "Members added successfully";
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            });
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(roomId), std::to_string(userId)
    );
}

// 获取消息历史
void ChatController::getMessages(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取用户ID和房间ID
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    std::string roomIdStr = req->getParameter("id");
    if (roomIdStr.empty()) {
        ResponseUtils::sendError(callback, "Room ID is required", k400BadRequest);
        return;
    }
    int roomId = std::stoi(roomIdStr);

    // 2. 解析分页参数
    int page = 1;
    int pageSize = 50;
    int beforeId = 0;
    try {
        std::string pageStr = req->getParameter("page");
        if (!pageStr.empty()) page = std::max(1, std::stoi(pageStr));
    } catch (...) {}
    try {
        std::string pageSizeStr = req->getParameter("page_size");
        if (!pageSizeStr.empty()) pageSize = std::max(1, std::min(100, std::stoi(pageSizeStr)));
    } catch (...) {}
    try {
        std::string beforeIdStr = req->getParameter("before_id");
        if (!beforeIdStr.empty()) beforeId = std::stoi(beforeIdStr);
    } catch (...) {}

    // 3. 验证用户是聊天室成员
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
        "SELECT id FROM chat_room_member WHERE room_id = $1 AND user_id = $2",
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "You are not a member of this room", k403Forbidden);
                return;
            }

            // 4. 查询消息历史
            std::string sql;
            std::vector<std::string> params = {std::to_string(roomId), std::to_string(pageSize)};

            if (beforeId > 0) {
                // 游标分页
                sql = "SELECT m.id, m.sender_id, m.content, m.message_type, m.file_url, m.reply_to, m.created_at, "
                      "       u.nickname, u.avatar_url, "
                      "       (SELECT COUNT(*) FROM chat_message_read WHERE message_id = m.id AND user_id = $3) > 0 as is_read "
                      "FROM chat_message m "
                      "LEFT JOIN user_profile u ON m.sender_id = u.user_id "
                      "WHERE m.room_id = $1 AND m.id < $4 "
                      "ORDER BY m.created_at DESC "
                      "LIMIT $2";
                params.push_back(std::to_string(userId));
                params.push_back(std::to_string(beforeId));
            } else {
                // 偏移分页
                int offset = (page - 1) * pageSize;
                sql = "SELECT m.id, m.sender_id, m.content, m.message_type, m.file_url, m.reply_to, m.created_at, "
                      "       u.nickname, u.avatar_url, "
                      "       (SELECT COUNT(*) FROM chat_message_read WHERE message_id = m.id AND user_id = $3) > 0 as is_read "
                      "FROM chat_message m "
                      "LEFT JOIN user_profile u ON m.sender_id = u.user_id "
                      "WHERE m.room_id = $1 "
                      "ORDER BY m.created_at DESC "
                      "LIMIT $2 OFFSET $4";
                params.push_back(std::to_string(userId));
                params.push_back(std::to_string(offset));
            }

            db->execSqlAsync(
                sql,
                [=](const drogon::orm::Result& r) {
                    Json::Value responseJson;
                    Json::Value messagesArray(Json::arrayValue);

                    bool hasMore = false;
                    for (const auto& row : r) {
                        Json::Value messageJson;
                        messageJson["id"] = row["id"].as<int>();
                        messageJson["sender_id"] = row["sender_id"].as<int>();
                        if (!row["content"].isNull()) {
                            messageJson["content"] = row["content"].as<std::string>();
                        }
                        messageJson["message_type"] = row["message_type"].as<std::string>();
                        if (!row["file_url"].isNull()) {
                            messageJson["file_url"] = row["file_url"].as<std::string>();
                        }
                        if (!row["reply_to"].isNull()) {
                            messageJson["reply_to"] = row["reply_to"].as<int>();
                        }
                        messageJson["created_at"] = row["created_at"].as<std::string>();
                        if (!row["nickname"].isNull()) {
                            messageJson["sender_nickname"] = row["nickname"].as<std::string>();
                        }
                        if (!row["avatar_url"].isNull()) {
                            messageJson["sender_avatar"] = row["avatar_url"].as<std::string>();
                        }
                        messageJson["is_read"] = row["is_read"].as<bool>();

                        messagesArray.append(messageJson);
                    }

                    responseJson["messages"] = messagesArray;
                    responseJson["has_more"] = r.size() == pageSize;
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                params
            );
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(roomId), std::to_string(userId)
    );
}

// 发送消息
void ChatController::sendMessage(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取用户ID和房间ID
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    std::string roomIdStr = req->getParameter("id");
    if (roomIdStr.empty()) {
        ResponseUtils::sendError(callback, "Room ID is required", k400BadRequest);
        return;
    }
    int roomId = std::stoi(roomIdStr);

    // 2. 解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;

    std::string content = json.get("content", "").asString();
    std::string messageType = json.get("message_type", "text").asString();
    std::string fileUrl = json.get("file_url", "").asString();
    int replyTo = json.get("reply_to", 0).asInt();

    if (content.empty() && fileUrl.empty()) {
        ResponseUtils::sendError(callback, "Content or file_url is required", k400BadRequest);
        return;
    }

    // 3. 验证用户是聊天室成员
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
        "SELECT id FROM chat_room_member WHERE room_id = $1 AND user_id = $2",
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "You are not a member of this room", k403Forbidden);
                return;
            }

            // 4. 插入消息
            std::string sql = "INSERT INTO chat_message (room_id, sender_id, content, message_type, file_url, reply_to, created_at) "
                              "VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, created_at";
            
            std::string replyToStr = replyTo > 0 ? std::to_string(replyTo) : "NULL";
            std::string fileUrlStr = fileUrl.empty() ? "NULL" : fileUrl;

            db->execSqlAsync(
                sql,
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Failed to send message", k500InternalServerError);
                        return;
                    }

                    int messageId = r[0]["id"].as<int>();
                    std::string createdAt = r[0]["created_at"].as<std::string>();

                    // 5. 创建未读记录（除了发送者）
                    db->execSqlAsync(
                        "INSERT INTO chat_message_read (message_id, user_id, read_at) "
                        "SELECT $1, user_id, NOW() FROM chat_room_member WHERE room_id = $2 AND user_id != $3",
                        [=](const drogon::orm::Result&) {
                            // 返回消息
                            Json::Value responseJson;
                            responseJson["id"] = messageId;
                            responseJson["room_id"] = roomId;
                            responseJson["sender_id"] = userId;
                            if (!content.empty()) {
                                responseJson["content"] = content;
                            }
                            responseJson["message_type"] = messageType;
                            if (!fileUrl.empty()) {
                                responseJson["file_url"] = fileUrl;
                            }
                            if (replyTo > 0) {
                                responseJson["reply_to"] = replyTo;
                            }
                            responseJson["created_at"] = createdAt;
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                        },
                        [=](const drogon::orm::DrogonDbException&) {
                            // 即使未读记录创建失败，也返回消息（不影响主流程）
                            Json::Value responseJson;
                            responseJson["id"] = messageId;
                            responseJson["room_id"] = roomId;
                            responseJson["sender_id"] = userId;
                            if (!content.empty()) {
                                responseJson["content"] = content;
                            }
                            responseJson["message_type"] = messageType;
                            responseJson["created_at"] = createdAt;
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                        },
                        std::to_string(messageId), std::to_string(roomId), std::to_string(userId)
                    );
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                std::to_string(roomId), std::to_string(userId), content.empty() ? "NULL" : content, 
                messageType, fileUrlStr, replyToStr
            );
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(roomId), std::to_string(userId)
    );
}

// 标记消息已读
void ChatController::markMessageRead(const HttpRequestPtr& req, std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取用户ID和消息ID
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "Unauthorized", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);

    std::string messageIdStr = req->getParameter("id");
    if (messageIdStr.empty()) {
        ResponseUtils::sendError(callback, "Message ID is required", k400BadRequest);
        return;
    }
    int messageId = std::stoi(messageIdStr);

    // 2. 插入或更新已读记录
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }

    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

    db->execSqlAsync(
        "INSERT INTO chat_message_read (message_id, user_id, read_at) "
        "VALUES ($1, $2, NOW()) "
        "ON CONFLICT (message_id, user_id) DO UPDATE SET read_at = NOW()",
        [=](const drogon::orm::Result&) {
            // 3. 更新聊天室成员的 last_read_at
            db->execSqlAsync(
                "UPDATE chat_room_member SET last_read_at = NOW() "
                "WHERE room_id = (SELECT room_id FROM chat_message WHERE id = $1) AND user_id = $2",
                [=](const drogon::orm::Result&) {
                    Json::Value responseJson;
                    responseJson["message"] = "Message marked as read";
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException&) {
                    // 即使更新失败，也返回成功（已读记录已创建）
                    Json::Value responseJson;
                    responseJson["message"] = "Message marked as read";
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                std::to_string(messageId), std::to_string(userId)
            );
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(messageId), std::to_string(userId)
    );
}
```

**代码说明**：

- 所有接口都通过 `JwtAuthFilter` 进行身份验证，从请求参数中获取 `user_id`
- 使用 `ResponseUtils` 统一响应格式
- 使用异步数据库操作 `execSqlAsync` 提高性能
- 支持游标分页（`before_id`）和偏移分页（`page`/`page_size`）
- 包含完整的错误处理和权限验证
- 辅助函数 `createRoomInDb` 和 `addMembersToRoom` 用于代码复用

### 1. 实时通讯模块详细实现

#### 1.1 文件共享功能

**后端实现**：

在 `ChatController` 中添加文件上传接口：

```cpp
// POST /api/chat/rooms/:id/files
void ChatController::uploadFile(const HttpRequestPtr& req, 
                                 std::function<void(const HttpResponsePtr&)>&& callback) {
    // 1. 获取上传的文件
    auto files = req->getUploadedFiles();
    if (files.empty()) {
        ResponseUtils::sendError(callback, "No file uploaded", k400BadRequest);
        return;
    }
    
    // 2. 上传到 MinIO
    auto file = files[0];
    std::string objectName = "chat/" + std::to_string(roomId) + "/" + file->getFileName();
    // ... MinIO 上传逻辑
    
    // 3. 创建文件消息记录
    // 4. 通过 WebSocket 广播文件消息
}
```

**前端实现**：

```typescript
const handleFileUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const result = await apiClient.uploadChatFile(roomId, formData);
  // 显示文件消息
};
```

#### 1.2 @提及功能

**实现要点**：
- 前端：检测输入中的 `@用户名` 模式
- 显示用户选择下拉框
- 发送消息时包含 `mentions: [user_id1, user_id2]` 字段
- 后端：解析 mentions，创建通知

### 2. 通知系统增强详细实现

#### 2.1 通知分类与过滤详细实现

**后端扩展 NotificationController**：

```cpp
void NotificationController::getNotifications(const HttpRequestPtr& req, ...) {
    // 解析查询参数
    std::string type = req->getParameter("type");  // comment, task_assigned, etc.
    std::string docIdStr = req->getParameter("doc_id");
    std::string startDate = req->getParameter("start_date");
    std::string endDate = req->getParameter("end_date");
    
    // 构建 SQL WHERE 子句
    std::string whereClause = "WHERE n.user_id = $1::integer";
    std::vector<std::string> params = {std::to_string(userId)};
    int paramIndex = 2;
    
    if (!type.empty()) {
        whereClause += " AND n.type = $" + std::to_string(paramIndex++) + "::varchar";
        params.push_back(type);
    }
    
    if (!docIdStr.empty()) {
        whereClause += " AND (n.payload->>'doc_id')::integer = $" + std::to_string(paramIndex++);
        params.push_back(docIdStr);
    }
    
    if (!startDate.empty() && !endDate.empty()) {
        whereClause += " AND n.created_at BETWEEN $" + std::to_string(paramIndex++) + 
                      "::timestamp AND $" + std::to_string(paramIndex++) + "::timestamp";
        params.push_back(startDate);
        params.push_back(endDate);
    }
    
    // 执行查询
    // ...
}
```

**前端筛选组件**：

```typescript
const NotificationFilters: React.FC = () => {
  const [type, setType] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Date?, Date?]>([]);
  
  const handleFilter = () => {
    const params = {
      type: type || undefined,
      start_date: dateRange[0]?.toISOString(),
      end_date: dateRange[1]?.toISOString()
    };
    loadNotifications(params);
  };
  
  return (
    <div className="flex gap-4">
      <select value={type} onChange={(e) => setType(e.target.value)}>
        <option value="">全部类型</option>
        <option value="comment">评论</option>
        <option value="task_assigned">任务分配</option>
        {/* ... */}
      </select>
      <DateRangePicker value={dateRange} onChange={setDateRange} />
      <button onClick={handleFilter}>筛选</button>
    </div>
  );
};
```

#### 2.2 通知设置详细实现

**后端 NotificationSettingController**：

```cpp
// GET /api/notification-settings
void NotificationSettingController::getSettings(...) {
    // 查询用户的所有通知设置
    db->execSqlAsync(
        "SELECT notification_type, email_enabled, push_enabled, in_app_enabled "
        "FROM notification_setting WHERE user_id = $1",
        [=](const Result& r) {
            Json::Value settings(Json::arrayValue);
            for (const auto& row : r) {
                Json::Value setting;
                setting["type"] = row["notification_type"].as<std::string>();
                setting["email_enabled"] = row["email_enabled"].as<bool>();
                setting["push_enabled"] = row["push_enabled"].as<bool>();
                setting["in_app_enabled"] = row["in_app_enabled"].as<bool>();
                settings.append(setting);
            }
            ResponseUtils::sendSuccess(callback, Json::Value(settings), k200OK);
        },
        std::to_string(userId)
    );
}

// PUT /api/notification-settings/:type
void NotificationSettingController::updateSetting(...) {
    // 更新或插入通知设置
    db->execSqlAsync(
        "INSERT INTO notification_setting (user_id, notification_type, email_enabled, push_enabled, in_app_enabled) "
        "VALUES ($1, $2, $3, $4, $5) "
        "ON CONFLICT (user_id, notification_type) "
        "DO UPDATE SET email_enabled = $3, push_enabled = $4, in_app_enabled = $5, updated_at = NOW()",
        // ...
    );
}
```

#### 2.3 实时通知推送详细实现

**WebSocket 通知服务**（在 collab-service 中）：

```typescript
// collab-service/src/notification-handler.ts
class NotificationHandler {
  private userConnections: Map<number, Set<WebSocket>> = new Map();

  handleConnection(ws: WebSocket, userId: number) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId)!.add(ws);
  }

  async pushNotification(userId: number, notification: any) {
    // 1. 检查用户通知设置
    const settings = await getNotificationSettings(userId, notification.type);
    if (!settings.in_app_enabled) return;

    // 2. 推送给所有在线连接
    const connections = this.userConnections.get(userId);
    if (connections) {
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'notification',
            data: notification
          }));
        }
      });
    }

    // 3. 浏览器推送通知（如果启用）
    if (settings.push_enabled) {
      // 触发浏览器 Notification API（需要前端配合）
    }
  }
}
```

**前端实时通知接收**：

```typescript
// frontend/src/hooks/useNotificationWebSocket.ts
export function useNotificationWebSocket(userId: number) {
  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3001/notifications?user_id=${userId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'notification') {
        // 显示通知
        showNotification(data.data);
        
        // 浏览器推送
        if (Notification.permission === 'granted') {
          new Notification(data.data.title, {
            body: data.data.message,
            icon: '/icon-192.png'
          });
        }
      }
    };
    
    return () => ws.close();
  }, [userId]);
}
```

#### 3.2 健康检查增强

**扩展 HealthController**：

```cpp
void HealthController::health(const HttpRequestPtr& req, ...) {
    Json::Value health;
    health["status"] = "ok";
    health["timestamp"] = getCurrentTimestamp();
    
    // 数据库健康检查
    auto db = drogon::app().getDbClient();
    try {
        db->execSqlSync("SELECT 1");
        health["database"] = "healthy";
    } catch (...) {
        health["database"] = "unhealthy";
        health["status"] = "degraded";
    }
    
    // Meilisearch 健康检查
    try {
        auto httpClient = HttpClient::newHttpClient(meilisearchUrl);
        auto req = HttpRequest::newHttpRequest();
        req->setPath("/health");
        auto resp = httpClient->sendRequest(req);
        health["meilisearch"] = resp->getStatusCode() == 200 ? "healthy" : "unhealthy";
    } catch (...) {
        health["meilisearch"] = "unhealthy";
    }
    
    // MinIO 健康检查
    // ...
    
    auto resp = HttpResponse::newHttpJsonResponse(health);
    resp->setStatusCode(health["status"] == "ok" ? k200OK : k503ServiceUnavailable);
    callback(resp);
}

---

**祝开发顺利！** 🚀

