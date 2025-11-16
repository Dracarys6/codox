# 文档 CRUD 接口实现指南

本文档提供基于现有代码结构的文档 CRUD 接口实现指南，包含完整的代码示例和最佳实践。

---

## 前置准备

### 已存在的工具类

- ✅ `ResponseUtils`: 发送成功/错误响应
- ✅ `PermissionUtils`: 权限检查
- ✅ `DbUtils`: 数据库操作（可选，也可直接用 `drogon::app().getDbClient()`）
- ✅ `JwtAuthFilter`: JWT 认证中间件（自动将 `user_id` 存入 `req->getParameter("user_id")`）

### 数据库表结构

```sql
-- 文档表
document (id, owner_id, title, is_locked, last_published_version_id, created_at, updated_at)

-- ACL 表
doc_acl (doc_id, user_id, permission)  -- permission: owner/editor/viewer

-- 标签表
tag (id, name)
doc_tag (doc_id, tag_id)
```

---

## 1. 创建文档 (POST /api/docs)

### 创建文档功能需求

- 创建新文档，设置 `owner_id` 为当前用户
- 支持可选标签（tags）
- 自动创建 owner ACL 记录

### 请求体格式

```json
{
  "title": "文档标题",
  "tags": ["tag1", "tag2"]  // 可选
}
```

### 实现代码

```cpp
#include "DocumentController.h"
#include "../utils/ResponseUtils.h"
#include "../utils/DbUtils.h"
#include <drogon/drogon.h>
#include <json/json.h>
#include <memory>

void DocumentController::create(const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 从 JWT 中间件获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    
    // 2. 解析 JSON 请求体
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON or missing body", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;
    std::string title = json.get("title", "").asString();
    
    // 3. 验证标题
    if (title.empty()) {
        ResponseUtils::sendError(callback, "Title is required", k400BadRequest);
        return;
    }
    if (title.length() > 255) {
        ResponseUtils::sendError(callback, "Title too long (max 255 characters)", k400BadRequest);
        return;
    }
    
    // 4. 解析标签（可选）
    Json::Value tagsJson = json.get("tags", Json::Value(Json::arrayValue));
    std::vector<std::string> tags;
    if (tagsJson.isArray()) {
        for (const auto& tag : tagsJson) {
            if (tag.isString()) {
                tags.push_back(tag.asString());
            }
        }
    }
    
    // 5. 获取数据库客户端
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    // 使用 shared_ptr 包装 callback 以支持嵌套异步调用
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    // 6. 开启事务：插入文档
    db->execSqlAsync(
        "INSERT INTO document (owner_id, title) VALUES ($1::integer, $2) RETURNING id, owner_id, title, is_locked, created_at, updated_at",
        [=](const drogon::orm::Result& r) mutable {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "Failed to create document", k500InternalServerError);
                return;
            }
            
            int docId = r[0]["id"].as<int>();
            
            // 7. 插入 owner ACL 记录
            db->execSqlAsync(
                "INSERT INTO doc_acl (doc_id, user_id, permission) VALUES ($1::integer, $2::integer, 'owner') ON CONFLICT DO NOTHING",
                [=](const drogon::orm::Result&) mutable {
                    // 8. 处理标签（如果有）
                    if (tags.empty()) {
                        // 没有标签，直接返回
                        Json::Value responseJson;
                        responseJson["id"] = docId;
                        responseJson["title"] = r[0]["title"].as<std::string>();
                        responseJson["owner_id"] = r[0]["owner_id"].as<int>();
                        responseJson["is_locked"] = r[0]["is_locked"].as<bool>();
                        responseJson["tags"] = Json::Value(Json::arrayValue);
                        responseJson["created_at"] = r[0]["created_at"].as<std::string>();
                        responseJson["updated_at"] = r[0]["updated_at"].as<std::string>();
                        ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                        return;
                    }
                    
                    // 处理标签：先查找或创建标签，再关联
                    processTags(db, docId, tags, r, callbackPtr);
                },
                [=](const drogon::orm::DrogonDbException& e) mutable {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                std::to_string(docId), std::to_string(userId)
            );
        },
        [=](const drogon::orm::DrogonDbException& e) mutable {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(userId), title
    );
}

// 辅助函数：处理标签
void processTags(
    const drogon::orm::DbClientPtr& db,
    int docId,
    const std::vector<std::string>& tags,
    const drogon::orm::Result& docResult,
    std::shared_ptr<std::function<void(const drogon::HttpResponsePtr&)>> callbackPtr) {
    
    // 使用递归或计数器来处理多个标签
    struct TagProcessor {
        drogon::orm::DbClientPtr db;
        int docId;
        std::vector<std::string> tags;
        drogon::orm::Result docResult;
        std::shared_ptr<std::function<void(const drogon::HttpResponsePtr&)>> callbackPtr;
        int index = 0;
        Json::Value tagsArray;
        
        void processNext() {
            if (index >= tags.size()) {
                // 所有标签处理完成，返回响应
                Json::Value responseJson;
                responseJson["id"] = docId;
                responseJson["title"] = docResult[0]["title"].as<std::string>();
                responseJson["owner_id"] = docResult[0]["owner_id"].as<int>();
                responseJson["is_locked"] = docResult[0]["is_locked"].as<bool>();
                responseJson["tags"] = tagsArray;
                responseJson["created_at"] = docResult[0]["created_at"].as<std::string>();
                responseJson["updated_at"] = docResult[0]["updated_at"].as<std::string>();
                ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                return;
            }
            
            std::string tagName = tags[index];
            index++;
            
            // 查找或创建标签
            db->execSqlAsync(
                "INSERT INTO tag (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id, name",
                [=](const drogon::orm::Result& tagResult) mutable {
                    if (!tagResult.empty()) {
                        int tagId = tagResult[0]["id"].as<int>();
                        tagsArray.append(tagResult[0]["name"].as<std::string>());
                        
                        // 关联文档和标签
                        db->execSqlAsync(
                            "INSERT INTO doc_tag (doc_id, tag_id) VALUES ($1::integer, $2::integer) ON CONFLICT DO NOTHING",
                            [=](const drogon::orm::Result&) mutable {
                                processNext();
                            },
                            [=](const drogon::orm::DrogonDbException& e) mutable {
                                ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                            },
                            std::to_string(docId), std::to_string(tagId)
                        );
                    } else {
                        processNext();
                    }
                },
                [=](const drogon::orm::DrogonDbException& e) mutable {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                tagName
            );
        }
    };
    
    TagProcessor processor{db, docId, tags, docResult, callbackPtr};
    processor.processNext();
}
```

