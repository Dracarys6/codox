# 第三阶段开发指南：实时协作、评论、任务与搜索

## ✅ 第三阶段开发状态：已完成

**完成时间**: 2025-11

第三阶段的所有核心功能已实现并测试通过，包括：
- ✅ 实时协作编辑（Yjs + WebSocket）
- ✅ 评论系统（后端 API + 前端组件）
- ✅ 任务管理（后端 API + 前端组件）
- ✅ 通知系统（后端 API + 前端组件）
- ✅ 全文搜索（Meilisearch 集成）

---

## 🎯 第三阶段目标

完成文档的实时协作编辑、评论系统、任务管理、通知系统和全文搜索功能。

---

## ✅ 自检概览（已完成检查）

### 后端（cpp-service）
- [x] `CollaborationController` / `CommentController` / `TaskController` / `NotificationController` / `SearchController` 均已在 `METHOD_LIST` 中注册，`main.cpp` 已 `registerController`
- [x] `NotificationUtils`、`PermissionUtils`、`JwtAuthFilter` 编译通过且覆盖所有第三阶段接口
- [x] `config.json` 的 `app` 节点包含 `jwt_secret`、`webhook_token`、`meilisearch_*`、`minio_*` 等字段，配置正确加载

### 协作服务（collab-service）
- [x] `npm run dev` 后监听 `ws://localhost:1234`
- [x] WebSocket 连接附带 `token` 查询参数（Token 验证为 TODO，待生产环境实现）

### 前端（frontend）
- [x] `DocumentEditor.tsx` 使用 `VITE_WS_URL`、`apiClient.getCollaborationToken`/`getBootstrap`
- [x] Comment / Task / Notification 面板已实现，接口路径与后端保持一致
- [x] 通过 `npm run dev` 可完成登录→选择文档→进入协作编辑页

### 支撑服务 & 配置
- [x] `docker compose up -d meilisearch minio` 可成功启动依赖
- [x] MinIO 已创建 `documents` bucket，并配置在 `minio_bucket`
- [x] README.md 的「快速开始」「配置说明」「开发路线图」已更新

### 测试验证
- [x] 所有后端 API 已通过 HTTPie 测试
- [x] 协作编辑功能已测试多用户同时编辑
- [x] 搜索功能已测试并返回正确结果
- [x] 评论、任务、通知流程已测试

---

## 📝 第三阶段完成总结

### 已实现功能清单

1. **实时协作**
   - ✅ 协作令牌生成接口 (`GET /api/collab/token/:docId`)
   - ✅ 快照回调接口 (`POST /api/collab/snapshot/:docId`)
   - ✅ 引导快照接口 (`GET /api/collab/bootstrap/:docId`)
   - ✅ Yjs WebSocket 服务部署
   - ✅ Tiptap 编辑器集成

2. **评论系统**
   - ✅ 评论创建、查询、更新、删除接口
   - ✅ 评论回复支持
   - ✅ 前端评论组件

3. **任务管理**
   - ✅ 任务创建、查询、更新接口
   - ✅ 任务状态管理
   - ✅ 前端任务组件

4. **通知系统**
   - ✅ 通知查询接口
   - ✅ 通知已读标记
   - ✅ 前端通知组件
   - ✅ 通知自动创建机制

5. **全文搜索**
   - ✅ Meilisearch 集成
   - ✅ 搜索接口实现 (`GET /api/search`)
   - ✅ 文档索引自动更新
   - ✅ 权限过滤
   - ✅ 前端搜索页面

### 技术亮点

- **CRDT 协作**: 使用 Yjs 实现无冲突的多人实时编辑
- **对象存储**: MinIO 集成，支持快照持久化
- **全文搜索**: Meilisearch 集成，支持中文搜索和权限过滤
- **实时通知**: 评论、任务等操作自动触发通知

---

## 🚀 下一步：第四阶段开发

第三阶段已完成，可以开始第四阶段的开发工作。请参考 [第四阶段开发指南](./PHASE-04-导入导出开发指南.md)。

---

---

## 📋 开发步骤概览

### 开发顺序建议

1. **协作服务部署**（优先级：高）
   - 部署 y-websocket 服务
   - 配置 WebSocket 连接

2. **协作后端接口**（优先级：高）
   - 协作令牌生成接口
   - 快照回调接口
   - 引导快照接口

3. **前端编辑器集成**（优先级：高）
   - Tiptap 编辑器集成
   - Yjs 协作集成
   - 文档编辑页面重构

4. **评论系统**（优先级：中）
   - 后端评论接口
   - 前端评论组件

5. **任务管理**（优先级：中）
   - 后端任务接口
   - 前端任务组件

6. **通知系统**（优先级：中）
   - 后端通知接口
   - 前端通知组件

7. **全文搜索**（优先级：低）
   - Meilisearch 集成
   - 搜索接口实现

---

## 步骤 1：协作服务部署与配置

### 1.1 部署 y-websocket 服务

y-websocket 是一个 Node.js 服务，用于处理 Yjs 的 WebSocket 连接和 CRDT 同步。

#### 创建协作服务目录

```bash
mkdir -p collab-service
cd collab-service
npm init -y
```

#### 安装依赖

```bash
npm install @y/websocket-server y-websocket y-protocols ws yjs
npm install --save-dev @types/ws typescript tsx
```

#### 创建服务文件

创建 `collab-service/server.ts`：

```typescript
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
```

#### 创建 TypeScript 配置

创建 `collab-service/tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": false,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

#### 启动服务

```bash
npm start
# 或
npx tsx server.ts
```

### 1.2 配置 Docker Compose（可选）

如果使用 Docker，可以在 `docker-compose.yml` 中添加：

```yaml
services:
  y-websocket:
    build: ./collab-service
    ports:
      - "1234:1234"
    environment:
      - NODE_ENV=production
```

---

## 步骤 2：实现协作后端接口

### 2.1 创建 CollaborationController

创建 `cpp-service/src/controllers/CollaborationController.h`：

```cpp
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

class CollaborationController : public drogon::HttpController<CollaborationController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(CollaborationController::getToken, "/api/collab/token", Post, "JwtAuthFilter");
        ADD_METHOD_TO(CollaborationController::getBootstrap, "/api/collab/bootstrap/{id}", Get, "JwtAuthFilter");
        ADD_METHOD_TO(CollaborationController::handleSnapshot, "/api/collab/snapshot/{id}", Post);
    METHOD_LIST_END

    void getToken(const HttpRequestPtr& req,
                  std::function<void(const HttpResponsePtr&)>&& callback);
    
    void getBootstrap(const HttpRequestPtr& req,
                     std::function<void(const HttpResponsePtr&)>&& callback);
    
    void handleSnapshot(const HttpRequestPtr& req,
                       std::function<void(const HttpResponsePtr&)>&& callback);
};
```

### 2.2 实现协作令牌接口

创建 `cpp-service/src/controllers/CollaborationController.cc`：

```cpp
#include "CollaborationController.h"
#include "../utils/ResponseUtils.h"
#include "../utils/PermissionUtils.h"
#include "../utils/JwtUtil.h"
#include <json/json.h>

