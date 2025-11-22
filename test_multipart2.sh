#!/bin/bash
# 测试正确的 multipart/form-data 格式

BOUNDARY="WebKitFormBoundary$(date +%s)$RANDOM"
FILE="第八章作业.docx"

echo "Testing correct multipart/form-data format..."
echo "Boundary: $BOUNDARY"
echo ""

# 使用 curl 的正确方式
curl -X POST http://localhost:3002/convert/word-to-html \
  -F "file=@$FILE" \
  2>&1 | jq -r '.success, .error' 2>/dev/null || echo "Response received"