### 简化版本（推荐）

如果标签处理逻辑太复杂，可以先创建文档，标签后续通过更新接口添加：

```cpp
void DocumentController::create(const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    
    // 2. 解析 JSON
    auto jsonPtr = req->jsonObject();
    if (!jsonPtr) {
        ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
        return;
    }
    Json::Value json = *jsonPtr;
    std::string title = json.get("title", "").asString();
    
    // 3. 验证标题
    if (title.empty() || title.length() > 255) {
        ResponseUtils::sendError(callback, "Title is required and must be <= 255 characters", k400BadRequest);
        return;
    }
    
    // 4. 获取数据库
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    // 5. 插入文档
    db->execSqlAsync(
        "INSERT INTO document (owner_id, title) VALUES ($1::integer, $2) RETURNING id, owner_id, title, is_locked, created_at, updated_at",
        [=](const drogon::orm::Result& r) mutable {
            if (r.empty()) {
                ResponseUtils::sendError(*callbackPtr, "Failed to create document", k500InternalServerError);
                return;
            }
            
            int docId = r[0]["id"].as<int>();
            
            // 6. 插入 owner ACL
            db->execSqlAsync(
                "INSERT INTO doc_acl (doc_id, user_id, permission) VALUES ($1::integer, $2::integer, 'owner') ON CONFLICT DO NOTHING",
                [=](const drogon::orm::Result&) mutable {
                    Json::Value responseJson;
                    responseJson["id"] = docId;
                    responseJson["title"] = r[0]["title"].as<std::string>();
                    responseJson["owner_id"] = r[0]["owner_id"].as<int>();
                    responseJson["is_locked"] = r[0]["is_locked"].as<bool>();
                    responseJson["tags"] = Json::Value(Json::arrayValue);
                    responseJson["created_at"] = r[0]["created_at"].as<std::string>();
                    responseJson["updated_at"] = r[0]["updated_at"].as<std::string>();
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson, k201Created);
                },
                [=](constdrogon::orm::DrogonDbException& e) mutable {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                std::to_string(docId), std::to_string(userId)
            );
        },
        [=](const drogon::orm::DrogonDbException& e) mutable {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(userId), title
    );
}
```

---

## 2. 获取文档列表 (GET /api/docs)

### (1)功能需求

- 支持分页（page, pageSize）
- 支持筛选：tag、author（owner_id）
- 只返回用户有权限查看的文档

### (2)查询参数

- `page`: 页码（默认 1）
- `pageSize`: 每页数量（默认 20，最大 100）
- `tag`: 标签筛选（可选）
- `author`: 作者筛选（owner_id，可选）

### (3)实现代码