void CollaborationController::getToken(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
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
    
    if (!json.isMember("doc_id")) {
        ResponseUtils::sendError(callback, "doc_id is required", k400BadRequest);
        return;
    }
    int docId = json["doc_id"].asInt();
    
    // 3. 检查权限（需要 viewer 或更高权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }
        
        // 4. 生成一次性协作令牌（有效期 1 小时）
        Json::Value payload;
        payload["doc_id"] = docId;
        payload["user_id"] = userId;
        payload["type"] = "collab";
        
        // 从配置获取 JWT secret
        auto& appConfig = drogon::app().getCustomConfig();
        std::string secret = appConfig.get("jwt_secret", "default-secret").asString();
        
        std::string token = JwtUtil::generateToken(payload, secret, 3600); // 1 小时有效期
        
        // 5. 返回令牌
        Json::Value responseJson;
        responseJson["token"] = token;
        responseJson["expiresIn"] = 3600;
        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
    });
}
```

### 2.3 实现引导快照接口

```cpp
void CollaborationController::getBootstrap(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数
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
    
    // 3. 检查权限
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }
        
        // 4. 查询文档的最新发布版本
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }
        
        db->execSqlAsync(
            "SELECT dv.snapshot_url, dv.snapshot_sha256, dv.id as version_id "
            "FROM document d "
            "LEFT JOIN document_version dv ON d.last_published_version_id = dv.id "
            "WHERE d.id = $1::integer",
            [=](const drogon::orm::Result& r) {
                if (r.empty() || r[0]["snapshot_url"].isNull()) {
                    // 没有快照，返回空
                    Json::Value responseJson;
                    responseJson["snapshot_url"] = Json::Value::null;
                    responseJson["sha256"] = Json::Value::null;
                    responseJson["version_id"] = Json::Value::null;
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                    return;
                }
                
                Json::Value responseJson;
                responseJson["snapshot_url"] = r[0]["snapshot_url"].as<std::string>();
                responseJson["sha256"] = r[0]["snapshot_sha256"].as<std::string>();
                responseJson["version_id"] = r[0]["version_id"].as<int>();
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                       k500InternalServerError);
            },
            std::to_string(docId)
        );
    });
}
```

### 2.4 实现快照回调接口

```cpp
void CollaborationController::handleSnapshot(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 验证 std::shared_ptr<Record> result = std::make_shared<Record>();
  result->SetRid(rid);
  db_size_t offset = slots_[rid.slot_id_].offset_;
  result->DeserializeFrom(page_data_ + offset, column_list);
  return result; Token（从环境变量或配置读取）
    std::string webhookToken = req->getHeader("X-Webhook-Token");
    std::string expectedToken = drogon::app().getCustomConfig()["webhook_token"].asString();
    
    if (webhookToken != expectedToken) {
        ResponseUtils::sendError(callback, "Invalid webhook token", k401Unauthorized);
        return;
    }
    
    // 2. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    int docId = std::stoi(routingParams[0]);
    
    // 3. 解析请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;
    
    if (!json.isMember("snapshot_url") || !json.isMember("sha256") || !json.isMember("size_bytes")) {
        ResponseUtils::sendError(callback, "Missing required fields", k400BadRequest);
        return;
    }
    
    std::string snapshotUrl = json["snapshot_url"].asString();
    std::string sha256 = json["sha256"].asString();
    int64_t sizeBytes = json["size_bytes"].asInt64();
    
    // 4. 检查是否已存在相同 SHA256 的版本（幂等性）
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    db->execSqlAsync(
        "SELECT id FROM document_version WHERE doc_id = $1::integer AND snapshot_sha256 = $2",
        [=](const drogon::orm::Result& r) {
            if (!r.empty()) {
                // 已存在，返回现有版本 ID
                Json::Value responseJson;
                responseJson["version_id"] = r[0]["id"].as<int>();
                responseJson["message"] = "Version already exists";
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                return;
            }
            
            // 5. 插入新版本记录（created_by 从快照元数据获取，这里暂时用 0）
            db->execSqlAsync(
                "INSERT INTO document_version (doc_id, snapshot_url, snapshot_sha256, size_bytes, created_by) "
                "VALUES ($1::integer, $2, $3, $4::bigint, 0) "
                "RETURNING id",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Failed to create version", k500InternalServerError);
                        return;
                    }
                    
                    int versionId = r[0]["id"].as<int>();
                    
                    // 6. 更新文档的 last_published_version_id（可选）
                    db->execSqlAsync(
                        "UPDATE document SET last_published_version_id = $1::bigint, updated_at = NOW() "
                        "WHERE id = $2::integer",
                        [=](const drogon::orm::Result&) {
                            Json::Value responseJson;
                            responseJson["version_id"] = versionId;
                            responseJson["message"] = "Snapshot saved successfully";
                            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                        },
                        [=](const drogon::orm::DrogonDbException& e) {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                                   k500InternalServerError);
                        },
                        std::to_string(versionId), std::to_string(docId)
                    );
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                           k500InternalServerError);
                },
                std::to_string(docId), snapshotUrl, sha256, std::to_string(sizeBytes)
            );
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                   k500InternalServerError);
        },
        std::to_string(docId), sha256
    );
}
```

### 2.5 注册控制器

在 `cpp-service/src/main.cpp` 中注册：

```cpp
#include "controllers/CollaborationController.h"

// 在 main 函数中
app.registerController(std::make_shared<CollaborationController>());
```

---

## 步骤 3：前端编辑器集成

### 3.1 安装依赖

```bash
cd frontend
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder
npm install yjs y-websocket y-prosemirror
```

### 3.2 创建编辑器组件

创建 `frontend/src/components/DocumentEditor.tsx`：

```typescript
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { ySyncPlugin, yCursorPlugin, yUndoPlugin } from 'y-prosemirror';

interface DocumentEditorProps {
    docId: number;
    onSave?: () => void;
}

export function DocumentEditor({ docId, onSave }: DocumentEditorProps) {
    // 创建 Yjs 文档
    const ydoc = new Y.Doc();
    
    // 创建编辑器
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: '开始输入文档内容...',
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] p-4',
            },
        },
    });

    useEffect(() => {
        if (!editor) return;

        // 获取协作令牌
        const connectCollaboration = async () => {
            try {
                // 1. 获取协作令牌
                const tokenResponse = await apiClient.post('/collab/token', { doc_id: docId });
                const { token } = tokenResponse.data;

                // 2. 获取引导快照（如果有）
                const bootstrapResponse = await apiClient.get(`/collab/bootstrap/${docId}`);
                const { snapshot_url, sha256 } = bootstrapResponse.data;

                // 3. 如果有快照，加载它
                if (snapshot_url) {
                    const snapshotResponse = await fetch(snapshot_url);
                    const snapshot = await snapshotResponse.json();
                    // 将快照应用到 Yjs 文档
                    Y.applyUpdate(ydoc, new Uint8Array(snapshot));
                }

                // 4. 连接 WebSocket
                const provider = new WebsocketProvider(
                    'ws://localhost:1234',
                    `doc-${docId}`,
                    ydoc,
                    {
                        params: { token },
                    }
                );

                // 5. 配置 Yjs 插件
                const type = ydoc.getXmlFragment('prosemirror');
                editor.setOptions({
                    extensions: [
                        StarterKit,
                        Placeholder.configure({
                            placeholder: '开始输入文档内容...',
                        }),
                    ],
                    plugins: [
                        ySyncPlugin(type),
                        yCursorPlugin(provider.awareness),
                        yUndoPlugin(),
                    ],
                });

                // 6. 定期保存快照（每 30 秒）
                const saveInterval = setInterval(async () => {
                    const state = Y.encodeStateAsUpdate(ydoc);
                    const snapshot = Array.from(state);
                    const sha256 = await calculateSHA256(JSON.stringify(snapshot));
                    
                    // 上传到 MinIO（这里需要实现上传逻辑）
                    const snapshotUrl = await uploadSnapshot(docId, snapshot, sha256);
                    
                    // 回调到后端
                    await apiClient.post(`/collab/snapshot/${docId}`, {
                        snapshot_url: snapshotUrl,
                        sha256,
                        size_bytes: snapshot.length,
                    });
                }, 30000);

                return () => {
                    clearInterval(saveInterval);
                    provider.destroy();
                };
            } catch (error) {
                console.error('Failed to connect collaboration:', error);
            }
        };

        connectCollaboration();
    }, [editor, docId]);

    return (
        <div className="border border-gray-300 rounded-lg bg-white">
            <EditorContent editor={editor} />
        </div>
    );
}
```

### 3.3 创建文档编辑页面

创建 `frontend/src/pages/DocumentEditorPage.tsx`：

```typescript
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { DocumentEditor } from '../components/DocumentEditor';
import { apiClient } from '../api/client';
import { Document } from '../types';

