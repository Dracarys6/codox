# 异步函数原理说明

## 📚 目录

1. [为什么需要异步？](#为什么需要异步)
2. [异步 I/O 工作原理](#异步-io-工作原理)
3. [回调函数机制](#回调函数机制)
4. [Lambda 表达式捕获](#lambda-表达式捕获)
5. [执行流程分析](#执行流程分析)
6. [嵌套回调链式调用](#嵌套回调链式调用)

---

## 为什么需要异步？

### 同步 vs 异步

**同步方式（阻塞）：**

```cpp
// 同步方式：线程会一直等待数据库返回结果
std::string PermissionUtils::checkPermissionSync(int docId, int userId) {
    auto db = drogon::app().getDbClient();
    auto result = db->execSqlSync("SELECT ...");  // ❌ 线程在这里阻塞等待
    return result[0]["permission"].as<std::string>();
}

// 问题：
// - 一个线程处理一个请求，等待数据库时线程被占用
// - 1000 个并发请求需要 1000 个线程（资源浪费）
// - 数据库查询通常需要 10-100ms，线程在这期间什么都不做
```

**异步方式（非阻塞）：**

```cpp
// 异步方式：立即返回，不等待数据库结果
void PermissionUtils::checkPermission(..., 
    std::function<void(const std::string&)> successCallback) {
    db->execSqlAsync("SELECT ...", 
        [=](const Result& r) {
            successCallback(r[0]["permission"].as<std::string>());
        }
    );
    // ✅ 函数立即返回，线程可以去处理其他请求
}

// 优势：
// - 一个线程可以处理成千上万个请求
// - 当数据库查询时，线程去处理其他请求
// - 查询完成后，回调函数被调用
```

---

## 异步 I/O 工作原理

### Drogon 框架的异步模型

```.
┌─────────────────────────────────────────────────────────┐
│                   Drogon 事件循环                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ 线程 1   │  │ 线程 2   │  │ 线程 3   │  ...         │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘             │
│       │            │            │                     │
│       └────────────┼────────────┘                     │
│                    │                                   │
│            ┌───────▼────────┐                          │
│            │  Epoll/Kqueue │                          │
│            │  (Linux/macOS)│                          │
│            └───────┬────────┘                          │
└────────────────────┼──────────────────────────────────┘
                     │
       ┌─────────────┼─────────────┐
       │             │             │
   ┌───▼───┐    ┌───▼───┐    ┌───▼───┐
   │ 数据库 │    │ 文件  │    │ 网络  │
   │ 连接池 │    │ 系统  │    │ 请求  │
   └───────┘    └───────┘    └───────┘
```

### 执行流程

1. **请求到达**：HTTP 请求到达服务器
2. **注册回调**：调用 `execSqlAsync`，注册成功/失败回调函数
3. **立即返回**：函数立即返回，不等待数据库
4. **事件循环**：线程继续处理其他请求
5. **数据库完成**：数据库查询完成后，通过 epoll/kqueue 通知
6. **调用回调**：在事件循环中调用注册的回调函数
7. **处理响应**：回调函数处理结果，调用 HTTP 响应回调

---

## 回调函数机制

### 什么是回调函数？

回调函数是一个**延迟执行的函数**，当异步操作完成时被调用。

```cpp
// 回调函数的类型定义
using SuccessCallback = std::function<void(const std::string&)>;
using ErrorCallback = std::function<void(const std::string&)>;

// 函数签名：接受两个回调函数作为参数
void checkPermission(int docId, int userId,
    SuccessCallback successCallback,    // 成功时调用
    ErrorCallback errorCallback          // 失败时调用
);
```

### 回调函数的执行时机

```cpp
void PermissionUtils::checkPermission(...) {
    // 步骤 1：注册异步操作
    db->execSqlAsync(
        "SELECT ...",
        [=](const Result& r) {
            // ✅ 这个函数会在数据库查询完成后被调用
            // 可能是 10ms 后，也可能是 100ms 后
            successCallback("owner");
        },
        [=](const DrogonDbException& e) {
            // ✅ 如果查询失败，这个函数会被调用
            errorCallback("Database error");
        }
    );
    
    // 步骤 2：函数立即返回
    // ❌ 注意：此时 successCallback 还没有被调用！
    // 它会在数据库查询完成后由事件循环调用
}
```

---

## Lambda 表达式捕获

### 捕获语法 `[=]` 的含义

```cpp
void PermissionUtils::hasPermission(int docId, int userId,
    const std::string& requiredPermission,
    std::function<void(bool)> callback) {
    
    checkPermission(
        docId, userId,
        [=](const std::string& actualPermission) {
            // [=] 表示按值捕获所有外部变量
            // 捕获的变量：
            //   - requiredPermission (按值复制)
            //   - callback (按值复制)
            
            bool hasAccess = false;
            if (requiredPermission == "owner") {  // ✅ 可以使用
                hasAccess = (actualPermission == "owner");
            }
            callback(hasAccess);  // ✅ 可以使用
        },
        ...
    );
}
```

### 捕获方式对比

| 捕获方式 | 含义 | 示例 |
|---------|------|------|
| `[=]` | 按值捕获所有外部变量（复制） | `[=] { return x + y; }` |
| `[&]` | 按引用捕获所有外部变量 | `[&] { x = 10; }` |
| `[x, &y]` | 按值捕获 x，按引用捕获 y | `[x, &y] { return x + y; }` |
| `[]` | 不捕获任何变量 | `[] { return 42; }` |

**为什么使用 `[=]`？**

- Lambda 可能在异步操作完成后才执行
- 按值捕获确保变量在回调执行时仍然有效
- 避免悬空引用（dangling reference）问题

### 捕获示例

```cpp
void example() {
    int docId = 123;
    std::string permission = "editor";
    
    checkPermission(
        docId, 456,
        [=](const std::string& result) {
            // ✅ docId 和 permission 被复制到 lambda 中
            // 即使 example() 函数返回，这些值仍然有效
            std::cout << "Doc " << docId << " permission: " << permission;
        }
    );
    
    // 函数返回后，lambda 可能还没有执行
    // 但因为使用了 [=]，变量已经被复制，所以没有问题
}
```

---

## 执行流程分析

### 完整的调用链

以 `hasPermission` 为例：

```cpp
// 1. HTTP 控制器调用
void DocumentController::updateDocument(...) {
    PermissionUtils::hasPermission(
        docId, userId, "editor",
        [callback = std::move(callback)](bool hasAccess) {
            if (hasAccess) {
                // 允许更新
            } else {
                // 返回 403
            }
        }
    );
}

// 2. hasPermission 内部调用 checkPermission
void PermissionUtils::hasPermission(...) {
    checkPermission(
        docId, userId,
        [=](const std::string& actualPermission) {
            // ✅ 这个 lambda 会在数据库查询完成后执行
            // 它捕获了 requiredPermission 和 callback
            bool hasAccess = (actualPermission == "owner" || ...);
            callback(hasAccess);  // 调用 HTTP 控制器的回调
        },
        [=](const std::string& error) {
            callback(false);  // 错误时返回 false
        }
    );
    // ✅ hasPermission 函数立即返回
}

// 3. checkPermission 内部调用 execSqlAsync
void PermissionUtils::checkPermission(...) {
    db->execSqlAsync(
        "SELECT ...",
        [=](const Result& r) {
            // ✅ 这个 lambda 会在数据库查询完成后执行
            // 它捕获了 successCallback
            successCallback(r[0]["permission"].as<std::string>());
        },
        [=](const DrogonDbException& e) {
            errorCallback(std::string(e.base().what()));
        }
    );
    // ✅ checkPermission 函数立即返回
}
```

### 时间线图

```.
时间 →
│
├─ t1: HTTP 请求到达
│  └─ DocumentController::updateDocument() 被调用
│
├─ t2: 调用 hasPermission()
│  └─ 立即返回（不等待）
│
├─ t3: 调用 checkPermission()
│  └─ 立即返回（不等待）
│
├─ t4: 调用 execSqlAsync()
│  └─ 立即返回（不等待）
│  └─ 数据库查询开始（在后台执行）
│
├─ t5: 线程处理其他请求
│  └─ 可能有其他 HTTP 请求被处理
│
├─ t6: 数据库查询完成（10-100ms 后）
│  └─ execSqlAsync 的成功回调被调用
│      └─ successCallback("owner") 被调用
│          └─ hasPermission 的 lambda 被调用
│              └─ callback(true) 被调用
│                  └─ HTTP 响应被发送
│
└─ t7: HTTP 响应发送完成
```

---

## 嵌套回调链式调用

### 回调链的构建

```cpp
void PermissionUtils::hasPermission(
    int docId, 
    int userId,
    const std::string& requiredPermission,
    std::function<void(bool)> callback  // ← 最终的回调
) {
    // 第一层：调用 checkPermission
    checkPermission(
        docId, userId,
        // 第二层：checkPermission 的成功回调
        [=](const std::string& actualPermission) {
            // 在这个回调中，我们处理权限逻辑
            bool hasAccess = ...;
            // 然后调用最终的回调
            callback(hasAccess);  // ← 链式调用
        },
        // 第二层：checkPermission 的错误回调
        [=](const std::string& error) {
            callback(false);  // ← 链式调用
        }
    );
}
```

### 回调链的可视化

```.
HTTP 控制器
    │
    │ hasPermission(..., callback)
    │
    ▼
checkPermission(..., successCallback, errorCallback)
    │
    │ execSqlAsync(..., lambda1, lambda2)
    │
    ├─► lambda1 (数据库成功)
    │       │
    │       │ actualPermission = "owner"
    │       │
    │       ▼
    │   权限判断逻辑
    │       │
    │       │ hasAccess = true
    │       │
    │       ▼
    │   callback(true)  ←──┐
    │                      │
    └─► lambda2 (数据库失败) │
            │              │
            │ error = "..." │
            │              │
            ▼              │
        callback(false) ────┘
                │
                ▼
        HTTP 响应发送
```

---

## 关键要点总结

### ✅ 正确做法

1. **使用回调函数**：异步操作完成后通过回调通知
2. **按值捕获**：使用 `[=]` 捕获外部变量，避免悬空引用
3. **立即返回**：异步函数应该立即返回，不阻塞线程
4. **链式调用**：嵌套回调时，确保最终调用 HTTP 响应回调

### ❌ 常见错误

1. **等待异步操作**：

   ```cpp
   // ❌ 错误：试图等待异步操作
   void wrong() {
       std::string result;
       checkPermission(1, 2, 
           [&result](const std::string& r) { result = r; }
       );
       // ❌ 此时 result 可能还是空的！
       return result;
   }
   ```

2. **悬空引用**：

   ```cpp
   // ❌ 错误：使用引用捕获，但变量可能已销毁
   void wrong() {
       std::string permission = "editor";
       checkPermission(1, 2,
           [&permission](const std::string& r) {  // ❌ [&]
               // 如果 wrong() 函数返回，permission 可能已销毁
           }
       );
   }
   ```

3. **忘记调用回调**：

   ```cpp
   // ❌ 错误：忘记调用回调函数
   void wrong() {
       checkPermission(1, 2,
           [](const std::string& r) {
               // ❌ 处理了结果，但没有调用 HTTP 响应回调
           }
       );
   }
   ```

---

## 实际使用示例

### 在控制器中使用

```cpp
void DocumentController::updateDocument(
    const HttpRequestPtr& req,
    std::function<void(const HttpResponsePtr&)>&& callback
) {
    int docId = std::stoi(req->getParameter("id"));
    int userId = getUserIdFromRequest(req);
    
    // 检查权限
    PermissionUtils::hasPermission(
        docId, userId, "editor",
        [callback = std::move(callback), req](bool hasAccess) mutable {
            if (!hasAccess) {
                // 没有权限，返回 403
                auto resp = HttpResponse::newHttpJsonResponse(
                    Json::Value{"error", "Forbidden"}
                );
                resp->setStatusCode(k403Forbidden);
                callback(resp);
                return;
            }
            
            // 有权限，继续处理更新逻辑
            // ...
        }
    );
}
```

### 多重权限检查

```cpp
void DocumentController::deleteDocument(...) {
    // 需要 owner 权限
    PermissionUtils::hasPermission(
        docId, userId, "owner",
        [=](bool hasAccess) {
            if (!hasAccess) {
                callback(createErrorResponse(403, "Forbidden"));
                return;
            }
            
            // 删除文档
            db->execSqlAsync(
                "DELETE FROM document WHERE id = $1",
                [=](const Result& r) {
                    callback(createSuccessResponse());
                },
                [=](const DrogonDbException& e) {
                    callback(createErrorResponse(500, e.what()));
                },
                std::to_string(docId)
            );
        }
    );
}
```

---

## 总结

异步函数的核心思想：

1. **非阻塞**：函数立即返回，不等待 I/O 操作
2. **回调机制**：操作完成后通过回调函数通知
3. **事件循环**：线程复用，高效处理大量并发请求
4. **链式调用**：嵌套回调构建完整的处理链

这种模式让服务器能够以少量线程处理大量并发请求，大大提高性能！