```cpp
void DocumentController::list(const HttpRequestPtr& req,
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
    std::string tagFilter;
    std::string authorFilter;
    
    std::string pageStr = req->getParameter("page");
    if (!pageStr.empty()) {
        try {
            page = std::stoi(pageStr);
            if (page < 1) page = 1;
        } catch (...) {
            page = 1;
        }
    }
    
    std::string pageSizeStr = req->getParameter("pageSize");
    if (!pageSizeStr.empty()) {
        try {
            pageSize = std::stoi(pageSizeStr);
            if (pageSize < 1) pageSize = 20;
            if (pageSize > 100) pageSize = 100;
        } catch (...) {
            pageSize = 20;
        }
    }
    
    tagFilter = req->getParameter("tag");
    authorFilter = req->getParameter("author");
    
    int offset = (page - 1) * pageSize;
    
    // 3. 构建 SQL 查询
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    // 先查询总数
    std::string countSql = 
        "SELECT COUNT(DISTINCT d.id) as total "
        "FROM document d "
        "LEFT JOIN doc_acl a ON d.id = a.doc_id "
        "WHERE (d.owner_id = $1::integer OR a.user_id = $1::integer)";
    
    std::vector<std::string> countParams = {std::to_string(userId)};
    int paramIndex = 2;
    
    if (!tagFilter.empty()) {
        countSql += " AND EXISTS (SELECT 1 FROM doc_tag dt JOIN tag t ON dt.tag_id = t.id WHERE dt.doc_id = d.id AND t.name = $" + std::to_string(paramIndex) + ")";
        countParams.push_back(tagFilter);
        paramIndex++;
    }
    
    if (!authorFilter.empty()) {
        countSql += " AND d.owner_id = $" + std::to_string(paramIndex) + "::integer";
        countParams.push_back(authorFilter);
        paramIndex++;
    }
    
    // 执行计数查询
    db->execSqlAsync(
        countSql,
        [=](const drogon::orm::Result& countResult) mutable {
            int total = countResult.empty() ? 0 : countResult[0]["total"].as<int>();
            
            // 查询文档列表
            std::string listSql = 
                "SELECT DISTINCT d.id, d.title, d.owner_id, d.is_locked, d.created_at, d.updated_at "
                "FROM document d "
                "LEFT JOIN doc_acl a ON d.id = a.doc_id "
                "WHERE (d.owner_id = $1::integer OR a.user_id = $1::integer)";
            
            std::vector<std::string> listParams = {std::to_string(userId)};
            paramIndex = 2;
            
            if (!tagFilter.empty()) {
                listSql += " AND EXISTS (SELECT 1 FROM doc_tag dt JOIN tag t ON dt.tag_id = t.id WHERE dt.doc_id = d.id AND t.name = $" + std::to_string(paramIndex) + ")";
                listParams.push_back(tagFilter);
                paramIndex++;
            }
            
            if (!authorFilter.empty()) {
                listSql += " AND d.owner_id = $" + std::to_string(paramIndex) + "::integer";
                listParams.push_back(authorFilter);
                paramIndex++;
            }
            
            listSql += " ORDER BY d.updated_at DESC LIMIT $" + std::to_string(paramIndex) + " OFFSET $" + std::to_string(paramIndex + 1);
            listParams.push_back(std::to_string(pageSize));
            listParams.push_back(std::to_string(offset));
            
            // 执行列表查询
            db->execSqlAsync(
                listSql,
                [=](const drogon::orm::Result& listResult) mutable {
                    Json::Value responseJson;
                    Json::Value docsArray(Json::arrayValue);
                    
                    for (const auto& row : listResult) {
                        Json::Value docJson;
                        docJson["id"] = row["id"].as<int>();
                        docJson["title"] = row["title"].as<std::string>();
                        docJson["owner_id"] = row["owner_id"].as<int>();
                        docJson["is_locked"] = row["is_locked"].as<bool>();
                        docJson["created_at"] = row["created_at"].as<std::string>();
                        docJson["updated_at"] = row["updated_at"].as<std::string>();
                        docsArray.append(docJson);
                    }
                    
                    responseJson["docs"] = docsArray;
                    responseJson["total"] = total;
                    responseJson["page"] = page;
                    responseJson["pageSize"] = pageSize;
                    
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson);
                },
                [=](const drogon::orm::DrogonDbException& e) mutable {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                listParams
            );
        },
        [=](const drogon::orm::DrogonDbException& e) mutable {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        countParams
    );
}
```

**注意**: Drogon 的 `execSqlAsync` 不支持可变参数列表，需要手动构建参数数组。上面的代码需要调整，使用固定参数数量或使用不同的方法。

### .简化版本（推荐）

```cpp
void DocumentController::list(const HttpRequestPtr& req,
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
    
    try {
        std::string pageStr = req->getParameter("page");
        if (!pageStr.empty()) page = std::max(1, std::stoi(pageStr));
    } catch (...) {}
    
    try {
        std::string pageSizeStr = req->getParameter("pageSize");
        if (!pageSizeStr.empty()) pageSize = std::min(100, std::max(1, std::stoi(pageSizeStr)));
    } catch (...) {}
    
    int offset = (page - 1) * pageSize;
    
    // 3. 查询文档（简化：不处理 tag 和 author 筛选，后续可扩展）
    auto db = drogon::app().getDbClient();
    if (!db) {
        ResponseUtils::sendError(callback, "Database not available", k500InternalServerError);
        return;
    }
    
    auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));
    
    // 查询总数和列表（使用 UNION 简化）
    db->execSqlAsync(
        "SELECT COUNT(DISTINCT d.id) as total "
        "FROM document d "
        "LEFT JOIN doc_acl a ON d.id = a.doc_id "
        "WHERE d.owner_id = $1::integer OR a.user_id = $1::integer",
        [=](const drogon::orm::Result& countResult) mutable {
            int total = countResult.empty() ? 0 : countResult[0]["total"].as<int>();
            
            db->execSqlAsync(
                "SELECT DISTINCT d.id, d.title, d.owner_id, d.is_locked, d.created_at, d.updated_at "
                "FROM document d "
                "LEFT JOIN doc_acl a ON d.id = a.doc_id "
                "WHERE d.owner_id = $1::integer OR a.user_id = $1::integer "
                "ORDER BY d.updated_at DESC "
                "LIMIT $2 OFFSET $3",
                [=](const drogon::orm::Result& listResult) mutable {
                    Json::Value responseJson;
                    Json::Value docsArray(Json::arrayValue);
                    
                    for (const auto& row : listResult) {
                        Json::Value docJson;
                        docJson["id"] = row["id"].as<int>();
                        docJson["title"] = row["title"].as<std::string>();
                        docJson["owner_id"] = row["owner_id"].as<int>();
                        docJson["is_locked"] = row["is_locked"].as<bool>();
                        docJson["created_at"] = row["created_at"].as<std::string>();
                        docJson["updated_at"] = row["updated_at"].as<std::string>();
                        docsArray.append(docJson);
                    }
                    
                    responseJson["docs"] = docsArray;
                    responseJson["total"] = total;
                    responseJson["page"] = page;
                    responseJson["pageSize"] = pageSize;
                    
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson);
                },
                [=](const drogon::orm::DrogonDbException& e) mutable {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                std::to_string(userId), std::to_string(pageSize), std::to_string(offset)
            );
        },
        [=](const drogon::orm::DrogonDbException& e) mutable {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(userId)
    );
}
```

---

## 3. 获取文档详情 (GET /api/docs/:id)

### 获取文档详情功能需求

- 检查用户是否有查看权限
- 返回文档完整信息（包括标签）

### 获取文档详情实现代码