export function DocumentEditorPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [document, setDocument] = useState<Document | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadDocument();
        }
    }, [id]);

    const loadDocument = async () => {
        if (!id) return;
        try {
            setLoading(true);
            const doc = await apiClient.getDocument(parseInt(id));
            setDocument(doc);
        } catch (err: any) {
            console.error('Failed to load document:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">加载中...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!document || !id) {
        return (
            <Layout>
                <div className="min-h-screen flex items-center justify-center">
                    <p className="text-red-600">文档不存在</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* 返回按钮 */}
                    <div className="mb-6 flex flex-col items-center space-y-3">
                        <div className="w-full text-center">
                            <button
                                onClick={() => navigate(`/docs/${id}`)}
                                className="text-sm text-gray-600 hover:text-gray-900"
                            >
                                返回文档详情
                            </button>
                        </div>
                    </div>

                    {/* 文档标题 */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
                    </div>

                    {/* 编辑器 */}
                    <DocumentEditor docId={parseInt(id)} />
                </div>
            </div>
        </Layout>
    );
}
```

---

## 步骤 4：实现评论系统

### 4.1 创建 CommentController

创建 `cpp-service/src/controllers/CommentController.h`：

```cpp
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

class CommentController : public drogon::HttpController<CommentController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(CommentController::getComments, "/api/docs/{id}/comments", Get, "JwtAuthFilter");
        ADD_METHOD_TO(CommentController::createComment, "/api/docs/{id}/comments", Post, "JwtAuthFilter");
        ADD_METHOD_TO(CommentController::deleteComment, "/api/comments/{id}", Delete, "JwtAuthFilter");
    METHOD_LIST_END

    void getComments(const HttpRequestPtr& req,
                     std::function<void(const HttpResponsePtr&)>&& callback);
    
    void createComment(const HttpRequestPtr& req,
                      std::function<void(const HttpResponsePtr&)>&& callback);
    
    void deleteComment(const HttpRequestPtr& req,
                      std::function<void(const HttpResponsePtr&)>&& callback);
};
```

### 4.2 实现评论接口

创建 `cpp-service/src/controllers/CommentController.cc`：

```cpp
#include "CommentController.h"
#include "../utils/ResponseUtils.h"
#include "../utils/PermissionUtils.h"
#include <json/json.h>

void CommentController::getComments(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数
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
    
    // 3. 检查权限
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }
        
        // 4. 查询评论列表（树形结构）
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }
        
        db->execSqlAsync(
            "SELECT c.id, c.doc_id, c.author_id, c.anchor, c.content, c.parent_id, c.created_at, "
            "       u.email, up.nickname "
            "FROM comment c "
            "LEFT JOIN \"user\" u ON c.author_id = u.id "
            "LEFT JOIN user_profile up ON u.id = up.user_id "
            "WHERE c.doc_id = $1::integer "
            "ORDER BY c.created_at ASC",
            [=](const drogon::orm::Result& r) {
                Json::Value responseJson;
                Json::Value commentsArray(Json::arrayValue);
                
                for (const auto& row : r) {
                    Json::Value commentJson;
                    commentJson["id"] = row["id"].as<int>();
                    commentJson["doc_id"] = row["doc_id"].as<int>();
                    commentJson["author_id"] = row["author_id"].as<int>();
                    commentJson["content"] = row["content"].as<std::string>();
                    commentJson["created_at"] = row["created_at"].as<std::string>();
                    
                    // 解析 anchor JSONB
                    if (!row["anchor"].isNull()) {
                        commentJson["anchor"] = Json::Value(row["anchor"].as<std::string>());
                    }
                    
                    // parent_id
                    if (!row["parent_id"].isNull()) {
                        commentJson["parent_id"] = row["parent_id"].as<int>();
                    }
                    
                    // 作者信息
                    Json::Value authorJson;
                    authorJson["id"] = row["author_id"].as<int>();
                    authorJson["email"] = row["email"].as<std::string>();
                    if (!row["nickname"].isNull()) {
                        authorJson["nickname"] = row["nickname"].as<std::string>();
                    }
                    commentJson["author"] = authorJson;
                    
                    commentsArray.append(commentJson);
                }
                
                responseJson["comments"] = commentsArray;
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                       k500InternalServerError);
            },
            std::to_string(docId)
        );
    });
}

void CommentController::createComment(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数
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
    
    // 3. 检查权限（需要 viewer 或更高权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }
        
        // 4. 解析请求体
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;
        
        if (!json.isMember("content")) {
            ResponseUtils::sendError(*callbackPtr, "content is required", k400BadRequest);
            return;
        }
        
        std::string content = json["content"].asString();
        if (content.empty()) {
            ResponseUtils::sendError(*callbackPtr, "content cannot be empty", k400BadRequest);
            return;
        }
        
        // anchor 和 parent_id 是可选的
        std::string anchorJson = "null";
        if (json.isMember("anchor")) {
            Json::StreamWriterBuilder builder;
            anchorJson = Json::writeString(builder, json["anchor"]);
        }
        
        int parentId = -1;
        if (json.isMember("parent_id") && !json["parent_id"].isNull()) {
            parentId = json["parent_id"].asInt();
        }
        
        // 5. 插入评论
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }
        
        if (parentId > 0) {
            // 回复评论
            db->execSqlAsync(
                "INSERT INTO comment (doc_id, author_id, anchor, content, parent_id) "
                "VALUES ($1::integer, $2::integer, $3::jsonb, $4, $5::integer) "
                "RETURNING id, doc_id, author_id, anchor, content, parent_id, created_at",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Failed to create comment", k500InternalServerError);
                        return;
                    }
                    
                    Json::Value responseJson;
                    responseJson["id"] = r[0]["id"].as<int>();
                    responseJson["doc_id"] = r[0]["doc_id"].as<int>();
                    responseJson["author_id"] = r[0]["author_id"].as<int>();
                    responseJson["content"] = r[0]["content"].as<std::string>();
                    responseJson["created_at"] = r[0]["created_at"].as<std::string>();
                    if (!r[0]["anchor"].isNull()) {
                        responseJson["anchor"] = Json::Value(r[0]["anchor"].as<std::string>());
                    }
                    if (!r[0]["parent_id"].isNull()) {
                        responseJson["parent_id"] = r[0]["parent_id"].as<int>();
                    }
                    
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                           k500InternalServerError);
                },
                std::to_string(docId), std::to_string(userId), anchorJson, content, std::to_string(parentId)
            );
        } else {
            // 新建评论
            db->execSqlAsync(
                "INSERT INTO comment (doc_id, author_id, anchor, content) "
                "VALUES ($1::integer, $2::integer, $3::jsonb, $4) "
                "RETURNING id, doc_id, author_id, anchor, content, parent_id, created_at",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Failed to create comment", k500InternalServerError);
                        return;
                    }
                    
                    Json::Value responseJson;
                    responseJson["id"] = r[0]["id"].as<int>();
                    responseJson["doc_id"] = r[0]["doc_id"].as<int>();
                    responseJson["author_id"] = r[0]["author_id"].as<int>();
                    responseJson["content"] = r[0]["content"].as<std::string>();
                    responseJson["created_at"] = r[0]["created_at"].as<std::string>();
                    if (!r[0]["anchor"].isNull()) {
                        responseJson["anchor"] = Json::Value(r[0]["anchor"].as<std::string>());
                    }
                    
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                           k500InternalServerError);
                },
                std::to_string(docId), std::to_string(userId), anchorJson, content
            );
        }
    });
}

void CommentController::deleteComment(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Comment ID is required", k400BadRequest);
        return;
    }
    int commentId = std::stoi(routingParams[0]);
    
    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    
    // 3. 检查是否是评论作者或文档所有者
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    db->execSqlAsync(
        "SELECT c.author_id, d.owner_id "
        "FROM comment c "
        "JOIN document d ON c.doc_id = d.id "
        "WHERE c.id = $1::integer",
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "Comment not found", k404NotFound);
                return;
            }
            
            int authorId = r[0]["author_id"].as<int>();
            int ownerId = r[0]["owner_id"].as<int>();
            
            if (userId != authorId && userId != ownerId) {
                ResponseUtils::sendError(*callbackPtr, "Forbidden: Only author or document owner can delete comment",
                                        k403Forbidden);
                return;
            }
            
            // 4. 删除评论（级联删除子评论）
            db->execSqlAsync(
                "DELETE FROM comment WHERE id = $1::integer",
                [=](const drogon::orm::Result& r) {
                    Json::Value responseJson;
                    responseJson["message"] = "Comment deleted successfully";
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                           k500InternalServerError);
                },
                std::to_string(commentId)
            );
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                   k500InternalServerError);
        },
        std::to_string(commentId)
    );
}
```

---

## 步骤 5：实现任务管理

### 5.1 创建 TaskController

创建 `cpp-service/src/controllers/TaskController.h`：

```cpp
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

class TaskController : public drogon::HttpController<TaskController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(TaskController::getTasks, "/api/docs/{id}/tasks", Get, "JwtAuthFilter");
        ADD_METHOD_TO(TaskController::createTask, "/api/docs/{id}/tasks", Post, "JwtAuthFilter");
        ADD_METHOD_TO(TaskController::updateTask, "/api/tasks/{id}", Patch, "JwtAuthFilter");
        ADD_METHOD_TO(TaskController::deleteTask, "/api/tasks/{id}", Delete, "JwtAuthFilter");
    METHOD_LIST_END

    void getTasks(const HttpRequestPtr& req,
                  std::function<void(const HttpResponsePtr&)>&& callback);
    
    void createTask(const HttpRequestPtr& req,
                   std::function<void(const HttpResponsePtr&)>&& callback);
    
    void updateTask(const HttpRequestPtr& req,
                   std::function<void(const HttpResponsePtr&)>&& callback);
    
    void deleteTask(const HttpRequestPtr& req,
                   std::function<void(const HttpResponsePtr&)>&& callback);
};
```

### 5.2 实现任务接口

创建 `cpp-service/src/controllers/TaskController.cc`：

```cpp
#include "TaskController.h"
#include "../utils/ResponseUtils.h"
#include "../utils/PermissionUtils.h"
#include <json/json.h>

