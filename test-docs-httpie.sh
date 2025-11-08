#!/bin/bash

# 文档 CRUD 接口测试脚本（使用 HTTPie）
# 使用方法: chmod +x test-docs-httpie.sh && ./test-docs-httpie.sh

set -e  # 遇到错误立即退出

# 配置
BASE_URL="http://localhost:8080"
EMAIL="test@example.com"
PASSWORD="test12345"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================="
echo "文档 CRUD 接口测试（HTTPie）"
echo "==========================================${NC}"
echo ""

# 检查 HTTPie 是否安装
if ! command -v http &> /dev/null; then
    echo -e "${RED}❌ HTTPie 未安装${NC}"
    echo "请先安装 HTTPie:"
    echo "  Ubuntu/Debian: sudo apt install httpie"
    echo "  macOS: brew install httpie"
    echo "  pip: pip install httpie"
    exit 1
fi

# 检查 jq 是否安装（用于解析 JSON）
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠ jq 未安装，将使用基础方法提取 token${NC}"
    USE_JQ=false
else
    USE_JQ=true
fi

# 1. 登录获取 Token
echo -e "${YELLOW}[1/7] 登录获取 Token...${NC}"
LOGIN_RESPONSE=$(http POST $BASE_URL/api/auth/login \
  account="$EMAIL" \
  password="$PASSWORD" \
  --print=b --body 2>/dev/null || echo "")

if [ -z "$LOGIN_RESPONSE" ]; then
    echo -e "${RED}❌ 登录失败：无法连接到服务器${NC}"
    echo "请确保后端服务正在运行: http://localhost:8080"
    exit 1
fi

if [ "$USE_JQ" = true ]; then
    TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // empty')
else
    # 简单提取 token（不依赖 jq）
    TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo -e "${RED}❌ 登录失败${NC}"
    echo "响应: $LOGIN_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ 登录成功${NC}"
echo "Token: ${TOKEN:0:50}..."
echo ""

# 2. 创建文档
echo -e "${YELLOW}[2/7] 创建文档...${NC}"
CREATE_RESPONSE=$(http POST $BASE_URL/api/docs \
  Authorization:"Bearer $TOKEN" \
  title="测试文档 - $(date +%Y%m%d_%H%M%S)" \
  --print=b --body 2>/dev/null)

if [ "$USE_JQ" = true ]; then
    DOC_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id // empty')
else
    DOC_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | grep -o '[0-9]*' | head -1)
fi

if [ -z "$DOC_ID" ] || [ "$DOC_ID" = "null" ]; then
    echo -e "${RED}❌ 创建文档失败${NC}"
    echo "响应: $CREATE_RESPONSE"
    exit 1
fi

echo -e "${GREEN}✅ 文档创建成功，ID: $DOC_ID${NC}"
echo ""

# 3. 获取文档列表
echo -e "${YELLOW}[3/7] 获取文档列表...${NC}"
http GET "$BASE_URL/api/docs?page=1&pageSize=10" \
  Authorization:"Bearer $TOKEN" \
  --pretty=format \
  --print=b
echo ""

# 4. 获取文档详情
echo -e "${YELLOW}[4/7] 获取文档详情 (ID: $DOC_ID)...${NC}"
http GET $BASE_URL/api/docs/$DOC_ID \
  Authorization:"Bearer $TOKEN" \
  --pretty=format \
  --print=b
echo ""

# 5. 更新文档
echo -e "${YELLOW}[5/7] 更新文档 (ID: $DOC_ID)...${NC}"
http PATCH $BASE_URL/api/docs/$DOC_ID \
  Authorization:"Bearer $TOKEN" \
  title="更新后的标题 - $(date +%H:%M:%S)" \
  is_locked:=false \
  --pretty=format \
  --print=b
echo ""

# 6. 验证更新
echo -e "${YELLOW}[6/7] 验证更新...${NC}"
http GET $BASE_URL/api/docs/$DOC_ID \
  Authorization:"Bearer $TOKEN" \
  --pretty=format \
  --print=b
echo ""

# 7. 删除文档
echo -e "${YELLOW}[7/7] 删除文档 (ID: $DOC_ID)...${NC}"
DELETE_STATUS=$(http DELETE $BASE_URL/api/docs/$DOC_ID \
  Authorization:"Bearer $TOKEN" \
  --print=h --headers 2>/dev/null | grep -i "HTTP" | awk '{print $2}')

if [ "$DELETE_STATUS" = "204" ] || [ "$DELETE_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ 文档删除成功 (状态码: $DELETE_STATUS)${NC}"
else
    echo -e "${YELLOW}⚠ 删除响应状态码: $DELETE_STATUS${NC}"
fi
echo ""

echo -e "${BLUE}=========================================="
echo -e "${GREEN}✅ 所有测试完成！${NC}"
echo -e "${BLUE}==========================================${NC}"

