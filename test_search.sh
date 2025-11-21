#!/bin/bash

# 测试搜索接口
echo "=== 测试搜索接口 ==="
echo ""

# 1. 测试不带认证的请求（应该返回401）
echo "1. 测试未认证请求:"
curl -s -X GET "http://127.0.0.1:8080/api/search?q=test" | python3 -m json.tool 2>/dev/null || echo "请求失败"
echo ""

# 2. 测试POST方式（新实现）
echo "2. 测试POST方式搜索（需要认证）:"
echo "注意：需要有效的JWT token"
echo ""

# 3. 检查Meilisearch索引状态
echo "3. 检查Meilisearch索引:"
curl -s "http://127.0.0.1:7700/indexes/documents" -H "Authorization: Bearer 8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d-7e8f9a0b1c2d3e4f5g6h7i8j9k0l" | python3 -m json.tool 2>/dev/null | head -20
echo ""

# 4. 直接测试Meilisearch搜索
echo "4. 直接测试Meilisearch搜索:"
curl -s -X POST "http://127.0.0.1:7700/indexes/documents/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d-7e8f9a0b1c2d3e4f5g6h7i8j9k0l" \
  -d '{"q":"测试","page":1,"hitsPerPage":5}' | python3 -m json.tool 2>/dev/null | head -30