void TaskController::getTasks(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数
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
    
    // 3. 检查权限
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "viewer", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
            return;
        }
        
        // 4. 查询任务列表
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }
        
        db->execSqlAsync(
            "SELECT t.id, t.doc_id, t.assignee_id, t.title, t.status, t.due_at, "
            "       t.created_by, t.created_at, t.updated_at, "
            "       u.email as assignee_email, up.nickname as assignee_nickname "
            "FROM task t "
            "LEFT JOIN \"user\" u ON t.assignee_id = u.id "
            "LEFT JOIN user_profile up ON u.id = up.user_id "
            "WHERE t.doc_id = $1::integer "
            "ORDER BY t.created_at DESC",
            [=](const drogon::orm::Result& r) {
                Json::Value responseJson;
                Json::Value tasksArray(Json::arrayValue);
                
                for (const auto& row : r) {
                    Json::Value taskJson;
                    taskJson["id"] = row["id"].as<int>();
                    taskJson["doc_id"] = row["doc_id"].as<int>();
                    taskJson["title"] = row["title"].as<std::string>();
                    taskJson["status"] = row["status"].as<std::string>();
                    taskJson["created_at"] = row["created_at"].as<std::string>();
                    taskJson["updated_at"] = row["updated_at"].as<std::string>();
                    
                    if (!row["assignee_id"].isNull()) {
                        taskJson["assignee_id"] = row["assignee_id"].as<int>();
                        Json::Value assigneeJson;
                        assigneeJson["id"] = row["assignee_id"].as<int>();
                        assigneeJson["email"] = row["assignee_email"].as<std::string>();
                        if (!row["assignee_nickname"].isNull()) {
                            assigneeJson["nickname"] = row["assignee_nickname"].as<std::string>();
                        }
                        taskJson["assignee"] = assigneeJson;
                    }
                    
                    if (!row["due_at"].isNull()) {
                        taskJson["due_at"] = row["due_at"].as<std::string>();
                    }
                    
                    taskJson["created_by"] = row["created_by"].as<int>();
                    
                    tasksArray.append(taskJson);
                }
                
                responseJson["tasks"] = tasksArray;
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
            },
            [=](const drogon::orm::DrogonDbException& e) {
                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                       k500InternalServerError);
            },
            std::to_string(docId)
        );
    });
}

void TaskController::createTask(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数
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
    
    // 3. 检查权限（需要 editor 或更高权限）
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    PermissionUtils::hasPermission(docId, userId, "editor", [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(*callbackPtr, "Forbidden: Only editor or owner can create tasks",
                                    k403Forbidden);
            return;
        }
        
        // 4. 解析请求体
        auto jsonPtr = req->jsonObject();
        if (!jsonPtr) {
            ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
            return;
        }
        Json::Value json = *jsonPtr;
        
        if (!json.isMember("title")) {
            ResponseUtils::sendError(*callbackPtr, "title is required", k400BadRequest);
            return;
        }
        
        std::string title = json["title"].asString();
        if (title.empty()) {
            ResponseUtils::sendError(*callbackPtr, "title cannot be empty", k400BadRequest);
            return;
        }
        
        // assignee_id 和 due_at 是可选的
        int assigneeId = -1;
        if (json.isMember("assignee_id") && !json["assignee_id"].isNull()) {
            assigneeId = json["assignee_id"].asInt();
        }
        
        std::string dueAt = "";
        if (json.isMember("due_at") && !json["due_at"].isNull()) {
            dueAt = json["due_at"].asString();
        }
        
        // 5. 插入任务
        auto db = drogon::app().getDbClient();
        if (!db) {
            ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
            return;
        }
        
        if (assigneeId > 0 && !dueAt.empty()) {
            db->execSqlAsync(
                "INSERT INTO task (doc_id, assignee_id, title, due_at, created_by) "
                "VALUES ($1::integer, $2::integer, $3, $4::timestamptz, $5::integer) "
                "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, updated_at",
                [=](const drogon::orm::Result& r) {
                    buildTaskResponse(r, callbackPtr);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                           k500InternalServerError);
                },
                std::to_string(docId), std::to_string(assigneeId), title, dueAt, std::to_string(userId)
            );
        } else if (assigneeId > 0) {
            db->execSqlAsync(
                "INSERT INTO task (doc_id, assignee_id, title, created_by) "
                "VALUES ($1::integer, $2::integer, $3, $4::integer) "
                "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, updated_at",
                [=](const drogon::orm::Result& r) {
                    buildTaskResponse(r, callbackPtr);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                           k500InternalServerError);
                },
                std::to_string(docId), std::to_string(assigneeId), title, std::to_string(userId)
            );
        } else {
            db->execSqlAsync(
                "INSERT INTO task (doc_id, title, created_by) "
                "VALUES ($1::integer, $2, $3::integer) "
                "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, updated_at",
                [=](const drogon::orm::Result& r) {
                    buildTaskResponse(r, callbackPtr);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                           k500InternalServerError);
                },
                std::to_string(docId), title, std::to_string(userId)
            );
        }
    });
}

void TaskController::updateTask(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Task ID is required", k400BadRequest);
        return;
    }
    int taskId = std::stoi(routingParams[0]);
    
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
    
    // 4. 检查权限（必须是任务分配者、创建者或文档所有者）
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    db->execSqlAsync(
        "SELECT t.doc_id, t.assignee_id, t.created_by, d.owner_id "
        "FROM task t "
        "JOIN document d ON t.doc_id = d.id "
        "WHERE t.id = $1::integer",
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "Task not found", k404NotFound);
                return;
            }
            
            int docId = r[0]["doc_id"].as<int>();
            int assigneeId = r[0]["assignee_id"].isNull() ? -1 : r[0]["assignee_id"].as<int>();
            int createdBy = r[0]["created_by"].as<int>();
            int ownerId = r[0]["owner_id"].as<int>();
            
            if (userId != assigneeId && userId != createdBy && userId != ownerId) {
                ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
                return;
            }
            
            // 5. 构建更新 SQL
            std::vector<std::string> updateFields;
            std::vector<std::string> updateValues;
            
            if (json.isMember("status")) {
                std::string status = json["status"].asString();
                if (status != "todo" && status != "doing" && status != "done") {
                    ResponseUtils::sendError(*callbackPtr, "Invalid status", k400BadRequest);
                    return;
                }
                updateFields.push_back("status = $" + std::to_string(updateFields.size() + 1));
                updateValues.push_back(status);
            }
            
            if (json.isMember("title")) {
                std::string title = json["title"].asString();
                if (title.empty()) {
                    ResponseUtils::sendError(*callbackPtr, "title cannot be empty", k400BadRequest);
                    return;
                }
                updateFields.push_back("title = $" + std::to_string(updateFields.size() + 1));
                updateValues.push_back(title);
            }
            
            if (json.isMember("assignee_id")) {
                int assigneeId = json["assignee_id"].asInt();
                updateFields.push_back("assignee_id = $" + std::to_string(updateFields.size() + 1) + "::integer");
                updateValues.push_back(std::to_string(assigneeId));
            }
            
            if (json.isMember("due_at")) {
                std::string dueAt = json["due_at"].asString();
                updateFields.push_back("due_at = $" + std::to_string(updateFields.size() + 1) + "::timestamptz");
                updateValues.push_back(dueAt);
            }
            
            if (updateFields.empty()) {
                ResponseUtils::sendError(*callbackPtr, "No fields to update", k400BadRequest);
                return;
            }
            
            updateFields.push_back("updated_at = NOW()");
            
            // 6. 执行更新
            std::string sql = "UPDATE task SET " + 
                             std::accumulate(updateFields.begin(), updateFields.end(), std::string(),
                                            [](const std::string& a, const std::string& b) {
                                                return a.empty() ? b : a + ", " + b;
                                            }) +
                             " WHERE id = $" + std::to_string(updateFields.size() + 1) + "::integer "
                             "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, updated_at";
            
            std::vector<std::string> params = updateValues;
            params.push_back(std::to_string(taskId));
            
            // 注意：这里需要根据参数数量动态构建 execSqlAsync 调用
            // 简化版本：只支持 status 更新
            if (json.isMember("status")) {
                std::string status = json["status"].asString();
                db->execSqlAsync(
                    "UPDATE task SET status = $1, updated_at = NOW() WHERE id = $2::integer "
                    "RETURNING id, doc_id, assignee_id, title, status, due_at, created_by, created_at, updated_at",
                    [=](const drogon::orm::Result& r) {
                        buildTaskResponse(r, callbackPtr);
                    },
                    [=](const drogon::orm::DrogonDbException& e) {
                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                               k500InternalServerError);
                    },
                    status, std::to_string(taskId)
                );
            }
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                   k500InternalServerError);
        },
        std::to_string(taskId)
    );
}

