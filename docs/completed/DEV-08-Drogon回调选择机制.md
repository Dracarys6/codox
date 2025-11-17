# Drogon 如何选择执行成功/失败回调

## 📌 核心答案

**是的，这是 Drogon 框架的功能！** Drogon 框架会根据数据库操作的结果（成功或失败）自动选择调用相应的回调函数。

---

## 🔍 底层机制

### 1. 注册回调函数

当你调用 `execSqlAsync` 时，Drogon 会：

```cpp
db->execSqlAsync(
    "SELECT ...",                    // SQL 语句
    [](const Result& r) { ... },      // ✅ 成功回调（lambda1）
    [](const DrogonDbException& e) { ... },  // ❌ 失败回调（lambda2）
    params...                         // SQL 参数
);
```

**内部发生了什么：**

```.
┌─────────────────────────────────────────────────────────┐
│  execSqlAsync 函数内部（Drogon 框架）                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 创建一个任务对象（Task）:                             │
│     ┌──────────────────────────────────┐                │
│     │ Task {                           │                │
│     │   SQL: "SELECT ..."              │                │
│     │   successCallback: lambda1       │ ← 保存成功回调  │
│     │   errorCallback: lambda2         │ ← 保存失败回调  │
│     │   params: ...                    │                │
│     │ }                                │                │
│     └──────────────────────────────────┘                │
│                                                         │
│  2. 将任务放入数据库连接池的队列                           │
│                                                         │
│  3. 函数立即返回（不等待结果）                            │
└─────────────────────────────────────────────────────────┘
```

### 2. 数据库连接池执行 SQL

Drogon 的数据库连接池使用 **libpqxx**（PostgreSQL 客户端库）与数据库通信：

```.
┌─────────────────────────────────────────────────────────┐
│  数据库连接池（Drogon）                                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  连接 1: [空闲]                                          │
│  连接 2: [执行 SQL] ──────────┐                         │
│  连接 3: [空闲]              │                         │
│  ...                        │                         │
│                            ▼                         │
│                  ┌─────────────────┐                  │
│                  │   libpqxx       │                  │
│                  │  (PostgreSQL    │                  │
│                  │   C++ 客户端)   │                  │
│                  └────────┬────────┘                  │
│                           │                           │
│                           │ TCP/IP Socket             │
│                           ▼                           │
│                  ┌─────────────────┐                  │
│                  │  PostgreSQL     │                  │
│                  │  数据库服务器   │                  │
│                  └─────────────────┘                  │
└─────────────────────────────────────────────────────────┘
```

**执行流程：**

1. 连接池从队列中取出任务
2. 使用 libpqxx 发送 SQL 到 PostgreSQL
3. **不阻塞线程**：使用非阻塞 I/O（`PQconnectStart`, `PQconsumeInput`）
4. 将 socket 文件描述符注册到 epoll/kqueue

### 3. 操作系统通知（epoll/kqueue）

当数据库返回结果时，操作系统会通知 Drogon：

```.
┌─────────────────────────────────────────────────────────┐
│  操作系统（Linux: epoll, macOS: kqueue）                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. PostgreSQL 返回数据到 socket                         │
│                                                          │
│  2. 内核检测到 socket 可读：                            │
│     ┌──────────────────────────────────┐                │
│     │ epoll_wait() 返回                 │                │
│     │   - socket_fd: 可读               │                │
│     │   - 关联的 Task 对象               │                │
│     └──────────────────────────────────┘                │
│                                                          │
│  3. 通知 Drogon 事件循环                                │
└─────────────────────────────────────────────────────────┘
```

**代码示例（简化版，实际在 Drogon 内部）：**

```cpp
// Drogon 内部伪代码（简化）
void DatabasePool::handleSocketRead(int socketFd) {
    // 1. 读取数据库返回的数据
    auto result = libpqxx_connection->consume();  // 非阻塞读取
    
    // 2. 检查是否有错误
    if (libpqxx_connection->hasError()) {
        // ❌ 失败：调用错误回调
        auto task = getTaskBySocket(socketFd);
        DrogonDbException exception = createException(...);
        task->errorCallback(exception);  // ← 调用失败回调
    } else if (result.isComplete()) {
        // ✅ 成功：调用成功回调
        auto task = getTaskBySocket(socketFd);
        task->successCallback(result);  // ← 调用成功回调
    }
}
```

### 4. Drogon 事件循环调用回调

Drogon 的事件循环（Event Loop）在检测到数据库操作完成时：

```.
┌─────────────────────────────────────────────────────────┐
│  Drogon 事件循环（Event Loop）                          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  while (running) {                                       │
│      // 1. 等待事件（epoll_wait）                        │
│      auto events = epoll_wait(...);                      │
│                                                          │
│      // 2. 处理每个事件                                   │
│      for (auto& event : events) {                       │
│          if (event.type == DATABASE_SOCKET_READY) {      │
│              // 3. 读取数据库结果                        │
│              auto result = readFromDatabase(event.fd);   │
│                                                          │
│              // 4. 判断成功/失败                          │
│              if (result.hasError()) {                    │
│                  // ❌ 调用失败回调                       │
│                  task.errorCallback(exception);          │
│              } else {                                     │
│                  // ✅ 调用成功回调                       │
│                  task.successCallback(result);           │
│              }                                            │
│          }                                               │
│      }                                                   │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 完整流程图

```.
用户代码
    │
    │ db->execSqlAsync(SQL, successCallback, errorCallback)
    │
    ▼
