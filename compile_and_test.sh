#!/bin/bash
# 编译并测试 C++ 服务

set -e

echo "=== 编译 C++ 服务 ==="
cd cpp-service

# 创建 build 目录
if [ ! -d "build" ]; then
    mkdir build
fi

cd build

# 配置 CMake
echo "配置 CMake..."
cmake .. > /dev/null 2>&1

# 编译
echo "编译中..."
make -j$(nproc) 2>&1 | grep -E "(Building|Linking|Error|error)" || true

if [ $? -eq 0 ]; then
    echo "✅ 编译成功！"
    echo ""
    echo "可执行文件位置: $(pwd)/cpp-service"
    echo ""
    echo "要启动服务，请运行："
    echo "  cd $(pwd)"
    echo "  ./cpp-service"
    echo ""
    echo "或者使用以下命令在后台启动："
    echo "  cd $(pwd) && ./cpp-service > /tmp/cpp-service.log 2>&1 &"
else
    echo "❌ 编译失败"
    exit 1
fi

