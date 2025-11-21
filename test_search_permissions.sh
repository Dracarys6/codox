#!/bin/bash

echo "=== 测试搜索权限过滤 ==="
echo ""

# 检查user_id=1可以访问哪些文档
echo "1. user_id=1 可以访问的文档:"
PGPASSWORD=20050430 psql -h 127.0.0.1 -U collab -d collab -c "
SELECT DISTINCT d.id, d.title, d.owner_id,
       CASE WHEN d.owner_id = 1 THEN 'owner' 
            WHEN EXISTS (SELECT 1 FROM doc_acl WHERE doc_id = d.id AND user_id = 1) THEN 'acl'
            ELSE 'no_access' END as access
FROM document d 
LEFT JOIN doc_acl da ON d.id = da.doc_id
WHERE d.owner_id = 1 OR da.user_id = 1
ORDER BY d.id;
"
echo ""

# 检查Meilisearch中的所有文档
echo "2. Meilisearch中的所有文档:"
curl -s -X POST "http://127.0.0.1:7700/indexes/documents/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d-7e8f9a0b1c2d3e4f5g6h7i8j9k0l" \
  -d '{"q":"","page":1,"hitsPerPage":50}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Meilisearch中共有 {d[\"totalHits\"]} 个文档')
for h in d['hits']:
    print(f'  - ID: {h[\"id\"]}, 标题: {h[\"title\"]}')
"
echo ""

echo "3. 预期结果:"
echo "   - Meilisearch返回所有文档（包括测试文档1,2）"
echo "   - 后端权限过滤后，只返回user_id=1有权限的文档"
echo "   - 测试文档1,2在数据库中不存在，应该被过滤掉"
echo ""
echo "注意：如果前端仍然显示'未找到相关文档'，请检查："
echo "  1. 后端返回的total字段是否正确（应该是过滤后的数量）"
echo "  2. 前端是否正确处理了空结果"
echo "  3. 浏览器控制台是否有错误信息"