```cpp
void DocumentController::getById(const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数 {id}
    std::string docIdStr = req->getParameter("id");
    if (docIdStr.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    
    int docId;
    try {
        docId = std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }
    
    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    
    // 3. 检查权限
    auto callbackPtr = std::make_shared<std::function<void(const drogon::HttpResponsePtr&)>>(std::move(callback));
    
    PermissionUtils::hasPermission(
        docId, userId, "viewer",
        [=](bool hasPermission) {
            if (!hasPermission) {
                ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
                return;
            }
            
            // 4. 查询文档详情（包括标签）
            auto db = drogon::app().getDbClient();
            if (!db) {
                ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
                return;
            }
            
            db->execSqlAsync(
                "SELECT d.id, d.title, d.owner_id, d.is_locked, d.last_published_version_id, "
                "       d.created_at, d.updated_at, "
                "       COALESCE(json_agg(json_build_object('id', t.id, 'name', t.name)) "
                "                FILTER (WHERE t.id IS NOT NULL), '[]'::json) as tags "
                "FROM document d "
                "LEFT JOIN doc_tag dt ON d.id = dt.doc_id "
                "LEFT JOIN tag t ON dt.tag_id = t.id "
                "WHERE d.id = $1::integer "
                "GROUP BY d.id",
                [=](const drogon::orm::Result& r) {
                    if (r.empty()) {
                        ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                        return;
                    }
                    
                    Json::Value responseJson;
                    responseJson["id"] = r[0]["id"].as<int>();
                    responseJson["title"] = r[0]["title"].as<std::string>();
                    responseJson["owner_id"] = r[0]["owner_id"].as<int>();
                    responseJson["is_locked"] = r[0]["is_locked"].as<bool>();
                    
                    if (!r[0]["last_published_version_id"].isNull()) {
                        responseJson["last_published_version_id"] = r[0]["last_published_version_id"].as<int>();
                    }
                    
                    responseJson["created_at"] = r[0]["created_at"].as<std::string>();
                    responseJson["updated_at"] = r[0]["updated_at"].as<std::string>();
                    
                    // 解析标签 JSON
                    std::string tagsJsonStr = r[0]["tags"].as<std::string>();
                    Json::Reader reader;
                    Json::Value tagsJson;
                    if (reader.parse(tagsJsonStr, tagsJson) && tagsJson.isArray()) {
                        responseJson["tags"] = tagsJson;
                    } else {
                        responseJson["tags"] = Json::Value(Json::arrayValue);
                    }
                    
                    ResponseUtils::sendSuccess(*callbackPtr, responseJson);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                std::to_string(docId)
            );
        }
    );
}
```

---

## 4. 更新文档 (PATCH /api/docs/:id)

### 更新文档功能需求

- 检查用户是否有编辑权限（owner 或 editor）
- 支持更新标题、is_locked 状态
- 支持更新标签（替换所有标签）

### 更新文档请求体格式

```json
{
  "title": "新标题",      // 可选
  "is_locked": false,    // 可选
  "tags": ["tag1", "tag3"]  // 可选，替换所有标签
}
```

### 更新文档实现代码

