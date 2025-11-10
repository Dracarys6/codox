cmake_minimum_required(VERSION 3.14)
project(cpp-service)

# 强制 C++17 标准
set(CMAKE_CXX_FLAGS "-std=c++17 -Wall ${CMAKE_CXX_FLAGS}")

# Drogon 安装路径
set(DROGON_INSTALL_PREFIX /home/dracarys/drogon/install)
include_directories(${DROGON_INSTALL_PREFIX}/include)
link_directories(${DROGON_INSTALL_PREFIX}/lib)

# jwt-cpp 库（系统安装）
set(JWT_CPP_ROOT "/usr/local")
include_directories(${JWT_CPP_ROOT}/include)

# jsoncpp 库
find_package(PkgConfig REQUIRED)
pkg_check_modules(JSONCPP REQUIRED jsoncpp)
include_directories(${JSONCPP_INCLUDE_DIRS})
link_directories(${JSONCPP_LIBRARY_DIRS})

# 源码文件
set(ALL_SOURCES
    src/main.cpp
    src/controllers/AuthController.h
    src/controllers/AuthController.cc
    src/controllers/HealthController.h
    src/controllers/HealthController.cc
    src/controllers/UserController.h
    src/controllers/UserController.cc
    src/controllers/DocumentController.h
    src/controllers/DocumentController.cc
    src/utils/JwtUtil.h
    src/utils/JwtUtil.cc
    src/utils/PasswordUtils.h
    src/utils/PasswordUtils.cc
    src/utils/DbUtils.h
    src/utils/DbUtils.cc
    src/utils/ResponseUtils.h
    src/utils/ResponseUtils.cc
    src/utils/PermissionUtils.h
    src/utils/PermissionUtils.cc
    src/middleware/JwtAuthFilter.h
    src/middleware/JwtAuthFilter.cc
)

# 生成可执行文件
add_executable(${PROJECT_NAME} ${ALL_SOURCES})

# 链接所有依赖
target_link_libraries(${PROJECT_NAME}
    PRIVATE
    # Drogon 核心库
    drogon
    trantor
    # 数据库相关
    pqxx       # PostgreSQL C++ 库
    pq         # PostgreSQL 核心库
    sqlite3    # SQLite3 库
    # 其他系统库
    ${JSONCPP_LIBRARIES}  # jsoncpp
    ssl         # OpenSSL（加密）
    crypto      # 加密算法
    pthread     # 线程库
    dl          # 动态链接库管理（dlopen/dlclose）
    z           # zlib（压缩，Drogon 可能用到）
    uuid
)

