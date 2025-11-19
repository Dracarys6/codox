#!/bin/bash

# 调试上传权限问题

echo "=== 调试 MinIO 上传权限问题 ==="
echo ""

if [ -z "$TOKEN" ]; then
    echo "错误: TOKEN 未设置"
    exit 1
fi

DOC_ID=${DOC_ID:-1}

echo "1. 检查文档是否存在..."
DOC_RESPONSE=$(http --ignore-stdin GET localhost:8080/api/docs/$DOC_ID \
    Authorization:"Bearer $TOKEN" 2>&1)

DOC_HTTP_CODE=$(echo "$DOC_RESPONSE" | head -1 | grep -o "HTTP/[0-9.]* [0-9]*" | awk '{print $2}' || echo "")

if [ "$DOC_HTTP_CODE" = "200" ]; then
    echo "  ✓ 文档存在"
    echo "$DOC_RESPONSE" | jq '{id, title, owner_id}' 2>/dev/null || echo "$DOC_RESPONSE" | tail -5
else
    echo "  ✗ 文档不存在或无法访问 (HTTP $DOC_HTTP_CODE)"
    echo "  响应: $DOC_RESPONSE" | head -10
    echo ""
    echo "  解决方案: 先创建一个文档"
    echo "  http POST localhost:8080/api/docs Authorization:\"Bearer \$TOKEN\" title=\"测试文档\""
    exit 1
fi

echo ""
echo "2. 检查用户权限..."
ACL_RESPONSE=$(http --ignore-stdin GET localhost:8080/api/docs/$DOC_ID/acl \
    Authorization:"Bearer $TOKEN" 2>&1)

ACL_HTTP_CODE=$(echo "$ACL_RESPONSE" | head -1 | grep -o "HTTP/[0-9.]* [0-9]*" | awk '{print $2}' || echo "")

if [ "$ACL_HTTP_CODE" = "200" ]; then
    echo "  ✓ ACL 信息:"
    echo "$ACL_RESPONSE" | jq '.' 2>/dev/null || echo "$ACL_RESPONSE" | tail -10
    
    # 检查当前用户是否有 editor 或 owner 权限
    USER_ID=$(echo "$DOC_RESPONSE" | jq -r '.owner_id' 2>/dev/null || echo "")
    if [ ! -z "$USER_ID" ]; then
        echo ""
        echo "  文档 owner_id: $USER_ID"
        echo "  提示: 只有 owner 或 editor 可以上传快照"
    fi
else
    echo "  ⚠ 无法获取 ACL 信息 (HTTP $ACL_HTTP_CODE)"
    echo "  响应: $ACL_RESPONSE" | head -5
fi

echo ""
echo "3. 测试上传..."
TEST_DATA="SGVsbG8gV29ybGQh"
FILENAME="test-$(date +%Y%m%d%H%M%S).bin"

UPLOAD_RESPONSE=$(http --ignore-stdin POST localhost:8080/api/collab/upload/$DOC_ID \
    Authorization:"Bearer $TOKEN" \
    data="$TEST_DATA" \
    filename="$FILENAME" 2>&1)

UPLOAD_HTTP_CODE=$(echo "$UPLOAD_RESPONSE" | head -1 | grep -o "HTTP/[0-9.]* [0-9]*" | awk '{print $2}' || echo "")

echo "  HTTP 状态码: $UPLOAD_HTTP_CODE"
echo ""

if [ "$UPLOAD_HTTP_CODE" = "200" ]; then
    echo "  ✓✓✓ 上传成功！"
    echo "$UPLOAD_RESPONSE" | jq '.' 2>/dev/null || echo "$UPLOAD_RESPONSE" | tail -10
elif [ "$UPLOAD_HTTP_CODE" = "403" ]; then
    echo "  ✗ 权限不足 (403 Forbidden)"
    echo ""
    echo "  可能的原因:"
    echo "  1. 当前用户不是文档的 owner"
    echo "  2. 当前用户没有 editor 权限"
    echo ""
    echo "  解决方案:"
    echo "  1. 使用文档 owner 的账号"
    echo "  2. 或者让 owner 为你添加 editor 权限（需要实现 ACL 更新接口）"
    echo "  3. 或者创建一个新文档（你会自动成为 owner）"
else
    echo "  ✗ 上传失败"
    echo "  响应:"
    echo "$UPLOAD_RESPONSE" | tail -10
fi