```cpp
void DocumentController::update(const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数 {id}
    std::string docIdStr = req->getParameter("id");
    if (docIdStr.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    
    int docId;
    try {
        docId = std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }
    
    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    
    // 3. 检查权限（必须是 owner 或 editor）
    auto callbackPtr = std::make_shared<std::function<void(const drogon::HttpResponsePtr&)>>(std::move(callback));
    
    PermissionUtils::hasPermission(
        docId, userId, "editor",
        [=](bool hasPermission) {
            if (!hasPermission) {
                ResponseUtils::sendError(*callbackPtr, "Forbidden", k403Forbidden);
                return;
            }
            
            // 4. 解析 JSON 请求体
            auto jsonPtr = req->jsonObject();
            if (!jsonPtr) {
                ResponseUtils::sendError(*callbackPtr, "Invalid JSON", k400BadRequest);
                return;
            }
            Json::Value json = *jsonPtr;
            
            // 5. 构建更新 SQL（只更新提供的字段）
            std::vector<std::string> updateFields;
            std::vector<std::string> updateValues;
            
            if (json.isMember("title")) {
                std::string title = json["title"].asString();
                if (title.length() > 255) {
                    ResponseUtils::sendError(*callbackPtr, "Title too long", k400BadRequest);
                    return;
                }
                updateFields.push_back("title = $" + std::to_string(updateFields.size() + 1));
                updateValues.push_back(title);
            }
            
            if (json.isMember("is_locked")) {
                bool isLocked = json["is_locked"].asBool();
                updateFields.push_back("is_locked = $" + std::to_string(updateFields.size() + 1));
                updateValues.push_back(isLocked ? "true" : "false");
            }
            
            if (updateFields.empty()) {
                ResponseUtils::sendError(*callbackPtr, "No fields to update", k400BadRequest);
                return;
            }
            
            updateFields.push_back("updated_at = NOW()");
            
            // 6. 执行更新
            auto db = drogon::app().getDbClient();
            if (!db) {
                ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
                return;
            }
            
            std::string updateSql = "UPDATE document SET " + 
                std::accumulate(updateFields.begin(), updateFields.end(), std::string(),
                    [](const std::string& a, const std::string& b) {
                        return a + (a.empty() ? "" : ", ") + b;
                    }) +
                " WHERE id = $" + std::to_string(updateValues.size() + 1) + "::integer RETURNING *";
            
            updateValues.push_back(std::to_string(docId));
            
            // 注意：Drogon 的 execSqlAsync 需要固定参数数量，这里需要根据实际情况调整
            // 简化版本：只处理 title 和 is_locked，标签单独处理
            
            // 简化实现：先更新文档字段
            bool hasTitle = json.isMember("title");
            bool hasIsLocked = json.isMember("is_locked");
            bool hasTags = json.isMember("tags");
            
            std::string title = hasTitle ? json["title"].asString() : "";
            bool isLocked = hasIsLocked ? json["is_locked"].asBool() : false;
            
            if (hasTitle && title.length() > 255) {
                ResponseUtils::sendError(*callbackPtr, "Title too long", k400BadRequest);
                return;
            }
            
            // 构建 SQL（简化：只处理 title 和 is_locked）
            std::string sql;
            if (hasTitle && hasIsLocked) {
                sql = "UPDATE document SET title = $1, is_locked = $2, updated_at = NOW() WHERE id = $3::integer RETURNING *";
            } else if (hasTitle) {
                sql = "UPDATE document SET title = $1, updated_at = NOW() WHERE id = $2::integer RETURNING *";
            } else if (hasIsLocked) {
                sql = "UPDATE document SET is_locked = $1, updated_at = NOW() WHERE id = $2::integer RETURNING *";
            } else {
                ResponseUtils::sendError(*callbackPtr, "No fields to update", k400BadRequest);
                return;
            }
            
            // 执行更新
            if (hasTitle && hasIsLocked) {
                db->execSqlAsync(
                    sql,
                    [=](const drogon::orm::Result& r) {
                        if (r.empty()) {
                            ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                            return;
                        }
                        handleUpdateTags(db, docId, json, r, callbackPtr);
                    },
                    [=](const drogon::orm::DrogonDbException& e) {
                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                    },
                    title, isLocked ? "true" : "false", std::to_string(docId)
                );
            } else if (hasTitle) {
                db->execSqlAsync(
                    sql,
                    [=](const drogon::orm::Result& r) {
                        if (r.empty()) {
                            ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                            return;
                        }
                        handleUpdateTags(db, docId, json, r, callbackPtr);
                    },
                    [=](const drogon::orm::DrogonDbException& e) {
                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                    },
                    title, std::to_string(docId)
                );
            } else {
                db->execSqlAsync(
                    sql,
                    [=](const drogon::orm::Result& r) {
                        if (r.empty()) {
                            ResponseUtils::sendError(*callbackPtr, "Document not found", k404NotFound);
                            return;
                        }
                        handleUpdateTags(db, docId, json, r, callbackPtr);
                    },
                    [=](const drogon::orm::DrogonDbException& e) {
                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                    },
                    isLocked ? "true" : "false", std::to_string(docId)
                );
            }
        }
    );
}

// 辅助函数：处理标签更新
void handleUpdateTags(
    const drogon::orm::DbClientPtr& db,
    int docId,
    const Json::Value& json,
    const drogon::orm::Result& docResult,
    std::shared_ptr<std::function<void(const drogon::HttpResponsePtr&)>> callbackPtr) {
    
    if (!json.isMember("tags")) {
        // 没有标签更新，直接返回文档信息
        Json::Value responseJson;
        responseJson["id"] = docResult[0]["id"].as<int>();
        responseJson["title"] = docResult[0]["title"].as<std::string>();
        responseJson["owner_id"] = docResult[0]["owner_id"].as<int>();
        responseJson["is_locked"] = docResult[0]["is_locked"].as<bool>();
        responseJson["created_at"] = docResult[0]["created_at"].as<std::string>();
        responseJson["updated_at"] = docResult[0]["updated_at"].as<std::string>();
        responseJson["tags"] = Json::Value(Json::arrayValue);
        ResponseUtils::sendSuccess(*callbackPtr, responseJson);
        return;
    }
    
    // 删除旧标签关联
    db->execSqlAsync(
        "DELETE FROM doc_tag WHERE doc_id = $1::integer",
        [=](const drogon::orm::Result&) {
            Json::Value tagsJson = json["tags"];
            if (!tagsJson.isArray() || tagsJson.size() == 0) {
                // 没有新标签，返回
                Json::Value responseJson;
                responseJson["id"] = docResult[0]["id"].as<int>();
                responseJson["title"] = docResult[0]["title"].as<std::string>();
                responseJson["owner_id"] = docResult[0]["owner_id"].as<int>();
                responseJson["is_locked"] = docResult[0]["is_locked"].as<bool>();
                responseJson["created_at"] = docResult[0]["created_at"].as<std::string>();
                responseJson["updated_at"] = docResult[0]["updated_at"].as<std::string>();
                responseJson["tags"] = Json::Value(Json::arrayValue);
                ResponseUtils::sendSuccess(*callbackPtr, responseJson);
                return;
            }
            
            // 处理新标签（简化：逐个插入）
            // 实际应用中可以使用批量插入优化
            struct TagUpdater {
                drogon::orm::DbClientPtr db;
                int docId;
                Json::Value tagsJson;
                drogon::orm::Result docResult;
                std::shared_ptr<std::function<void(const drogon::HttpResponsePtr&)>> callbackPtr;
                int index = 0;
                Json::Value tagsArray;
                
                void processNext() {
                    if (index >= tagsJson.size()) {
                        // 完成，返回响应
                        Json::Value responseJson;
                        responseJson["id"] = docResult[0]["id"].as<int>();
                        responseJson["title"] = docResult[0]["title"].as<std::string>();
                        responseJson["owner_id"] = docResult[0]["owner_id"].as<int>();
                        responseJson["is_locked"] = docResult[0]["is_locked"].as<bool>();
                        responseJson["created_at"] = docResult[0]["created_at"].as<std::string>();
                        responseJson["updated_at"] = docResult[0]["updated_at"].as<std::string>();
                        responseJson["tags"] = tagsArray;
                        ResponseUtils::sendSuccess(*callbackPtr, responseJson);
                        return;
                    }
                    
                    std::string tagName = tagsJson[index].asString();
                    index++;
                    
                    // 查找或创建标签
                    db->execSqlAsync(
                        "INSERT INTO tag (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = $1 RETURNING id, name",
                        [=](const drogon::orm::Result& tagResult) mutable {
                            if (!tagResult.empty()) {
                                int tagId = tagResult[0]["id"].as<int>();
                                tagsArray.append(tagResult[0]["name"].as<std::string>());
                                
                                // 关联文档和标签
                                db->execSqlAsync(
                                    "INSERT INTO doc_tag (doc_id, tag_id) VALUES ($1::integer, $2::integer) ON CONFLICT DO NOTHING",
                                    [=](const drogon::orm::Result&) mutable {
                                        processNext();
                                    },
                                    [=](const drogon::orm::DrogonDbException& e) mutable {
                                        ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                                    },
                                    std::to_string(docId), std::to_string(tagId)
                                );
                            } else {
                                processNext();
                            }
                        },
                        [=](const drogon::orm::DrogonDbException& e) mutable {
                            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                        },
                        tagName
                    );
                }
            };
            
            TagUpdater updater{db, docId, tagsJson, docResult, callbackPtr};
            updater.processNext();
        },
        [=](const drogon::orm::DrogonDbException& e) {
            ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
        },
        std::to_string(docId)
    );
}
```

