#!/bin/bash

# 前端功能测试脚本

echo "=========================================="
echo "前端功能测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查后端服务
echo -e "${YELLOW}[1/6] 检查后端服务...${NC}"
if curl -s http://localhost:8080/health > /dev/null; then
    echo -e "${GREEN}✓ 后端服务正在运行${NC}"
    BACKEND_RUNNING=true
else
    echo -e "${RED}✗ 后端服务未运行${NC}"
    echo "  请先启动后端服务："
    echo "  cd cpp-service/build && ./cpp-service"
    BACKEND_RUNNING=false
fi
echo ""

# 检查前端依赖
echo -e "${YELLOW}[2/6] 检查前端依赖...${NC}"
if [ -d "frontend/node_modules" ]; then
    echo -e "${GREEN}✓ 前端依赖已安装${NC}"
    DEPS_INSTALLED=true
else
    echo -e "${RED}✗ 前端依赖未安装${NC}"
    echo "  正在安装依赖..."
    cd frontend && npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 依赖安装成功${NC}"
        DEPS_INSTALLED=true
    else
        echo -e "${RED}✗ 依赖安装失败${NC}"
        DEPS_INSTALLED=false
    fi
    cd ..
fi
echo ""

# 检查环境变量
echo -e "${YELLOW}[3/6] 检查环境变量配置...${NC}"
if [ -f "frontend/.env" ]; then
    echo -e "${GREEN}✓ .env 文件存在${NC}"
    echo "  配置: $(cat frontend/.env)"
else
    echo -e "${YELLOW}⚠ .env 文件不存在，创建中...${NC}"
    echo "VITE_API_BASE_URL=http://localhost:8080/api" > frontend/.env
    echo -e "${GREEN}✓ 已创建 .env 文件${NC}"
fi
echo ""

# 测试 API 连接
if [ "$BACKEND_RUNNING" = true ]; then
    echo -e "${YELLOW}[4/6] 测试 API 连接...${NC}"
    
    # 测试健康检查
    HEALTH=$(curl -s http://localhost:8080/health)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ 健康检查 API 正常${NC}"
    else
        echo -e "${RED}✗ 健康检查 API 失败${NC}"
    fi
    echo ""
fi

# 测试用户注册和登录
if [ "$BACKEND_RUNNING" = true ]; then
    echo -e "${YELLOW}[5/6] 测试用户注册和登录...${NC}"
    
    # 生成随机邮箱
    RANDOM_EMAIL="test$(date +%s)@example.com"
    RANDOM_PASSWORD="test12345"
    
    echo "  测试账号: $RANDOM_EMAIL"
    echo "  密码: $RANDOM_PASSWORD"
    
    # 注册
    REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/register \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$RANDOM_EMAIL\",\"password\":\"$RANDOM_PASSWORD\",\"nickname\":\"测试用户\"}")
    
    if echo "$REGISTER_RESPONSE" | grep -q "id"; then
        echo -e "${GREEN}✓ 用户注册成功${NC}"
        
        # 登录
        LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/auth/login \
            -H "Content-Type: application/json" \
            -d "{\"account\":\"$RANDOM_EMAIL\",\"password\":\"$RANDOM_PASSWORD\"}")
        
        if echo "$LOGIN_RESPONSE" | grep -q "access_token"; then
            echo -e "${GREEN}✓ 用户登录成功${NC}"
            TOKEN=$(echo "$LOGIN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
            if [ ! -z "$TOKEN" ]; then
                echo "  Token: ${TOKEN:0:50}..."
                
                # 测试获取用户信息
                USER_INFO=$(curl -s -X GET http://localhost:8080/api/users/me \
                    -H "Authorization: Bearer $TOKEN")
                
                if echo "$USER_INFO" | grep -q "id"; then
                    echo -e "${GREEN}✓ 获取用户信息成功${NC}"
                else
                    echo -e "${RED}✗ 获取用户信息失败${NC}"
                fi
            fi
        else
            echo -e "${RED}✗ 用户登录失败${NC}"
        fi
    else
        echo -e "${RED}✗ 用户注册失败${NC}"
        echo "  响应: $REGISTER_RESPONSE"
    fi
    echo ""
fi

# 启动前端服务器
echo -e "${YELLOW}[6/6] 准备启动前端开发服务器...${NC}"
echo ""
echo -e "${BLUE}=========================================="
echo "前端测试说明"
echo "==========================================${NC}"
echo ""
echo "1. 启动前端开发服务器："
echo -e "   ${GREEN}cd frontend && npm run dev${NC}"
echo ""
echo "2. 前端将在 http://localhost:3000 启动"
echo ""
echo "3. 测试流程："
echo "   - 访问 http://localhost:3000/register 注册新用户"
echo "   - 访问 http://localhost:3000/login 登录"
echo "   - 访问 http://localhost:3000/profile 查看和编辑个人资料"
echo "   - 测试登出功能"
echo ""
echo "4. 测试账号（已注册）："
if [ ! -z "$RANDOM_EMAIL" ]; then
    echo "   邮箱: $RANDOM_EMAIL"
    echo "   密码: $RANDOM_PASSWORD"
fi
echo ""
echo -e "${BLUE}==========================================${NC}"