void TaskController::deleteTask(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数
    auto routingParams = req->getRoutingParameters();
    if (routingParams.empty()) {
        ResponseUtils::sendError(callback, "Task ID is required", k400BadRequest);
        return;
    }
    int taskId = std::stoi(routingParams[0]);
    
    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    
    // 3. 检查权限（必须是创建者或文档所有者）
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    db->execSqlAsync(
        "SELECT t.created_by, d.owner_id "
        "FROM task t "
        "JOIN document d ON t.doc_id = d.id "
        "WHERE t.id = $1::integer",
        [=](const drogon::orm::Result& r) {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "Task not found", k404NotFound);
                return;
            }
            
            int createdBy = r[0]["created_by"].as<int>();
            int ownerId = r[0]["owner_id"].as<int>();
            
            if (userId != createdBy && userId != ownerId) {
                ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
                return;
            }
            
            // 4. 删除任务
            db->execSqlAsync(
                "DELETE FROM task WHERE id = $1::integer",
                [=](const drogon::orm::Result&) {
                    Json::Value responseJson;
                    responseJson["message"] = "Task deleted successfully";
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                           k500InternalServerError);
                },
                std::to_string(taskId)
            );
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                   k500InternalServerError);
        },
        std::to_string(taskId)
    );
}

// 辅助函数：构建任务响应
static void buildTaskResponse(const drogon::orm::Result& r,
                               std::shared_ptr<std::function<void(const HttpResponsePtr&)>> callbackPtr) {
    if (r.empty()) {
        ResponseUtils::sendError(*callbackPtr, "Task not found", k404NotFound);
        return;
    }
    
    Json::Value taskJson;
    taskJson["id"] = r[0]["id"].as<int>();
    taskJson["doc_id"] = r[0]["doc_id"].as<int>();
    taskJson["title"] = r[0]["title"].as<std::string>();
    taskJson["status"] = r[0]["status"].as<std::string>();
    taskJson["created_at"] = r[0]["created_at"].as<std::string>();
    taskJson["updated_at"] = r[0]["updated_at"].as<std::string>();
    taskJson["created_by"] = r[0]["created_by"].as<int>();
    
    if (!r[0]["assignee_id"].isNull()) {
        taskJson["assignee_id"] = r[0]["assignee_id"].as<int>();
    }
    
    if (!r[0]["due_at"].isNull()) {
        taskJson["due_at"] = r[0]["due_at"].as<std::string>();
    }
    
    ResponseUtils::sendSuccess(*callbackPtr, taskJson, k200OK);
}
```

---

## 步骤 6：实现通知系统

### 6.1 创建 NotificationController

创建 `cpp-service/src/controllers/NotificationController.h`：

```cpp
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

class NotificationController : public drogon::HttpController<NotificationController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(NotificationController::getNotifications, "/api/notifications", Get, "JwtAuthFilter");
        ADD_METHOD_TO(NotificationController::markAsRead, "/api/notifications/read", Post, "JwtAuthFilter");
        ADD_METHOD_TO(NotificationController::getUnreadCount, "/api/notifications/unread-count", Get, "JwtAuthFilter");
    METHOD_LIST_END

    void getNotifications(const HttpRequestPtr& req,
                          std::function<void(const HttpResponsePtr&)>&& callback);
    
    void markAsRead(const HttpRequestPtr& req,
                   std::function<void(const HttpResponsePtr&)>&& callback);
    
    void getUnreadCount(const HttpRequestPtr& req,
                       std::function<void(const HttpResponsePtr&)>&& callback);
};
```

### 6.2 实现通知接口

创建 `cpp-service/src/controllers/NotificationController.cc`：

```cpp
#include "NotificationController.h"
#include "../utils/ResponseUtils.h"
#include <json/json.h>

void NotificationController::getNotifications(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    
    // 2. 解析查询参数
    int page = 1;
    int pageSize = 20;
    bool unreadOnly = false;
    
    try {
        std::string pageStr = req->getParameter("page");
        if (!pageStr.empty()) page = std::max(1, std::stoi(pageStr));
    } catch (...) {}
    
    try {
        std::string pageSizeStr = req->getParameter("page_size");
        if (!pageSizeStr.empty()) pageSize = std::max(1, std::min(100, std::stoi(pageSizeStr)));
    } catch (...) {}
    
    std::string unreadOnlyStr = req->getParameter("unread_only");
    if (unreadOnlyStr == "true" || unreadOnlyStr == "1") {
        unreadOnly = true;
    }
    
    // 3. 查询通知列表
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    std::string whereClause = unreadOnly ? "WHERE n.user_id = $1::integer AND n.is_read = FALSE" 
                                         : "WHERE n.user_id = $1::integer";
    int offset = (page - 1) * pageSize;
    
    db->execSqlAsync(
        "SELECT n.id, n.type, n.payload, n.is_read, n.created_at "
        "FROM notification n " + whereClause + " "
        "ORDER BY n.created_at DESC "
        "LIMIT $" + std::to_string(unreadOnly ? 2 : 2) + " OFFSET $" + std::to_string(unreadOnly ? 3 : 3),
        [=](const drogon::orm::Result& r) {
            Json::Value responseJson;
            Json::Value notificationsArray(Json::arrayValue);
            
            for (const auto& row : r) {
                Json::Value notificationJson;
                notificationJson["id"] = row["id"].as<int>();
                notificationJson["type"] = row["type"].as<std::string>();
                notificationJson["is_read"] = row["is_read"].as<bool>();
                notificationJson["created_at"] = row["created_at"].as<std::string>();
                
                // 解析 payload JSONB
                if (!row["payload"].isNull()) {
                    notificationJson["payload"] = Json::Value(row["payload"].as<std::string>());
                }
                
                notificationsArray.append(notificationJson);
            }
            
            responseJson["notifications"] = notificationsArray;
            responseJson["page"] = page;
            responseJson["page_size"] = pageSize;
            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                   k500InternalServerError);
        },
        std::to_string(userId), std::to_string(pageSize), std::to_string(offset)
    );
}

void NotificationController::markAsRead(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
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
    
    // 3. 获取通知 ID 列表
    if (!json.isMember("notification_ids") || !json["notification_ids"].isArray()) {
        ResponseUtils::sendError(callback, "notification_ids array is required", k400BadRequest);
        return;
    }
    
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    // 4. 批量标记为已读
    Json::Value idsArray = json["notification_ids"];
    std::vector<int> notificationIds;
    for (const auto& id : idsArray) {
        notificationIds.push_back(id.asInt());
    }
    
    if (notificationIds.empty()) {
        ResponseUtils::sendError(*callbackPtr, "notification_ids cannot be empty", k400BadRequest);
        return;
    }
    
    // 构建 SQL IN 子句
    std::string idsStr;
    for (size_t i = 0; i < notificationIds.size(); ++i) {
        if (i > 0) idsStr += ",";
        idsStr += std::to_string(notificationIds[i]);
    }
    
    db->execSqlAsync(
        "UPDATE notification SET is_read = TRUE "
        "WHERE id IN (" + idsStr + ") AND user_id = $1::integer",
        [=](const drogon::orm::Result&) {
            Json::Value responseJson;
            responseJson["message"] = "Notifications marked as read";
            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                   k500InternalServerError);
        },
        std::to_string(userId)
    );
}

void NotificationController::getUnreadCount(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    
    // 2. 查询未读通知数量
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    db->execSqlAsync(
        "SELECT COUNT(*) as count FROM notification WHERE user_id = $1::integer AND is_read = FALSE",
        [=](const drogon::orm::Result& r) {
            Json::Value responseJson;
            responseJson["unread_count"] = r[0]["count"].as<int>();
            ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                   k500InternalServerError);
        },
        std::to_string(userId)
    );
}
```

### 6.3 通知触发机制

在创建评论、任务等操作时，需要触发通知。创建 `cpp-service/src/utils/NotificationUtils.h`：

```cpp
#pragma once
#include <string>
#include <json/json.h>

class NotificationUtils {
public:
    // 创建评论通知
    static void createCommentNotification(int docId, int commentId, int authorId, int targetUserId);
    
    // 创建任务分配通知
    static void createTaskAssignmentNotification(int docId, int taskId, int assigneeId);
    
    // 创建任务状态变更通知
    static void createTaskStatusNotification(int docId, int taskId, int assigneeId, const std::string& status);
    