---

## 5. 删除文档 (DELETE /api/docs/:id)

### 删除文档功能需求

- 只有 owner 可以删除文档
- 级联删除相关数据（ACL、标签关联、版本等）

### 删除文档实现代码

```cpp
void DocumentController::deleteDoc(const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback) {
    
    // 1. 获取路径参数 {id}
    std::string docIdStr = req->getParameter("id");
    if (docIdStr.empty()) {
        ResponseUtils::sendError(callback, "Document ID is required", k400BadRequest);
        return;
    }
    
    int docId;
    try {
        docId = std::stoi(docIdStr);
    } catch (...) {
        ResponseUtils::sendError(callback, "Invalid document ID", k400BadRequest);
        return;
    }
    
    // 2. 获取 user_id
    std::string userIdStr = req->getParameter("user_id");
    if (userIdStr.empty()) {
        ResponseUtils::sendError(callback, "User ID not found", k401Unauthorized);
        return;
    }
    int userId = std::stoi(userIdStr);
    
    // 3. 检查权限（必须是 owner）
    auto callbackPtr = std::make_shared<std::function<void(const drogon::HttpResponsePtr&)>>(std::move(callback));
    
    PermissionUtils::hasPermission(
        docId, userId, "owner",
        [=](bool hasPermission) {
            if (!hasPermission) {
                ResponseUtils::sendError(*callbackPtr, "Forbidden: Only owner can delete document", k403Forbidden);
                return;
            }
            
            // 4. 删除文档（级联删除相关数据）
            auto db = drogon::app().getDbClient();
            if (!db) {
                ResponseUtils::sendError(*callbackPtr, "Database not available", k500InternalServerError);
                return;
            }
            
            db->execSqlAsync(
                "DELETE FROM document WHERE id = $1::integer AND owner_id = $2::integer",
                [=](const drogon::orm::Result& r) {
                    // 检查是否真的删除了文档
                    if (r.affectedRows() == 0) {
                        ResponseUtils::sendError(*callbackPtr, "Document not found or you are not the owner", k404NotFound);
                        return;
                    }
                    
                    // 返回 204 No Content
                    auto resp = HttpResponse::newHttpResponse();
                    resp->setStatusCode(k204NoContent);
                    (*callbackPtr)(resp);
                },
                [=](const drogon::orm::DrogonDbException& e) {
                    ResponseUtils::sendError(*callbackPtr, "Database error: " + std::string(e.base().what()), k500InternalServerError);
                },
                std::to_string(docId), std::to_string(userId)
            );
        }
    );
}
```

---

## 常见问题与注意事项

### 1. 参数绑定

**重要**: Drogon 的 `execSqlAsync` 要求所有参数都是字符串类型，整数需要转换为字符串：

```cpp
// ✅ 正确
db->execSqlAsync(
    "SELECT * FROM document WHERE id = $1::integer",
    ...,
    std::to_string(docId)
);

// ❌ 错误
db->execSqlAsync(
    "SELECT * FROM document WHERE id = $1",
    ...,
    docId  // 会导致错误
);
```

### 2. 异步回调嵌套

使用 `shared_ptr` 包装 callback 以支持嵌套异步调用：

```cpp
auto callbackPtr = std::make_shared<std::function<void(const HttpResponsePtr&)>>(std::move(callback));

db->execSqlAsync(
    "SELECT ...",
    [=](const drogon::orm::Result& r) {
        // 嵌套调用
        db->execSqlAsync(
            "SELECT ...",
            [=](const drogon::orm::Result& r2) {
                ResponseUtils::sendSuccess(*callbackPtr, responseJson);
            },
            ...
        );
    },
    ...
);
```

### 3. JSON 解析

```cpp
auto jsonPtr = req->jsonObject();
if (!jsonPtr) {
    ResponseUtils::sendError(callback, "Invalid JSON", k400BadRequest);
    return;
}
Json::Value json = *jsonPtr;
std::string title = json.get("title", "").asString();
```

### 4. 路径参数获取

```cpp
// 路径参数：/api/docs/{id}
std::string docIdStr = req->getParameter("id");

// 查询参数：/api/docs?page=1&pageSize=20
std::string pageStr = req->getParameter("page");
```

### 5. 错误处理

- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未认证
- `403 Forbidden`: 无权限
- `404 Not Found`: 资源不存在
- `500 Internal Server Error`: 服务器错误

