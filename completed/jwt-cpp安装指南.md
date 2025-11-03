# jwt-cpp 库手动安装指南

## 🎯 安装方案对比

jwt-cpp 是一个 C++ JWT 库，通常有以下几种安装方式：

1. **通过 apt 安装**（最简单，但可能版本较老或不可用）
2. **从 GitHub 源码编译安装**（推荐，最新版本）
3. **使用 CMake FetchContent**（项目级集成，不全局安装）

---

## 方案1：apt 安装（如果可用）

```bash
# 检查是否有可用包
apt search libjwt

# 如果有，尝试安装
sudo apt update
sudo apt install libjwt-dev libjwt0

# 验证安装
pkg-config --modversion libjwt  # 如果返回版本号，说明安装成功
```

**注意**：Ubuntu 20.04 可能没有这个包，需要方案2。

---

## 方案2：从源码编译安装（推荐）

### 步骤1：安装依赖

```bash
sudo apt install -y git cmake build-essential
# jwt-cpp 需要 OpenSSL（通常已安装）
sudo apt install -y libssl-dev
```

### 步骤2：克隆源码

```bash
cd ~
git clone https://github.com/Thalhammer/jwt-cpp.git
cd jwt-cpp
```

### 步骤3：编译安装

```bash
# 创建 build 目录
mkdir build && cd build

# 配置 CMake（安装到系统目录）
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=/usr/local

# 编译
make -j$(nproc)

# 安装（需要 sudo）
sudo make install

# 更新动态链接库缓存
sudo ldconfig
```

### 步骤4：验证安装

```bash
# 检查头文件
ls /usr/local/include/jwt-cpp/

# 检查库文件
ls /usr/local/lib/libjwt-cpp*  # 如果存在，说明安装成功

# 或者编译一个简单测试
cat > test_jwt.cpp << 'EOF'
#include <jwt-cpp/jwt.h>
int main() { return 0; }
EOF

g++ test_jwt.cpp -o test_jwt -ljwt-cpp
./test_jwt && echo "安装成功！"
```

---

## 方案3：使用 CMake FetchContent（项目级，不全局安装）

**这是最推荐的方式，不需要全局安装！**

### 修改你的 CMakeLists.txt

在 `CMakeLists.txt` 中添加：

```cmake
# 在 find_package 之前添加
include(FetchContent)

FetchContent_Declare(
    jwt-cpp
    GIT_REPOSITORY https://github.com/Thalhammer/jwt-cpp.git
    GIT_TAG master  # 或指定版本，如 v0.6.0
)

# 如果网络慢，可以用镜像
# GIT_REPOSITORY https://ghproxy.com/https://github.com/Thalhammer/jwt-cpp.git

FetchContent_MakeAvailable(jwt-cpp)

# 然后在使用的地方链接
target_link_libraries(${PROJECT_NAME}
    PRIVATE
    jwt-cpp::jwt-cpp  # 添加到你的链接库列表
    # ... 其他库
)
```

**优点**：

- 不需要全局安装
- 版本可控（指定 git tag）
- 项目自包含，便于部署

**缺点**：

- 首次编译需要下载源码（可能较慢）
- 如果网络不好，可以用 ghproxy 镜像

---

## 方案4：安装到自定义目录（与 Drogon 类似）

如果你想和 Drogon 一样安装到 `~/drogon/install` 这样的自定义目录：

```bash
cd ~/jwt-cpp/build
cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=$HOME/jwt-cpp/install
make -j$(nproc)
make install
```

然后在 `CMakeLists.txt` 中指定路径：

```cmake
set(JWT_CPP_ROOT "$ENV{HOME}/jwt-cpp/install")
include_directories(${JWT_CPP_ROOT}/include)
link_directories(${JWT_CPP_ROOT}/lib)
target_link_libraries(${PROJECT_NAME} PRIVATE jwt-cpp)
```

---

## 📝 在 CMakeLists.txt 中使用

### 如果系统安装（方案1或2）

```cmake
find_package(PkgConfig REQUIRED)
pkg_check_modules(JWT_CPP REQUIRED libjwt)
include_directories(${JWT_CPP_INCLUDE_DIRS})
target_link_libraries(${PROJECT_NAME} PRIVATE ${JWT_CPP_LIBRARIES})
```

### 如果使用 FetchContent（方案3，推荐）

```cmake
include(FetchContent)
FetchContent_Declare(jwt-cpp
    GIT_REPOSITORY https://github.com/Thalhammer/jwt-cpp.git
    GIT_TAG master
)
FetchContent_MakeAvailable(jwt-cpp)

# 在 target_link_libraries 中添加
target_link_libraries(${PROJECT_NAME}
    PRIVATE
    jwt-cpp::jwt-cpp
    # ... 其他库
)
```

---

## 🧪 测试安装是否成功

创建测试文件 `test_jwt.cpp`：

```cpp
#include <jwt-cpp/jwt.h>
#include <iostream>

int main() {
    try {
        // 简单的 token 生成测试
        auto token = jwt::create()
            .set_type("JWT")
            .set_issuer("test")
            .sign(jwt::algorithm::hs256{"secret"});
        
        std::cout << "JWT 库安装成功！Token: " << token << std::endl;
        return 0;
    } catch (const std::exception& e) {
        std::cerr << "错误: " << e.what() << std::endl;
        return 1;
    }
}
```

编译测试：

```bash
# 如果系统安装
g++ test_jwt.cpp -o test_jwt -ljwt-cpp
./test_jwt

# 如果使用 CMake
# 在你的项目中编译，会自动链接
```

---

## ⚠️ 常见问题

### 问题1：找不到 jwt-cpp 头文件

**解决方案：**

- 检查 include 路径是否正确
- 如果系统安装，确认 `sudo ldconfig` 已执行
- 如果 FetchContent，确认 CMakeLists.txt 中 `FetchContent_MakeAvailable` 已调用

### 问题2：编译 jwt-cpp 时出错

**可能原因：**

- 缺少 OpenSSL 开发库：`sudo apt install libssl-dev`
- CMake 版本太低（需要 3.14+）

### 问题3：网络慢，GitHub 克隆失败

**解决方案：**

```cmake
# 使用镜像
FetchContent_Declare(jwt-cpp
    GIT_REPOSITORY https://ghproxy.com/https://github.com/Thalhammer/jwt-cpp.git
    GIT_TAG master
)
```

---

## 🎯 推荐方案

**对于你的项目，我强烈推荐方案3（CMake FetchContent）**：

1. ✅ 不需要全局安装，不污染系统
2. ✅ 版本可控，团队成员环境一致
3. ✅ 项目自包含，部署方便
4. ✅ 与 Drogon 的安装方式类似，你已经熟悉

**修改 CMakeLists.txt 后，重新编译：**

```bash
cd ~/projects/MultiuserDocument/cpp-service
rm -rf build
mkdir build && cd build
cmake ..
make -j$(nproc)
```

---

## 📚 参考资源

- **jwt-cpp GitHub**：<https://github.com/Thalhammer/jwt-cpp>
- **jwt-cpp 文档**：<https://github.com/Thalhammer/jwt-cpp#usage>

---

**选择哪种方案？建议用 FetchContent，最简单！** 🚀