    // 创建文档权限变更通知
    static void createPermissionChangeNotification(int docId, int userId, const std::string& permission);
    
private:
    static void insertNotification(int userId, const std::string& type, const Json::Value& payload);
};
```

实现 `cpp-service/src/utils/NotificationUtils.cc`：

```cpp
#include "NotificationUtils.h"
#include <drogon/drogon.h>
#include <json/json.h>

void NotificationUtils::createCommentNotification(int docId, int commentId, int authorId, int targetUserId) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["comment_id"] = commentId;
    payload["author_id"] = authorId;
    
    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);
    
    auto db = drogon::app().getDbClient();
    if (!db) return;
    
    // 获取文档的所有者和其他有权限的用户（排除评论作者）
    db->execSqlAsync(
        "SELECT DISTINCT da.user_id "
        "FROM doc_acl da "
        "WHERE da.doc_id = $1::integer AND da.user_id != $2::integer",
        [=](const drogon::orm::Result& r) {
            for (const auto& row : r) {
                int userId = row["user_id"].as<int>();
                insertNotification(userId, "comment", payload);
            }
        },
        [](const drogon::orm::DrogonDbException&) {},
        std::to_string(docId), std::to_string(authorId)
    );
}

void NotificationUtils::createTaskAssignmentNotification(int docId, int taskId, int assigneeId) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["task_id"] = taskId;
    
    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);
    
    insertNotification(assigneeId, "task_assigned", payload);
}

void NotificationUtils::createTaskStatusNotification(int docId, int taskId, int assigneeId, const std::string& status) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["task_id"] = taskId;
    payload["status"] = status;
    
    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);
    
    // 通知任务创建者
    auto db = drogon::app().getDbClient();
    if (!db) return;
    
    db->execSqlAsync(
        "SELECT created_by FROM task WHERE id = $1::integer",
        [=](const drogon::orm::Result& r) {
            if (!r.empty()) {
                int createdBy = r[0]["created_by"].as<int>();
                if (createdBy != assigneeId) {
                    insertNotification(createdBy, "task_status_changed", payload);
                }
            }
        },
        [](const drogon::orm::DrogonDbException&) {},
        std::to_string(taskId)
    );
}

void NotificationUtils::createPermissionChangeNotification(int docId, int userId, const std::string& permission) {
    Json::Value payload;
    payload["doc_id"] = docId;
    payload["permission"] = permission;
    
    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);
    
    insertNotification(userId, "permission_changed", payload);
}

void NotificationUtils::insertNotification(int userId, const std::string& type, const Json::Value& payload) {
    Json::StreamWriterBuilder builder;
    std::string payloadStr = Json::writeString(builder, payload);
    
    auto db = drogon::app().getDbClient();
    if (!db) return;
    
    db->execSqlAsync(
        "INSERT INTO notification (user_id, type, payload) VALUES ($1::integer, $2, $3::jsonb)",
        [](const drogon::orm::Result&) {},
        [](const drogon::orm::DrogonDbException&) {},
        std::to_string(userId), type, payloadStr
    );
}
```

---

## 步骤 7：实现全文搜索

### 7.1 部署 Meilisearch

#### 使用 Docker 部署

```bash
docker run -d \
  --name meilisearch \
  -p 7700:7700 \
  -v $(pwd)/meili_data:/meili_data \
  getmeili/meilisearch:latest \
  meilisearch --master-key="your_master_key_here"
```

#### 配置 Meilisearch

创建 `cpp-service/src/services/SearchService.h`：

```cpp
#pragma once
#include <string>
#include <json/json.h>
#include <functional>

class SearchService {
public:
    static void indexDocument(int docId, const std::string& title, const std::string& content);
    static void deleteDocument(int docId);
    static void search(const std::string& query, int page, int pageSize,
                      std::function<void(const Json::Value&)> callback,
                      std::function<void(const std::string&)> errorCallback);
    
private:
    static std::string getMeilisearchUrl();
    static std::string getMasterKey();
};
```

### 7.2 实现搜索服务

创建 `cpp-service/src/services/SearchService.cc`：

```cpp
#include "SearchService.h"
#include <drogon/drogon.h>
#include <drogon/HttpClient.h>
#include <json/json.h>

void SearchService::indexDocument(int docId, const std::string& title, const std::string& content) {
    std::string url = getMeilisearchUrl() + "/indexes/documents/documents";
    std::string masterKey = getMasterKey();
    
    Json::Value document;
    document["id"] = docId;
    document["title"] = title;
    document["content"] = content;
    
    Json::StreamWriterBuilder builder;
    std::string body = Json::writeString(builder, document);
    
    auto client = drogon::HttpClient::newHttpClient(getMeilisearchUrl());
    auto req = drogon::HttpRequest::newHttpRequest();
    req->setMethod(drogon::Post);
    req->setPath("/indexes/documents/documents");
    req->setBody(body);
    req->addHeader("Content-Type", "application/json");
    req->addHeader("Authorization", "Bearer " + masterKey);
    
    client->sendRequest(req, [](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            LOG_ERROR << "Failed to index document";
        }
    });
}

void SearchService::deleteDocument(int docId) {
    std::string url = getMeilisearchUrl() + "/indexes/documents/documents/" + std::to_string(docId);
    std::string masterKey = getMasterKey();
    
    auto client = drogon::HttpClient::newHttpClient(getMeilisearchUrl());
    auto req = drogon::HttpRequest::newHttpRequest();
    req->setMethod(drogon::Delete);
    req->setPath("/indexes/documents/documents/" + std::to_string(docId));
    req->addHeader("Authorization", "Bearer " + masterKey);
    
    client->sendRequest(req, [](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            LOG_ERROR << "Failed to delete document from index";
        }
    });
}

void SearchService::search(const std::string& query, int page, int pageSize,
                          std::function<void(const Json::Value&)> callback,
                          std::function<void(const std::string&)> errorCallback) {
    std::string url = getMeilisearchUrl() + "/indexes/documents/search";
    std::string masterKey = getMasterKey();
    
    Json::Value searchParams;
    searchParams["q"] = query;
    searchParams["page"] = page;
    searchParams["hitsPerPage"] = pageSize;
    
    Json::StreamWriterBuilder builder;
    std::string body = Json::writeString(builder, searchParams);
    
    auto client = drogon::HttpClient::newHttpClient(getMeilisearchUrl());
    auto req = drogon::HttpRequest::newHttpRequest();
    req->setMethod(drogon::Post);
    req->setPath("/indexes/documents/search");
    req->setBody(body);
    req->addHeader("Content-Type", "application/json");
    req->addHeader("Authorization", "Bearer " + masterKey);
    
    client->sendRequest(req, [callback, errorCallback](drogon::ReqResult result, const drogon::HttpResponsePtr& resp) {
        if (result != drogon::ReqResult::Ok) {
            errorCallback("Search request failed");
            return;
        }
        
        Json::Value json;
        Json::Reader reader;
        if (!reader.parse(resp->body(), json)) {
            errorCallback("Failed to parse search response");
            return;
        }
        
        callback(json);
    });
}

std::string SearchService::getMeilisearchUrl() {
    return drogon::app().getCustomConfig()["meilisearch_url"].asString();
}

std::string SearchService::getMasterKey() {
    return drogon::app().getCustomConfig()["meilisearch_master_key"].asString();
}
```

### 7.3 创建搜索控制器

创建 `cpp-service/src/controllers/SearchController.h`：

```cpp
#pragma once
#include <drogon/HttpController.h>
#include <drogon/drogon.h>
#include <functional>

using namespace drogon;

class SearchController : public drogon::HttpController<SearchController> {
public:
    METHOD_LIST_BEGIN
        ADD_METHOD_TO(SearchController::search, "/api/search", Get, "JwtAuthFilter");
    METHOD_LIST_END

    void search(const HttpRequestPtr& req,
                std::function<void(const HttpResponsePtr&)>&& callback);
};
```

实现 `cpp-service/src/controllers/SearchController.cc`：

```cpp
#include "SearchController.h"
#include "../utils/ResponseUtils.h"
#include "../services/SearchService.h"
#include <json/json.h>