### 6. 权限检查

使用 `PermissionUtils::hasPermission` 检查权限：

```cpp
PermissionUtils::hasPermission(
    docId, userId, "editor",  // 需要 editor 或更高权限
    [=](bool hasPermission) {
        if (!hasPermission) {
            ResponseUtils::sendError(callback, "Forbidden", k403Forbidden);
            return;
        }
        // 继续处理...
    }
);
```

### 7. 事务处理

对于需要原子性的操作（如创建文档 + ACL + 标签），可以使用事务：

```cpp
// 注意：Drogon 的事务使用较复杂，建议先实现基本功能，后续优化
// 或者使用数据库的 ON CONFLICT 等特性保证一致性
```

---

## 📝 开发顺序建议

1. ✅ **实现 create** - 创建文档（最简单）
2. ✅ **实现 getById** - 获取文档详情
3. ✅ **实现 list** - 文档列表
4. ✅ **实现 update** - 更新文档
5. ✅ **实现 deleteDoc** - 删除文档

每一步完成后立即测试！

---

## 🧪 测试示例

### 使用 HTTPie 测试（推荐）

HTTPie 语法更简洁，自动处理 JSON 格式，非常适合 API 测试。

#### 1. 安装 HTTPie

```bash
# Ubuntu/Debian
sudo apt install httpie

# macOS
brew install httpie

# 或使用 pip
pip install httpie
```

#### 2. 基本语法

```bash
# 基本格式
http <METHOD> <URL> [Header:]Value [field=value]

# 示例
http POST http://localhost:8080/api/docs \
  Authorization:"Bearer <token>" \
  title="文档标题"
```

#### 3. 完整测试流程

##### 步骤 1: 登录获取 Token

```bash
# 登录（如果还没有账号，先注册）
http POST http://localhost:8080/api/auth/login \
  account="test@example.com" \
  password="test12345"

# 输出示例：
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "user": { ... }
# }
```

##### 步骤 2: 保存 Token 到环境变量

```bash
# 方法 1: 手动复制 token（推荐用于测试）
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 方法 2: 使用 jq 自动提取（需要安装 jq）
export TOKEN=$(http POST http://localhost:8080/api/auth/login \
  account="test@example.com" \
  password="test12345" | jq -r '.access_token')

# 验证 token
echo $TOKEN
```

##### 步骤 3: 创建文档

```bash
# 创建文档（基本）
http POST http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  title="我的第一个文档"

# 创建文档（带标签）
http POST http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  title="带标签的文档" \
  tags:='["技术","教程"]'

# 注意：JSON 数组需要使用 := 语法，并用单引号包裹
```

##### 步骤 4: 获取文档列表

```bash
# 获取文档列表（默认分页）
http GET http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN"

# 获取文档列表（指定分页）
http GET "http://localhost:8080/api/docs?page=1&pageSize=10" \
  Authorization:"Bearer $TOKEN"

# 获取文档列表（筛选标签）
http GET "http://localhost:8080/api/docs?tag=技术" \
  Authorization:"Bearer $TOKEN"

# 获取文档列表（筛选作者）
http GET "http://localhost:8080/api/docs?author=1" \
  Authorization:"Bearer $TOKEN"
```

##### 步骤 5: 获取文档详情

```bash
# 获取文档详情（替换 1 为实际的文档 ID）
http GET http://localhost:8080/api/docs/1 \
  Authorization:"Bearer $TOKEN"
```

##### 步骤 6: 更新文档

```bash
# 更新文档标题
http PATCH http://localhost:8080/api/docs/1 \
  Authorization:"Bearer $TOKEN" \
  title="更新后的标题"

# 更新多个字段
http PATCH http://localhost:8080/api/docs/1 \
  Authorization:"Bearer $TOKEN" \
  title="新标题" \
  is_locked:=false

# 更新标签（替换所有标签）
http PATCH http://localhost:8080/api/docs/1 \
  Authorization:"Bearer $TOKEN" \
  tags:='["新标签1","新标签2"]'

# 注意：布尔值使用 :=false 或 :=true，不要用引号
```

##### 步骤 7: 删除文档

```bash
# 删除文档（只有 owner 可以删除）
http DELETE http://localhost:8080/api/docs/1 \
  Authorization:"Bearer $TOKEN"
```

#### 4. 完整测试脚本

创建一个测试脚本 `test-docs.sh`：

```bash
#!/bin/bash

# 文档 CRUD 接口测试脚本（使用 HTTPie）

BASE_URL="http://localhost:8080"
EMAIL="test@example.com"
PASSWORD="test12345"

echo "=========================================="
echo "文档 CRUD 接口测试"
echo "=========================================="
echo ""

# 1. 登录获取 Token
echo "[1/7] 登录获取 Token..."
LOGIN_RESPONSE=$(http POST $BASE_URL/api/auth/login \
  account="$EMAIL" \
  password="$PASSWORD" \
  --print=b --body)

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ 登录失败"
    exit 1
fi

echo "✅ 登录成功"
echo "Token: ${TOKEN:0:50}..."
echo ""

# 2. 创建文档
echo "[2/7] 创建文档..."
CREATE_RESPONSE=$(http POST $BASE_URL/api/docs \
  Authorization:"Bearer $TOKEN" \
  title="测试文档" \
  --print=b --body)

DOC_ID=$(echo $CREATE_RESPONSE | jq -r '.id')

if [ "$DOC_ID" = "null" ] || [ -z "$DOC_ID" ]; then
    echo "❌ 创建文档失败"
    exit 1
fi

echo "✅ 文档创建成功，ID: $DOC_ID"
echo ""

# 3. 获取文档列表
echo "[3/7] 获取文档列表..."
http GET "$BASE_URL/api/docs?page=1&pageSize=10" \
  Authorization:"Bearer $TOKEN" \
  --pretty=format
echo ""

# 4. 获取文档详情
echo "[4/7] 获取文档详情 (ID: $DOC_ID)..."
http GET $BASE_URL/api/docs/$DOC_ID \
  Authorization:"Bearer $TOKEN" \
  --pretty=format
echo ""

# 5. 更新文档
echo "[5/7] 更新文档 (ID: $DOC_ID)..."
http PATCH $BASE_URL/api/docs/$DOC_ID \
  Authorization:"Bearer $TOKEN" \
  title="更新后的标题" \
  is_locked:=false \
  --pretty=format
echo ""

# 6. 验证更新
echo "[6/7] 验证更新..."
http GET $BASE_URL/api/docs/$DOC_ID \
  Authorization:"Bearer $TOKEN" \
  --pretty=format
echo ""

# 7. 删除文档
echo "[7/7] 删除文档 (ID: $DOC_ID)..."
http DELETE $BASE_URL/api/docs/$DOC_ID \
  Authorization:"Bearer $TOKEN" \
  --print=Hh
echo ""

echo "=========================================="
echo "✅ 所有测试完成！"
echo "=========================================="
```

