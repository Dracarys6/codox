# 段错误（Segmentation Fault）调试指南

## 🔍 当前问题分析

程序在启动时立即段错误，最可能的原因：

### 1. 配置文件路径问题（最可能）⭐

**问题**：

- 程序从 `./build/cpp-service` 运行
- 但 `config.json` 在 `cpp-service/` 目录
- 程序找不到配置文件，数据库未初始化
- `getDbClient()` 返回 `nullptr`
- 访问空指针导致段错误

**解决方案**：

#### 方案A：从正确的目录运行（推荐）

```bash
cd ~/projects/MultiuserDocument/cpp-service
./build/cpp-service
```

或者：

```bash
cd ~/projects/MultiuserDocument/cpp-service/build
../cpp-service  # 从 build 目录运行，配置文件在上一级
```

#### 方案B：修改 main.cpp 使用绝对路径或相对路径

```cpp
int main(int argc, char* argv[]) {
    // 获取可执行文件所在目录
    std::string configPath = "config.json";
    
    // 如果从 build 目录运行，配置文件在上一级
    if (access("config.json", F_OK) != 0) {
        configPath = "../config.json";
    }
    
    drogon::app()
        .setThreadNum(std::thread::hardware_concurrency())
        .loadConfigFile(configPath)
        .run();
    return 0;
}
```

#### 方案C：复制配置文件到 build 目录

```bash
cp ~/projects/MultiuserDocument/cpp-service/config.json ~/projects/MultiuserDocument/cpp-service/build/
cd ~/projects/MultiuserDocument/cpp-service/build
./cpp-service
```

---

### 2. 数据库连接失败

**检查数据库是否启动**：

```bash
sudo service postgresql status
```

**如果未启动**：

```bash
sudo service postgresql start
```

**测试连接**：

```bash
psql -h 127.0.0.1 -U collab -d collab
# 密码：collab_pass
```

---

### 3. 数据库客户端为空指针

**添加空指针检查**：

```cpp
auto db = drogon::app().getDbClient();
if (!db) {
    sendError(callback, "Database not available", k500InternalServerError);
    return;
}
```

---

## 🔧 调试步骤

### 步骤1：添加调试日志

修改 `main.cpp`：

```cpp
#include <drogon/drogon.h>
#include <iostream>
#include <unistd.h>  // for access()

int main(int argc, char* argv[]) {
    // 检查配置文件
    std::string configPath = "config.json";
    if (access(configPath.c_str(), F_OK) != 0) {
        configPath = "../config.json";
        std::cout << "Trying config at: " << configPath << std::endl;
    }
    
    std::cout << "Loading config from: " << configPath << std::endl;
    
    try {
        drogon::app()
            .setThreadNum(std::thread::hardware_concurrency())
            .loadConfigFile(configPath)
            .run();
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    
    return 0;
}
```

### 步骤2：使用 GDB 调试

```bash
# 安装 GDB
sudo apt install gdb

# 编译时添加调试信息
cd ~/projects/MultiuserDocument/cpp-service/build
cmake .. -DCMAKE_BUILD_TYPE=Debug
make -j$(nproc)

# 使用 GDB 运行
gdb ./cpp-service

# 在 GDB 中：
(gdb) run
(gdb) bt  # 查看堆栈跟踪
```

### 步骤3：使用 Valgrind（内存检查工具）

```bash
# 安装
sudo apt install valgrind

# 运行
valgrind --leak-check=full ./cpp-service
```

---

## ✅ 快速修复（推荐）

**最简单的方法**：从 `cpp-service` 目录运行

```bash
cd ~/projects/MultiuserDocument/cpp-service
./build/cpp-service
```

这样 `config.json` 就在当前目录，可以找到。

---

## 📝 预防措施

### 1. 在 CMakeLists.txt 中添加配置文件复制

```cmake
# 复制配置文件到 build 目录
configure_file(
    "${CMAKE_SOURCE_DIR}/config.json"
    "${CMAKE_BINARY_DIR}/config.json"
    COPYONLY
)
```

### 2. 使用环境变量指定配置文件路径

```cpp
const char* configEnv = getenv("DROGON_CONFIG");
std::string configPath = configEnv ? configEnv : "config.json";
```

### 3. 添加配置文件存在性检查

```cpp
#include <fstream>

std::string configPath = "config.json";
std::ifstream file(configPath);
if (!file.good()) {
    configPath = "../config.json";
    file.open(configPath);
    if (!file.good()) {
        std::cerr << "Config file not found!" << std::endl;
        return 1;
    }
}
file.close();
```

---

## 🎯 立即尝试

1. **确认配置文件存在**：

   ```bash
   ls -la ~/projects/MultiuserDocument/cpp-service/config.json
   ```

2. **从正确目录运行**：

   ```bash
   cd ~/projects/MultiuserDocument/cpp-service
   ./build/cpp-service
   ```

3. **如果还是段错误**，检查数据库：

   ```bash
   sudo service postgresql status
   ```

4. **查看日志**（如果有）：

   ```bash
   ls -la ~/projects/MultiuserDocument/cpp-service/logs/
   ```

告诉我结果！🔍
