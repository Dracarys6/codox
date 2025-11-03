# 切换到 apt 安装 jwt-cpp（方案1）

## ⚠️ 重要说明

**注意**：`jwt-cpp`（C++ 库）通常**不在** Ubuntu 标准 apt 仓库中。

Ubuntu apt 仓库中可能有：

- `libjwt` / `libjwt-dev`（这是 C 语言的 JWT 库，**不是** jwt-cpp）
- 没有 `jwt-cpp` 的 C++ 库

## 🔍 步骤1：检查是否有可用包

先检查系统是否有可用的包：

```bash
# 检查是否有 jwt-cpp 相关的包
apt search jwt-cpp

# 或者检查 libjwt（C 库，不是你需要的）
apt search libjwt
```

**如果找到 `jwt-cpp` 相关的包**，直接安装：

```bash
sudo apt update
sudo apt install jwt-cpp-dev  # 或类似的包名
```

---

## 📦 如果没有 apt 包：使用源码安装到系统（推荐替代方案）

由于 apt 仓库通常没有 jwt-cpp，你需要**从源码编译安装到系统目录**（类似方案2，但安装到系统）：

### 步骤1：安装依赖

```bash
sudo apt update
sudo apt install -y git cmake build-essential libssl-dev
```

### 步骤2：克隆并编译安装

```bash
cd ~
git clone https://github.com/Thalhammer/jwt-cpp.git
cd jwt-cpp
mkdir build && cd build

# 安装到系统目录 /usr/local
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr/local
make -j$(nproc)
sudo make install
sudo ldconfig
```

### 步骤3：验证安装

```bash
# 检查头文件
ls /usr/local/include/jwt-cpp/

# 检查库文件（jwt-cpp 是头文件库，可能没有 .so 文件）
ls /usr/local/lib/ | grep jwt
```

---

## 📝 更新 CMakeLists.txt

### 如果使用系统安装的 jwt-cpp

需要修改你的 `CMakeLists.txt`：

#### 方法A：手动指定路径（推荐）

```cmake
# 移除或注释掉 FetchContent 部分
# include(FetchContent)
# FetchContent_Declare(jwt-cpp ...)

# 添加手动路径
set(JWT_CPP_ROOT "/usr/local")
include_directories(${JWT_CPP_ROOT}/include)

# 或者直接用 find_path
find_path(JWT_CPP_INCLUDE_DIR jwt-cpp/jwt.h
    PATHS
    /usr/local/include
    /usr/include
)

if(JWT_CPP_INCLUDE_DIR)
    include_directories(${JWT_CPP_INCLUDE_DIR})
    message(STATUS "Found jwt-cpp at: ${JWT_CPP_INCLUDE_DIR}")
else()
    message(FATAL_ERROR "jwt-cpp not found! Please install it first.")
endif()

# jwt-cpp 是头文件库，只需要链接 OpenSSL
target_link_libraries(${PROJECT_NAME}
    PRIVATE
    # jwt-cpp::jwt-cpp  # 移除这行，因为它是头文件库
    ssl
    crypto
    # ... 其他库
)
```

#### 方法B：使用 find_package（如果 jwt-cpp 提供了 Config.cmake）

```cmake
# 尝试找到系统安装的 jwt-cpp
find_package(jwt-cpp QUIET)

if(jwt-cpp_FOUND)
    message(STATUS "Found jwt-cpp via find_package")
    target_link_libraries(${PROJECT_NAME} PRIVATE jwt-cpp::jwt-cpp)
else()
    # 回退到手动查找
    find_path(JWT_CPP_INCLUDE_DIR jwt-cpp/jwt.h
        PATHS /usr/local/include /usr/include
    )
    if(JWT_CPP_INCLUDE_DIR)
        include_directories(${JWT_CPP_INCLUDE_DIR})
        message(STATUS "Found jwt-cpp at: ${JWT_CPP_INCLUDE_DIR}")
    else()
        message(FATAL_ERROR "jwt-cpp not found!")
    endif()
endif()
```

---

## 🔄 完整迁移步骤

### 1. 安装 jwt-cpp 到系统

```bash
cd ~
git clone https://github.com/Thalhammer/jwt-cpp.git
cd jwt-cpp
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr/local
make -j$(nproc)
sudo make install
sudo ldconfig
```

### 2. 修改 CMakeLists.txt

移除 FetchContent 相关代码，添加上述方法A或B的代码。

### 3. 清理并重新编译

```bash
cd ~/projects/MultiuserDocument/cpp-service
rm -rf build
mkdir build && cd build
cmake ..
make -j$(nproc)
```

---

## ✅ 验证是否成功

编译时应该看到：

-- Found jwt-cpp at: /usr/local/include

或者没有错误，说明找到了头文件。

---

## 🆚 方案对比

| 方案 | 优点 | 缺点 |
|------|------|------|
| **FetchContent** | 项目自包含，不污染系统 | 首次编译慢，需要网络 |
| **系统安装** | 一次安装，所有项目可用 | 需要 sudo，版本固定 |

---

## 💡 推荐

**如果你确实想用系统安装**：

1. 按照上面的步骤安装到 `/usr/local`
2. 使用手动指定路径的方式（方法A）
3. 确保 `sudo ldconfig` 已执行

**但建议还是用 FetchContent**，因为：

- 不需要 sudo 权限
- 版本可控
- 项目自包含，便于部署

---

**需要我帮你修改 CMakeLists.txt 吗？** 🚀
