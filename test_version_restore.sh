#!/bin/bash
# 版本恢复功能测试脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "版本恢复功能测试"
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
    -d "{\"title\":\"版本恢复测试文档 $(date +%s)\"}")

DOC_ID=$(echo $DOC_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('id', ''))" 2>/dev/null || echo "")

if [ -z "$DOC_ID" ]; then
    echo -e "${RED}❌ 创建文档失败${NC}"
    echo "响应: $DOC_RESPONSE"
    exit 1
fi
echo -e "${GREEN}✅ 文档创建成功，ID: $DOC_ID${NC}"
echo ""

# 等待一下，确保文档创建完成
sleep 1

# 获取版本列表（初始应该为空或只有一个版本）
echo -e "${YELLOW}4. 获取初始版本列表...${NC}"
VERSIONS_RESPONSE=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/versions?user_id=$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

echo "版本列表响应:"
echo $VERSIONS_RESPONSE | python3 -m json.tool 2>/dev/null || echo $VERSIONS_RESPONSE
echo ""

# 测试 Bootstrap 接口
echo -e "${YELLOW}5. 测试 Bootstrap 接口（检查内容字段）...${NC}"
BOOTSTRAP_RESPONSE=$(curl -s -X GET "$API_BASE/collab/bootstrap/$DOC_ID?user_id=$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

echo "Bootstrap 响应:"
echo $BOOTSTRAP_RESPONSE | python3 -m json.tool 2>/dev/null || echo $BOOTSTRAP_RESPONSE

# 检查是否有 content_html 或 content_text
HAS_CONTENT=$(echo $BOOTSTRAP_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print('yes' if (d.get('content_html') or d.get('content_text')) else 'no')" 2>/dev/null || echo "no")

if [ "$HAS_CONTENT" = "yes" ]; then
    echo -e "${GREEN}✅ Bootstrap 接口返回了内容字段${NC}"
else
    echo -e "${YELLOW}⚠️  Bootstrap 接口没有返回内容字段（可能是新文档）${NC}"
fi
echo ""

# 获取文档详情
echo -e "${YELLOW}6. 获取文档详情...${NC}"
DOC_DETAIL_RESPONSE=$(curl -s -X GET "$API_BASE/docs/$DOC_ID?user_id=$USER_ID" \
    -H "Authorization: Bearer $TOKEN")

echo "文档详情:"
echo $DOC_DETAIL_RESPONSE | python3 -m json.tool 2>/dev/null || echo $DOC_DETAIL_RESPONSE
echo ""

# 检查 last_published_version_id
LAST_VERSION_ID=$(echo $DOC_DETAIL_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('last_published_version_id', 'null'))" 2>/dev/null || echo "null")

if [ "$LAST_VERSION_ID" != "null" ] && [ -n "$LAST_VERSION_ID" ]; then
    echo -e "${GREEN}✅ 文档有发布版本，ID: $LAST_VERSION_ID${NC}"
    
    # 获取该版本的详情
    echo -e "${YELLOW}7. 获取版本 $LAST_VERSION_ID 的详情...${NC}"
    VERSION_DETAIL_RESPONSE=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/versions/$LAST_VERSION_ID?user_id=$USER_ID" \
        -H "Authorization: Bearer $TOKEN")
    
    echo "版本详情:"
    echo $VERSION_DETAIL_RESPONSE | python3 -m json.tool 2>/dev/null || echo $VERSION_DETAIL_RESPONSE
    
    # 检查版本是否有 content_html 或 content_text
    VERSION_HAS_CONTENT=$(echo $VERSION_DETAIL_RESPONSE | python3 -c "import sys, json; d=json.load(sys.stdin); print('yes' if (d.get('content_html') or d.get('content_text')) else 'no')" 2>/dev/null || echo "no")
    
    if [ "$VERSION_HAS_CONTENT" = "yes" ]; then
        echo -e "${GREEN}✅ 版本包含内容字段${NC}"
        
        # 测试恢复版本
        echo -e "${YELLOW}8. 测试恢复版本 $LAST_VERSION_ID...${NC}"
        RESTORE_RESPONSE=$(curl -s -X POST "$API_BASE/docs/$DOC_ID/versions/$LAST_VERSION_ID/restore?user_id=$USER_ID" \
            -H "Authorization: Bearer $TOKEN")
        
        echo "恢复响应:"
        echo $RESTORE_RESPONSE | python3 -m json.tool 2>/dev/null || echo $RESTORE_RESPONSE
        
        NEW_VERSION_ID=$(echo $RESTORE_RESPONSE | python3 -c "import sys, json; print(json.load(sys.stdin).get('version_id', ''))" 2>/dev/null || echo "")
        
        if [ -n "$NEW_VERSION_ID" ]; then
            echo -e "${GREEN}✅ 版本恢复成功，新版本 ID: $NEW_VERSION_ID${NC}"
            
            # 等待一下
            sleep 1
            
            # 再次检查 Bootstrap 接口
            echo -e "${YELLOW}9. 检查恢复后的 Bootstrap 接口...${NC}"
            BOOTSTRAP_RESPONSE2=$(curl -s -X GET "$API_BASE/collab/bootstrap/$DOC_ID?user_id=$USER_ID" \
                -H "Authorization: Bearer $TOKEN")
            
            echo "恢复后的 Bootstrap 响应:"
            echo $BOOTSTRAP_RESPONSE2 | python3 -m json.tool 2>/dev/null || echo $BOOTSTRAP_RESPONSE2
            
            # 检查是否有 content_html 或 content_text
            HAS_CONTENT2=$(echo $BOOTSTRAP_RESPONSE2 | python3 -c "import sys, json; d=json.load(sys.stdin); print('yes' if (d.get('content_html') or d.get('content_text')) else 'no')" 2>/dev/null || echo "no")
            
            if [ "$HAS_CONTENT2" = "yes" ]; then
                echo -e "${GREEN}✅ 恢复后 Bootstrap 接口返回了内容字段${NC}"
            else
                echo -e "${RED}❌ 恢复后 Bootstrap 接口没有返回内容字段${NC}"
            fi
            
            # 检查文档的 last_published_version_id 是否更新
            DOC_DETAIL_RESPONSE2=$(curl -s -X GET "$API_BASE/docs/$DOC_ID?user_id=$USER_ID" \
                -H "Authorization: Bearer $TOKEN")
            
            NEW_LAST_VERSION_ID=$(echo $DOC_DETAIL_RESPONSE2 | python3 -c "import sys, json; print(json.load(sys.stdin).get('last_published_version_id', 'null'))" 2>/dev/null || echo "null")
            
            if [ "$NEW_LAST_VERSION_ID" = "$NEW_VERSION_ID" ]; then
                echo -e "${GREEN}✅ 文档的 last_published_version_id 已更新为新版本${NC}"
            else
                echo -e "${RED}❌ 文档的 last_published_version_id 未更新（期望: $NEW_VERSION_ID, 实际: $NEW_LAST_VERSION_ID）${NC}"
            fi
        else
            echo -e "${RED}❌ 版本恢复失败${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  版本没有内容字段，跳过恢复测试${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  文档没有发布版本，跳过恢复测试${NC}"
fi

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="
echo ""
echo "测试文档 ID: $DOC_ID"
echo "可以在前端访问: http://localhost:5173/editor/$DOC_ID"
echo ""

