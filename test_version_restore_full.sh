#!/bin/bash
# 完整的版本恢复功能测试脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "完整版本恢复功能测试"
echo "=========================================="
echo ""

# 配置
API_BASE="http://localhost:8080/api"
TEST_EMAIL="test@example.com"
TEST_PASSWORD="test12345"

# 检查服务是否运行
echo -e "${YELLOW}1. 检查服务状态...${NC}"
if ! curl -s http://localhost:8080/health > /dev/null; then
    echo -e "${RED}❌ 后端服务未运行，请先启动服务${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 后端服务运行正常${NC}"
echo ""

# 登录获取 token
echo -e "${YELLOW}2. 登录获取 Token...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"account\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('access_token', ''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
    echo -e "${RED}❌ 登录失败，请检查用户名和密码${NC}"
    echo "响应: $LOGIN_RESPONSE"
    exit 1
fi

USER_ID=$(echo $LOGIN_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('user', {}).get('id', ''))" 2>/dev/null || echo "")
echo -e "${GREEN}✅ 登录成功，User ID: $USER_ID${NC}"
echo ""

# 创建测试文档
echo -e "${YELLOW}3. 创建测试文档...${NC}"
DOC_RESPONSE=$(curl -s -X POST "$API_BASE/docs?user_id=$USER_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"title\":\"版本恢复完整测试 $(date +%s)\"}")

DOC_ID=$(echo $DOC_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null || echo "")

if [ -z "$DOC_ID" ]; then
    echo -e "${RED}❌ 创建文档失败${NC}"
    echo "响应: $DOC_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✅ 文档创建成功，ID: $DOC_ID${NC}"
echo ""

# 等待一下
sleep 1

# 模拟保存文档内容（通过协作服务保存快照）
echo -e "${YELLOW}4. 模拟保存文档内容（版本 1）...${NC}"
echo -e "${BLUE}   注意：这需要在前端编辑器中实际编辑和保存文档${NC}"
echo -e "${BLUE}   或者通过协作服务保存快照${NC}"
echo ""

# 检查是否有版本
echo -e "${YELLOW}5. 检查版本列表...${NC}"
VERSIONS_RESPONSE=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/versions?user_id=$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

VERSION_COUNT=$(echo $VERSIONS_RESPONSE | python3 -c "import sys, json; versions=json.load(sys.stdin).get('versions', []); print(len(versions))" 2>/dev/null || echo "0")

echo "当前版本数量: $VERSION_COUNT"

if [ "$VERSION_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  文档还没有版本，需要先在前端编辑器中编辑并保存文档${NC}"
    echo -e "${BLUE}   请访问: http://localhost:5173/editor/$DOC_ID${NC}"
    echo -e "${BLUE}   编辑一些内容并保存，然后重新运行此脚本${NC}"
    echo ""
    echo "文档 ID: $DOC_ID"
    exit 0
fi

# 显示版本列表
echo ""
echo "版本列表:"
echo $VERSIONS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $VERSIONS_RESPONSE
echo ""

# 获取第一个版本（最旧的版本）
FIRST_VERSION_ID=$(echo $VERSIONS_RESPONSE | python3 -c "import sys, json; versions=json.load(sys.stdin).get('versions', []); print(versions[-1].get('id', '') if versions else '')" 2>/dev/null || echo "")

if [ -z "$FIRST_VERSION_ID" ]; then
    echo -e "${RED}❌ 无法获取版本 ID${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 找到第一个版本，ID: $FIRST_VERSION_ID${NC}"
echo ""

# 获取该版本的详情
echo -e "${YELLOW}6. 获取版本 $FIRST_VERSION_ID 的详情...${NC}"
VERSION_DETAIL_RESPONSE=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/versions/$FIRST_VERSION_ID?user_id=$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

echo "版本详情:"
echo $VERSION_DETAIL_RESPONSE | python3 -m json.tool 2>/dev/null || echo $VERSION_DETAIL_RESPONSE
echo ""

# 检查版本是否有 content_html 或 content_text
HAS_CONTENT_HTML=$(echo $VERSION_DETAIL_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); html=d.get('content_html', ''); print('yes' if html and len(html.strip()) > 0 else 'no')" 2>/dev/null || echo "no")
HAS_CONTENT_TEXT=$(echo $VERSION_DETAIL_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); text=d.get('content_text', ''); print('yes' if text and len(text.strip()) > 0 else 'no')" 2>/dev/null || echo "no")

echo "版本内容检查:"
echo "  - content_html: $HAS_CONTENT_HTML"
echo "  - content_text: $HAS_CONTENT_TEXT"
echo ""

if [ "$HAS_CONTENT_HTML" = "no" ] && [ "$HAS_CONTENT_TEXT" = "no" ]; then
    echo -e "${RED}❌ 版本没有内容字段，无法测试恢复功能${NC}"
    echo -e "${YELLOW}   这可能是因为保存时没有保存 content_html 或 content_text${NC}"
    exit 1
fi

# 测试恢复版本
echo -e "${YELLOW}7. 测试恢复版本 $FIRST_VERSION_ID...${NC}"
RESTORE_RESPONSE=$(curl -s -X POST "$API_BASE/docs/$DOC_ID/versions/$FIRST_VERSION_ID/restore?user_id=$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

echo "恢复响应:"
echo $RESTORE_RESPONSE | python3 -m json.tool 2>/dev/null || echo $RESTORE_RESPONSE
echo ""

NEW_VERSION_ID=$(echo $RESTORE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('version_id', ''))" 2>/dev/null || echo "")

if [ -z "$NEW_VERSION_ID" ]; then
    echo -e "${RED}❌ 版本恢复失败${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 版本恢复成功，新版本 ID: $NEW_VERSION_ID${NC}"
echo ""

# 等待一下
sleep 2

# 检查文档的 last_published_version_id
echo -e "${YELLOW}8. 检查文档的 last_published_version_id...${NC}"
DOC_DETAIL_RESPONSE=$(curl -s -X GET "$API_BASE/docs/$DOC_ID?user_id=$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

NEW_LAST_VERSION_ID=$(echo $DOC_DETAIL_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('last_published_version_id', 'null'))" 2>/dev/null || echo "null")

if [ "$NEW_LAST_VERSION_ID" = "$NEW_VERSION_ID" ]; then
    echo -e "${GREEN}✅ 文档的 last_published_version_id 已更新为新版本: $NEW_VERSION_ID${NC}"
else
    echo -e "${RED}❌ 文档的 last_published_version_id 未更新（期望: $NEW_VERSION_ID, 实际: $NEW_LAST_VERSION_ID）${NC}"
fi
echo ""

# 检查恢复后的 Bootstrap 接口
echo -e "${YELLOW}9. 检查恢复后的 Bootstrap 接口...${NC}"
BOOTSTRAP_RESPONSE=$(curl -s -X GET "$API_BASE/collab/bootstrap/$DOC_ID?user_id=$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

echo "Bootstrap 响应:"
echo $BOOTSTRAP_RESPONSE | python3 -m json.tool 2>/dev/null || echo $BOOTSTRAP_RESPONSE
echo ""

# 检查是否有 content_html 或 content_text
HAS_BOOTSTRAP_HTML=$(echo $BOOTSTRAP_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); html=d.get('content_html', ''); print('yes' if html and len(html.strip()) > 0 else 'no')" 2>/dev/null || echo "no")
HAS_BOOTSTRAP_TEXT=$(echo $BOOTSTRAP_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); text=d.get('content_text', ''); print('yes' if text and len(text.strip()) > 0 else 'no')" 2>/dev/null || echo "no")

echo "Bootstrap 内容检查:"
echo "  - content_html: $HAS_BOOTSTRAP_HTML"
echo "  - content_text: $HAS_BOOTSTRAP_TEXT"
echo ""

if [ "$HAS_BOOTSTRAP_HTML" = "yes" ] || [ "$HAS_BOOTSTRAP_TEXT" = "yes" ]; then
    echo -e "${GREEN}✅ Bootstrap 接口返回了内容字段${NC}"
    
    # 获取新版本的详情，对比内容
    echo -e "${YELLOW}10. 获取新版本 $NEW_VERSION_ID 的详情并对比内容...${NC}"
    NEW_VERSION_DETAIL_RESPONSE=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/versions/$NEW_VERSION_ID?user_id=$USER_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    NEW_VERSION_HTML=$(echo $NEW_VERSION_DETAIL_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('content_html', ''))" 2>/dev/null || echo "")
    BOOTSTRAP_HTML=$(echo $BOOTSTRAP_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('content_html', ''))" 2>/dev/null || echo "")
    
    if [ -n "$NEW_VERSION_HTML" ] && [ -n "$BOOTSTRAP_HTML" ]; then
        if [ "$NEW_VERSION_HTML" = "$BOOTSTRAP_HTML" ]; then
            echo -e "${GREEN}✅ Bootstrap 返回的内容与新版本内容一致${NC}"
        else
            echo -e "${YELLOW}⚠️  Bootstrap 返回的内容与新版本内容不一致${NC}"
            echo "新版本内容长度: ${#NEW_VERSION_HTML}"
            echo "Bootstrap 内容长度: ${#BOOTSTRAP_HTML}"
        fi
    fi
else
    echo -e "${RED}❌ Bootstrap 接口没有返回内容字段${NC}"
    echo -e "${YELLOW}   这可能是问题的根源！${NC}"
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "测试文档 ID: $DOC_ID"
echo "可以在前端访问: http://localhost:5173/editor/$DOC_ID?reload=true"
echo ""
echo -e "${BLUE}诊断建议：${NC}"
echo "1. 检查浏览器控制台，查看是否有 'Initializing editor from HTML content' 日志"
echo "2. 检查 Bootstrap 接口是否返回了 content_html 或 content_text"
echo "3. 检查编辑器是否正确初始化了内容"
echo ""

