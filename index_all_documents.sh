#!/bin/bash

echo "=== 索引所有现有文档到Meilisearch ==="
echo ""

# 获取所有文档并索引
PGPASSWORD=20050430 psql -h 127.0.0.1 -U collab -d collab -t -c "
SELECT id, title 
FROM document 
ORDER BY id;
" | while read id title; do
  if [ ! -z "$id" ] && [ ! -z "$title" ]; then
    # 清理title（去除前导空格和管道符）
    clean_title=$(echo "$title" | sed 's/^[| ]*//')
    echo "索引文档 ID=$id, 标题=$clean_title"
    curl -s -X POST "http://127.0.0.1:7700/indexes/documents/documents" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer 8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d-7e8f9a0b1c2d3e4f5g6h7i8j9k0l" \
      -d "[{\"id\":$id,\"title\":\"$clean_title\",\"content\":\"$clean_title\"}]" > /dev/null
  fi
done

echo ""
echo "等待索引完成..."
sleep 3

echo ""
echo "=== 验证索引结果 ==="
curl -s -X POST "http://127.0.0.1:7700/indexes/documents/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d-7e8f9a0b1c2d3e4f5g6h7i8j9k0l" \
  -d '{"q":"","page":1,"hitsPerPage":50}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Meilisearch中共有 {d[\"totalHits\"]} 个文档')
print('文档列表:')
for h in d['hits']:
    print(f'  - ID: {h[\"id\"]}, 标题: {h[\"title\"]}')
"

echo ""
echo "=== 测试搜索 '测试' ==="
curl -s -X POST "http://127.0.0.1:7700/indexes/documents/search" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 8a7b6c5d-4e3f-2a1b-0c9d-8e7f6a5b4c3d-7e8f9a0b1c2d3e4f5g6h7i8j9k0l" \
  -d '{"q":"测试","page":1,"hitsPerPage":10}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'找到 {d[\"totalHits\"]} 个结果')
for h in d['hits']:
    print(f'  - ID: {h[\"id\"]}, 标题: {h[\"title\"]}')
"

echo ""
echo "索引完成！现在可以测试前端搜索功能了。"

