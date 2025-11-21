#!/bin/bash

echo "=== 完整搜索功能测试 ==="
echo ""

# 1. 检查Meilisearch中的文档
echo "1. Meilisearch中的文档:"
curl -s -X POST "http://127.0.0.1:7700/indexes/documents/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d-7e8f9a0b1c2d3e4f5g6h7i8j9k0l" \
  -d '{"q":"","page":1,"hitsPerPage":20}' | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'找到 {d[\"totalHits\"]} 个文档'); [print(f'  - ID: {h[\"id\"]}, 标题: {h[\"title\"]}') for h in d['hits']]"
echo ""

# 2. 检查数据库中的文档和权限
echo "2. 数据库中的文档 (user_id=1 的权限):"
PGPASSWORD=20050430 psql -h 127.0.0.1 -U collab -d collab -c "
SELECT d.id, d.title, d.owner_id, 
       CASE WHEN d.owner_id = 1 THEN 'owner' 
            WHEN EXISTS (SELECT 1 FROM doc_acl WHERE doc_id = d.id AND user_id = 1) THEN 'acl'
            ELSE 'no_access' END as access
FROM document d 
WHERE d.id IN (28, 29, 33)
ORDER BY d.id;
"
echo ""

# 3. 测试搜索关键词"测试"
echo "3. 测试搜索 '测试':"
curl -s -X POST "http://127.0.0.1:7700/indexes/documents/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d-7e8f9a0b1c2d3e4f5g6h7i8j9k0l" \
  -d '{"q":"测试","page":1,"hitsPerPage":10}' | python3 -c "import sys, json; d=json.load(sys.stdin); print(f'Meilisearch返回: {d[\"totalHits\"]} 个结果'); [print(f'  - ID: {h[\"id\"]}, 标题: {h[\"title\"]}') for h in d['hits']]"
echo ""

# 4. 检查文档28,29,33的ACL
echo "4. 文档权限检查 (user_id=1):"
PGPASSWORD=20050430 psql -h 127.0.0.1 -U collab -d collab -c "
SELECT d.id, d.title, d.owner_id,
       CASE WHEN d.owner_id = 1 THEN 'owner' ELSE 'not_owner' END as ownership,
       COALESCE(string_agg(da.user_id::text || ':' || da.permission, ', '), 'no_acl') as acl_entries
FROM document d
LEFT JOIN doc_acl da ON d.id = da.doc_id
WHERE d.id IN (28, 29, 33)
GROUP BY d.id, d.title, d.owner_id
ORDER BY d.id;
"
echo ""

echo "=== 测试完成 ==="
echo ""
echo "注意：后端搜索接口需要有效的JWT token才能测试完整流程"
echo "如果Meilisearch有结果但前端显示'未找到相关文档'，可能是："
echo "  1. 权限过滤过于严格（文档不在user_id的权限范围内）"
echo "  2. 后端返回格式与前端期望不一致"
echo "  3. 前端错误处理逻辑问题"

