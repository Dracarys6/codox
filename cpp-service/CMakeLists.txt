cmake_minimum_required(VERSION 3.14)
project(cpp-service)

# 强制 C++17 标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Homebrew (macOS) 默认不会将 libpq 暴露给系统路径，手动提供一次路径提示
if(APPLE)
    set(_brew_libpq_prefix "/opt/homebrew/opt/libpq")
    if(NOT DEFINED PG_INCLUDE_DIRS AND EXISTS "${_brew_libpq_prefix}/include")
        set(PG_INCLUDE_DIRS "${_brew_libpq_prefix}/include" CACHE PATH "libpq include dir" FORCE)
    endif()
    if(NOT DEFINED PG_LIBRARIES AND EXISTS "${_brew_libpq_prefix}/lib/libpq.dylib")
        set(PG_LIBRARIES "${_brew_libpq_prefix}/lib/libpq.dylib" CACHE FILEPATH "libpq library" FORCE)
    endif()
    if(NOT DEFINED PostgreSQL_ROOT AND EXISTS "${_brew_libpq_prefix}")
        set(PostgreSQL_ROOT "${_brew_libpq_prefix}" CACHE PATH "PostgreSQL root dir" FORCE)
    endif()
endif()

# 依赖检测
find_package(Drogon CONFIG REQUIRED)
find_package(jwt-cpp CONFIG REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)
find_package(PkgConfig REQUIRED)
pkg_check_modules(JSONCPP REQUIRED jsoncpp)

find_library(PQXX_LIBRARY
    NAMES pqxx
    REQUIRED
    HINTS
        /opt/homebrew/opt/libpqxx/lib
        /usr/local/lib
)
find_library(PQ_LIBRARY
    NAMES pq
    REQUIRED
    HINTS
        /opt/homebrew/opt/libpq/lib
        /usr/local/lib
)
find_library(SQLITE3_LIBRARY
    NAMES sqlite3
    REQUIRED
    HINTS
        /opt/homebrew/opt/sqlite/lib
        /usr/lib
        /usr/local/lib
)
find_library(UUID_LIBRARY NAMES uuid)

include_directories(/opt/homebrew/include)
link_directories(${JSONCPP_LIBRARY_DIRS})

# 源码文件
file(GLOB_RECURSE ALL_SOURCES
    "src/*.h"
    "src/*.cc"
    "src/*.cpp"
)

add_executable(${PROJECT_NAME} ${ALL_SOURCES})

target_include_directories(${PROJECT_NAME}
    PRIVATE
    ${JSONCPP_INCLUDE_DIRS}
)

target_link_libraries(${PROJECT_NAME}
    PRIVATE
    Drogon::Drogon
    jwt-cpp::jwt-cpp
    ${PQXX_LIBRARY}
    ${PQ_LIBRARY}
    ${SQLITE3_LIBRARY}
    ${JSONCPP_LIBRARIES}
    OpenSSL::SSL
    OpenSSL::Crypto
    Threads::Threads
    ${UUID_LIBRARY}
)