void SearchController::search(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取查询参数dracarys@Dracarys:~/projects/codox$ http GET localhost:8080/api/search Authorization:"Bearer $TOKEN" q==协作 page==1 page_size==20
HTTP/1.1 200 OK
content-length: 280
content-type: application/json; charset=utf-8
date: Sat, 15 Nov 2025 17:13:50 GMT
server: drogon/1.9.11

{
    "code": "invalid_content_type",
    "link": "https://docs.meilisearch.com/errors#invalid_content_type",
    "message": "The Content-Type `text/plain; charset=utf-8` is invalid. Accepted values for the Content-Type header are: `application/json`",
    "type": "invalid_request"
}

    std::string query = req->getParameter("q");
    if (query.empty()) {
        ResponseUtils::sendError(callback, "Query parameter 'q' is required", k400BadRequest);
        return;
    }
    
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
    
    // 2. 执行搜索
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    SearchService::search(query, page, pageSize,
        [=](const Json::Value& searchResult) {
            // 3. 过滤结果（只返回用户有权限访问的文档）
            std::string userIdStr = req->getParameter("user_id");
            if (userIdStr.empty()) {
                ResponseUtils::sendError(*callbackPtr, "User ID not found", k401Unauthorized);
                return;
            }
            int userId = std::stoi(userIdStr);
            
            // 获取搜索结果中的文档 ID
            Json::Value hits = searchResult["hits"];
            std::vector<int> docIds;
            for (const auto& hit : hits) {
                docIds.push_back(hit["id"].asInt());
            }
            
            if (docIds.empty()) {
                ResponseUtils::sendSuccess(*callbackPtr, searchResult, k200OK);
                return;
            }
            
            // 查询用户有权限访问的文档
            auto db = drogon::app().getDbClient();
            if (!db) {
                ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
                return;
            }
            
            std::string docIdsStr;
            for (size_t i = 0; i < docIds.size(); ++i) {
                if (i > 0) docIdsStr += ",";
                docIdsStr += std::to_string(docIds[i]);
            }
            
            db->execSqlAsync(
                "SELECT DISTINCT d.id "
                "FROM document d "
                "LEFT JOIN doc_acl da ON d.id = da.doc_id "
                "WHERE d.id IN (" + docIdsStr + ") "
                "AND (d.owner_id = $1::integer OR da.user_id = $1::integer)",
                [=](const drogon::orm::Result& r) {
                    std::set<int> allowedDocIds;
                    for (const auto& row : r) {
                        allowedDocIds.insert(row["id"].as<int>());
                    }
                    
                    // 过滤搜索结果
                    Json::Value filteredHits(Json::arrayValue);
                    for (const auto& hit : hits) {
                        int docId = hit["id"].asInt();
                        if (allowedDocIds.find(docId) != allowedDocIds.end()) {
                            filteredHits.append(hit);
                        }
                    }
                    
                    Json::Value responseJson;
                    responseJson["hits"] = filteredHits;
                    responseJson["query"] = query;
                    responseJson["page"] = page;
                    responseJson["page_size"] = pageSize;
                    responseJson["total_hits"] = static_cast<int>(filteredHits.size());
                    
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k200OK);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()),
                                           k500InternalServerError);
                },
                std::to_string(userId)
            );
        },
        [=](const std::string& error) {
            ResponseUtils::sendError(*callbackPtr, "Search error: " + error, k500InternalServerError);
        }
    );
}
```

---

## 步骤 8：前端组件实现

### 8.1 评论组件

创建 `frontend/src/components/CommentPanel.tsx`：

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface Comment {
    id: number;
    doc_id: number;
    author_id: number;
    author: {
        id: number;
        email: string;
        nickname?: string;
    };
    content: string;
    anchor?: any;
    parent_id?: number;
    created_at: string;
}

interface CommentPanelProps {
    docId: number;
}

export function CommentPanel({ docId }: CommentPanelProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadComments();
    }, [docId]);

    const loadComments = async () => {
        try {
            const response = await apiClient.get(`/docs/${docId}/comments`);
            setComments(response.data.comments || []);
        } catch (err) {
            console.error('Failed to load comments:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            setLoading(true);
            await apiClient.post(`/docs/${docId}/comments`, {
                content: newComment,
            });
            setNewComment('');
            loadComments();
        } catch (err) {
            console.error('Failed to create comment:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (commentId: number) => {
        if (!confirm('确定要删除这条评论吗？')) return;

        try {
            await apiClient.delete(`/comments/${commentId}`);
            loadComments();
        } catch (err) {
            console.error('Failed to delete comment:', err);
        }
    };

    return (
        <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold mb-4">评论</h3>

            {/* 评论列表 */}
            <div className="space-y-4 mb-4">
                {comments.map((comment) => (
                    <div key={comment.id} className="border-b border-gray-100 pb-3">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm">
                                        {comment.author.nickname || comment.author.email}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {new Date(comment.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-700">{comment.content}</p>
                            </div>
                            <button
                                onClick={() => handleDelete(comment.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* 添加评论 */}
            <form onSubmit={handleSubmit} className="space-y-2">
                <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="添加评论..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                />
                <button
                    type="submit"
                    disabled={loading || !newComment.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? '提交中...' : '提交评论'}
                </button>
            </form>
        </div>
    );
}
```

### 8.2 任务管理组件

创建 `frontend/src/components/TaskPanel.tsx`：

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface Task {
    id: number;
    doc_id: number;
    title: string;
    status: 'todo' | 'doing' | 'done';
    assignee_id?: number;
    assignee?: {
        id: number;
        email: string;
        nickname?: string;
    };
    due_at?: string;
    created_by: number;
    created_at: string;
    updated_at: string;
}

interface TaskPanelProps {
    docId: number;
}