┌─────────────────────────────────────────┐
│ Drogon execSqlAsync                     │
│  1. 创建 Task 对象                        │
│  2. 保存 successCallback 和 errorCallback │
│  3. 将 Task 放入队列                      │
│  4. 立即返回                              │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ 数据库连接池                              │
│  1. 从队列取出 Task                       │
│  2. 使用 libpqxx 发送 SQL                │
│  3. 将 socket 注册到 epoll               │
└──────────────┬──────────────────────────┘
               │
               │ (非阻塞，线程继续处理其他请求)
               │
               ▼
┌─────────────────────────────────────────┐
│ PostgreSQL 数据库                        │
│  执行 SQL，返回结果                       │
└──────────────┬──────────────────────────┘
               │
               │ TCP/IP Socket 可读
               │
               ▼
┌─────────────────────────────────────────┐
│ 操作系统 (epoll/kqueue)                  │
│  检测到 socket 可读                       │
│  通知 Drogon 事件循环                     │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│ Drogon 事件循环                          │
│  1. epoll_wait() 返回可读事件            │
│  2. 读取数据库结果                        │
│  3. 检查结果：                            │
│     ┌──────────────────────────────┐    │
│     │ if (有错误)                   │    │
│     │     ❌ errorCallback()        │    │
│     │ else                          │    │
│     │     ✅ successCallback()      │    │
│     └──────────────────────────────┘    │
└──────────────┬──────────────────────────┘
               │
               ▼
        用户代码的回调函数被执行
```

---

## 🔑 关键点总结

### 1. **这是 Drogon 框架的功能**

- Drogon 框架内部实现了完整的异步 I/O 机制
- 你只需要提供两个回调函数（成功/失败）
- Drogon 会自动判断调用哪一个

### 2. **判断成功/失败的依据**

Drogon 通过以下方式判断：

```cpp
// Drogon 内部逻辑（简化）
if (libpqxx_result.hasError() || libpqxx_result.isFailed()) {
    // ❌ 失败
    DrogonDbException exception(...);
    errorCallback(exception);
} else {
    // ✅ 成功
    Result result = convertToDrogonResult(libpqxx_result);
    successCallback(result);
}
```

**失败的情况包括：**

- SQL 语法错误
- 数据库连接断开
- 权限不足
- 表不存在
- 约束违反
- 等等...

### 3. **底层技术栈**

```.
应用层（你的代码）
    ↓
Drogon 框架
    ↓
libpqxx (PostgreSQL C++ 客户端)
    ↓
libpq (PostgreSQL C 客户端)
    ↓
TCP/IP Socket
    ↓
操作系统 (epoll/kqueue)
    ↓
PostgreSQL 数据库服务器
```

### 4. **为什么需要两个回调？**

```cpp
// ❌ 如果只有一个回调，无法区分成功和失败
db->execSqlAsync(SQL, [](??? result) {
    // 这是成功还是失败？不知道！
});

// ✅ 两个回调，语义清晰
db->execSqlAsync(
    SQL,
    [](const Result& r) { /* 肯定是成功 */ },
    [](const Exception& e) { /* 肯定是失败 */ }
);
```

---

## 💡 实际示例

### 你的代码

```cpp
void PermissionUtils::checkPermission(...) {
    db->execSqlAsync(
        "SELECT ...",
        [=](const Result& r) {           // ← lambda1: 成功回调
            successCallback("owner");
        },
        [=](const DrogonDbException& e) { // ← lambda2: 失败回调
            errorCallback("Database error");
        }
    );
}
```

### Drogon 内部执行（简化）

```cpp
// Drogon 内部（伪代码）
void DbClient::execSqlAsync(...) {
    // 1. 创建任务
    Task task;
    task.sql = sql;
    task.successCallback = successCallback;  // 保存 lambda1
    task.errorCallback = errorCallback;        // 保存 lambda2
    
    // 2. 发送 SQL（非阻塞）
    libpqxx_connection->sendQuery(sql);
    
    // 3. 注册到 epoll
    epoll_add(socket_fd, &task);
    
    // 4. 立即返回
    return;
}

// 事件循环中（伪代码）
void EventLoop::handleDatabaseReady(int socketFd) {
    Task* task = getTaskBySocket(socketFd);
    
    // 读取结果
    auto result = libpqxx_connection->consume();
    
    // 判断成功/失败
    if (result.hasError()) {
        // ❌ 调用失败回调
        DrogonDbException exception(result.getError());
        task->errorCallback(exception);  // ← 调用你的 lambda2
    } else {
        // ✅ 调用成功回调
        Result drogonResult = convert(result);
        task->successCallback(drogonResult);  // ← 调用你的 lambda1
    }
}
```

---

## 🎯 总结

1. **是的，这是 Drogon 框架的功能**
2. **底层使用 epoll/kqueue** 监听数据库 socket
3. **libpqxx** 负责与 PostgreSQL 通信
4. **Drogon 事件循环** 判断成功/失败并调用相应回调
5. **你只需要提供两个回调函数**，Drogon 会自动处理

整个过程是**完全自动的**，你不需要关心底层细节！