使用测试脚本：

```bash
# 给脚本添加执行权限
chmod +x test-docs.sh

# 运行测试
./test-docs.sh
```

#### 5. 错误场景测试

```bash
# 测试 1: 未认证（缺少 Token）
http POST http://localhost:8080/api/docs \
  title="测试文档"
# 预期: 401 Unauthorized

# 测试 2: 无效 Token
http POST http://localhost:8080/api/docs \
  Authorization:"Bearer invalid_token" \
  title="测试文档"
# 预期: 401 Unauthorized

# 测试 3: 缺少必填字段
http POST http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN"
# 预期: 400 Bad Request

# 测试 4: 标题过长
http POST http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  title="这是一个非常非常长的标题..." # 超过 255 字符
# 预期: 400 Bad Request

# 测试 5: 访问不存在的文档
http GET http://localhost:8080/api/docs/99999 \
  Authorization:"Bearer $TOKEN"
# 预期: 404 Not Found

# 测试 6: 无权限访问（使用其他用户的文档 ID）
http GET http://localhost:8080/api/docs/2 \
  Authorization:"Bearer $TOKEN"
# 预期: 403 Forbidden 或 404 Not Found

# 测试 7: 非 owner 尝试删除文档
http DELETE http://localhost:8080/api/docs/2 \
  Authorization:"Bearer $TOKEN"
# 预期: 403 Forbidden
```

#### 6. HTTPie 常用选项

```bash
# --pretty=format: 格式化 JSON 输出（默认）
http GET http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  --pretty=format

# --pretty=none: 不格式化输出
http GET http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  --pretty=none

# --print=HhBb: 打印请求头、响应头、请求体、响应体
http POST http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  title="测试" \
  --print=HhBb

# --verbose: 显示详细信息
http GET http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  --verbose

# --check-status: 检查 HTTP 状态码，非 2xx 时退出
http GET http://localhost:8080/api/docs/999 \
  Authorization:"Bearer $TOKEN" \
  --check-status

# --timeout=5: 设置超时时间（秒）
http GET http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  --timeout=5

# --follow: 跟随重定向
http GET http://localhost:8080/api/docs \
  Authorization:"Bearer $TOKEN" \
  --follow
```

#### 7. 使用配置文件

创建 `~/.httpie/config.json` 保存常用配置：

```json
{
  "default_options": {
    "print": ["H", "h", "B", "b"],
    "pretty": "format"
  }
}
```

#### 8. 快速参考

```bash
# 设置变量
export BASE_URL="http://localhost:8080"
export TOKEN="your_token_here"

# 创建文档
http POST $BASE_URL/api/docs \
  Authorization:"Bearer $TOKEN" \
  title="文档标题"

# 获取列表
http GET "$BASE_URL/api/docs?page=1&pageSize=20" \
  Authorization:"Bearer $TOKEN"

# 获取详情
http GET $BASE_URL/api/docs/1 \
  Authorization:"Bearer $TOKEN"

# 更新文档
http PATCH $BASE_URL/api/docs/1 \
  Authorization:"Bearer $TOKEN" \
  title="新标题" \
  is_locked:=false

# 删除文档
http DELETE $BASE_URL/api/docs/1 \
  Authorization:"Bearer $TOKEN"
```

---

### 使用 curl 测试（备选）

如果系统没有安装 HTTPie，可以使用 curl：

```bash
# 1. 登录获取 token
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"account":"test@example.com","password":"test12345"}' \
  | jq -r '.access_token')

# 2. 创建文档
curl -X POST http://localhost:8080/api/docs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试文档"}' \
  | jq

# 3. 获取文档列表
curl -X GET "http://localhost:8080/api/docs?page=1&pageSize=20" \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# 4. 获取文档详情
curl -X GET http://localhost:8080/api/docs/1 \
  -H "Authorization: Bearer $TOKEN" \
  | jq

# 5. 更新文档
curl -X PATCH http://localhost:8080/api/docs/1 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"更新后的标题","is_locked":false}' \
  | jq

# 6. 删除文档
curl -X DELETE http://localhost:8080/api/docs/1 \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📚 参考资源

- [第二阶段开发指南](./第二阶段开发指南.md) - 完整的开发指南
- [详细设计文档](./详细设计.md) - API 规格和数据库设计
- [开发提示与最佳实践](./开发提示与最佳实践.md) - 开发规范

---

**祝开发顺利！** 🚀