export function TaskPanel({ docId }: TaskPanelProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadTasks();
    }, [docId]);

    const loadTasks = async () => {
        try {
            const response = await apiClient.get(`/docs/${docId}/tasks`);
            setTasks(response.data.tasks || []);
        } catch (err) {
            console.error('Failed to load tasks:', err);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        try {
            setLoading(true);
            await apiClient.post(`/docs/${docId}/tasks`, {
                title: newTaskTitle,
            });
            setNewTaskTitle('');
            loadTasks();
        } catch (err) {
            console.error('Failed to create task:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (taskId: number, newStatus: 'todo' | 'doing' | 'done') => {
        try {
            await apiClient.patch(`/tasks/${taskId}`, {
                status: newStatus,
            });
            loadTasks();
        } catch (err) {
            console.error('Failed to update task:', err);
        }
    };

    const handleDelete = async (taskId: number) => {
        if (!confirm('确定要删除这个任务吗？')) return;

        try {
            await apiClient.delete(`/tasks/${taskId}`);
            loadTasks();
        } catch (err) {
            console.error('Failed to delete task:', err);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'todo': return 'bg-gray-200 text-gray-800';
            case 'doing': return 'bg-yellow-200 text-yellow-800';
            case 'done': return 'bg-green-200 text-green-800';
            default: return 'bg-gray-200 text-gray-800';
        }
    };

    return (
        <div className="border-t border-gray-200 pt-4">
            <h3 className="text-lg font-semibold mb-4">任务</h3>

            {/* 任务列表 */}
            <div className="space-y-3 mb-4">
                {tasks.map((task) => (
                    <div key={task.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(task.status)}`}>
                                        {task.status === 'todo' ? '待办' : task.status === 'doing' ? '进行中' : '已完成'}
                                    </span>
                                    {task.assignee && (
                                        <span className="text-xs text-gray-600">
                                            分配给: {task.assignee.nickname || task.assignee.email}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-medium">{task.title}</p>
                                {task.due_at && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        截止: {new Date(task.due_at).toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                {task.status !== 'done' && (
                                    <button
                                        onClick={() => handleUpdateStatus(task.id, task.status === 'todo' ? 'doing' : 'done')}
                                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                    >
                                        {task.status === 'todo' ? '开始' : '完成'}
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(task.id)}
                                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                    删除
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 创建任务 */}
            <form onSubmit={handleCreate} className="space-y-2">
                <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="新任务标题..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="submit"
                    disabled={loading || !newTaskTitle.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {loading ? '创建中...' : '创建任务'}
                </button>
            </form>
        </div>
    );
}
```

### 8.3 通知组件

创建 `frontend/src/components/NotificationBell.tsx`：

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../api/client';

interface Notification {
    id: number;
    type: string;
    payload: any;
    is_read: boolean;
    created_at: string;
}

export function NotificationBell() {
    const [unreadCount, setUnreadCount] = useState(0);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showPanel, setShowPanel] = useState(false);

    useEffect(() => {
        loadUnreadCount();
        const interval = setInterval(loadUnreadCount, 30000); // 每30秒刷新
        return () => clearInterval(interval);
    }, []);

    const loadUnreadCount = async () => {
        try {
            const response = await apiClient.get('/notifications/unread-count');
            setUnreadCount(response.data.unread_count || 0);
        } catch (err) {
            console.error('Failed to load unread count:', err);
        }
    };

    const loadNotifications = async () => {
        try {
            const response = await apiClient.get('/notifications?page=1&page_size=20');
            setNotifications(response.data.notifications || []);
        } catch (err) {
            console.error('Failed to load notifications:', err);
        }
    };

    const handleMarkAsRead = async (notificationIds: number[]) => {
        try {
            await apiClient.post('/notifications/read', {
                notification_ids: notificationIds,
            });
            loadUnreadCount();
            loadNotifications();
        } catch (err) {
            console.error('Failed to mark as read:', err);
        }
    };

    const handleTogglePanel = () => {
        if (!showPanel) {
            loadNotifications();
        }
        setShowPanel(!showPanel);
    };

    return (
        <div className="relative">
            <button
                onClick={handleTogglePanel}
                className="relative p-2 text-gray-600 hover:text-gray-900"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-600"></span>
                )}
            </button>

            {showPanel && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold">通知</h3>
                            {notifications.filter(n => !n.is_read).length > 0 && (
                                <button
                                    onClick={() => handleMarkAsRead(notifications.filter(n => !n.is_read).map(n => n.id))}
                                    className="text-sm text-blue-600 hover:text-blue-800"
                                >
                                    全部标记为已读
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">暂无通知</div>
                        ) : (
                            notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                                        !notification.is_read ? 'bg-blue-50' : ''
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">
                                                {notification.type === 'comment' && '新评论'}
                                                {notification.type === 'task_assigned' && '任务分配'}
                                                {notification.type === 'task_status_changed' && '任务状态变更'}
                                                {notification.type === 'permission_changed' && '权限变更'}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {new Date(notification.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        {!notification.is_read && (
                                            <button
                                                onClick={() => handleMarkAsRead([notification.id])}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                标记已读
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
```

### 8.4 搜索页面

创建 `frontend/src/pages/SearchPage.tsx`：

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { apiClient } from '../api/client';

interface SearchResult {
    id: number;
    title: string;
    content: string;
    _formatted?: {
        title?: string;
        content?: string;
    };
}

export function SearchPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        try {
            setLoading(true);
            const response = await apiClient.get('/search', {
                params: { q: query, page: 1, page_size: 20 },
            });
            setResults(response.data.hits || []);
        } catch (err) {
            console.error('Search failed:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    <h1 className="text-2xl font-bold mb-6">搜索文档</h1>

                    <form onSubmit={handleSearch} className="mb-6">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="输入搜索关键词..."
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                            >
                                {loading ? '搜索中...' : '搜索'}
                            </button>
                        </div>
                    </form>

                    {results.length > 0 && (
                        <div className="space-y-4">
                            {results.map((result) => (
                                <div
                                    key={result.id}
                                    className="bg-white rounded-lg shadow p-4 hover:shadow-md cursor-pointer"
                                    onClick={() => window.location.href = `/docs/${result.id}`}
                                >
                                    <h3 className="text-lg font-semibold mb-2">
                                        {result._formatted?.title || result.title}
                                    </h3>
                                    <p className="text-sm text-gray-600 line-clamp-2">
                                        {result._formatted?.content || result.content}
                                    </p>
                                </div>
                            ))}
                        </div>
                    )}

                    {!loading && query && results.length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                            未找到相关文档
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
```

---

## 步骤 9：集成与路由配置

### 9.1 更新 API 客户端

在 `frontend/src/api/client.ts` 中添加新接口：

```typescript
// 评论相关
export const getComments = (docId: number) => apiClient.get(`/docs/${docId}/comments`);
export const createComment = (docId: number, data: { content: string; anchor?: any; parent_id?: number }) =>
    apiClient.post(`/docs/${docId}/comments`, data);
export const deleteComment = (commentId: number) => apiClient.delete(`/comments/${commentId}`);

// 任务相关
export const getTasks = (docId: number) => apiClient.get(`/docs/${docId}/tasks`);
export const createTask = (docId: number, data: { title: string; assignee_id?: number; due_at?: string }) =>
    apiClient.post(`/docs/${docId}/tasks`, data);
export const updateTask = (taskId: number, data: { status?: string; title?: string; assignee_id?: number; due_at?: string }) =>
    apiClient.patch(`/tasks/${taskId}`, data);
export const deleteTask = (taskId: number) => apiClient.delete(`/tasks/${taskId}`);

// 通知相关
export const getNotifications = (params?: { page?: number; page_size?: number; unread_only?: boolean }) =>
    apiClient.get('/notifications', { params });
export const markNotificationsAsRead = (notificationIds: number[]) =>
    apiClient.post('/notifications/read', { notification_ids: notificationIds });
export const getUnreadNotificationCount = () => apiClient.get('/notifications/unread-count');

// 搜索相关
export const searchDocuments = (query: string, params?: { page?: number; page_size?: number }) =>
    apiClient.get('/search', { params: { q: query, ...params } });

// 协作相关
export const getCollaborationToken = (docId: number) => apiClient.post('/collab/token', { doc_id: docId });
export const getBootstrap = (docId: number) => apiClient.get(`/collab/bootstrap/${docId}`);
```

### 9.2 更新路由

在 `frontend/src/App.tsx` 中添加新路由：

```typescript
import { DocumentEditorPage } from './pages/DocumentEditorPage';
import { SearchPage } from './pages/SearchPage';

// 在路由配置中添加
<Route path="/docs/:id/edit-content" element={<ProtectedRoute><DocumentEditorPage /></ProtectedRoute>} />
<Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
```

### 9.3 更新导航栏

在 `frontend/src/components/Navbar.tsx` 中添加通知铃铛和搜索链接：

```typescript
import { NotificationBell } from './NotificationBell';

// 在导航栏中添加
<Link to="/search">搜索</Link>
<NotificationBell />
```

---

## 步骤 10：测试与验证

### 10.1 后端测试清单

- [ ] 协作令牌生成接口测试
- [ ] 引导快照接口测试
- [ ] 快照回调接口测试
- [ ] 评论 CRUD 接口测试
- [ ] 任务 CRUD 接口测试
- [ ] 通知查询和标记已读接口测试
- [ ] 搜索接口测试
- [ ] 权限验证测试

### 10.2 前端测试清单

- [ ] 文档编辑器加载和编辑测试
- [ ] WebSocket 连接测试
- [ ] 多人协作编辑测试
- [ ] 评论功能测试
- [ ] 任务管理功能测试
- [ ] 通知显示和标记已读测试
- [ ] 搜索功能测试

### 10.3 集成测试

1. **协作编辑测试**
   - 打开两个浏览器窗口，同时编辑同一文档
   - 验证实时同步
   - 验证光标位置显示

2. **评论与任务集成测试**
   - 在文档中添加评论
   - 创建任务并分配给用户
   - 验证通知是否正确触发

3. **搜索权限测试**
   - 使用不同权限的用户搜索
   - 验证只能看到有权限的文档

---

## 步骤 11：配置与部署

### 11.1 后端配置

在 `cpp-service/config.json` 中添加：

```json
{
  "jwt_secret": "your_jwt_secret",
  "meilisearch_url": "http://localhost:7700",
  "meilisearch_master_key": "your_master_key_here",
  "webhook_token": "your_webhook_token_here",
  "minio_endpoint": "localhost:9000",
  "minio_access_key": "minioadmin",
  "minio_secret_key": "minioadmin",
  "minio_bucket": "documents"
}
```

### 11.2 前端环境变量

在 `frontend/.env` 中添加：

```env
VITE_WS_URL=ws://localhost:1234
VITE_API_BASE_URL=http://localhost:8080/api
```

### 11.3 Docker Compose 配置

更新 `docker-compose.yml`：

```yaml
services:
  # ... 其他服务 ...
  
  y-websocket:
    build: ./collab-service
    ports:
      - "1234:1234"
    environment:
      - NODE_ENV=production
  
  meilisearch:
    image: getmeili/meilisearch:latest
    ports:
      - "7700:7700"
    volumes:
      - meili_data:/meili_data
    environment:
      - MEILI_MASTER_KEY=your_master_key_here
  
  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"

volumes:
  meili_data:
  minio_data:
```

---

## 总结

第三阶段开发指南涵盖了以下核心功能：

1. **实时协作编辑**：基于 Yjs + WebSocket 的多人实时编辑
2. **评论系统**：支持行内评论和回复
3. **任务管理**：任务创建、分配和状态跟踪
4. **通知系统**：实时通知和未读计数
5. **全文搜索**：基于 Meilisearch 的文档搜索

### 开发建议

1. **分阶段实现**：先完成协作编辑基础功能，再逐步添加评论、任务等功能
2. **测试驱动**：每个功能完成后立即进行测试
3. **错误处理**：确保所有异步操作都有适当的错误处理
4. **性能优化**：注意 WebSocket 连接管理和搜索索引优化

### 下一步

完成第三阶段后，可以考虑：
- 移动端适配
- 离线编辑支持
- 更丰富的编辑器功能（表格、图片等）
- 文档导入导出
- 系统监控和日志

---

**祝开发顺利！** 🚀