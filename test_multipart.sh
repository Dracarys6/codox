#!/bin/bash
# 测试 multipart/form-data 格式

BOUNDARY="WebKitFormBoundary$(date +%s)$RANDOM"
FILE="第八章作业.docx"

echo "Testing multipart/form-data format..."
echo "Boundary: $BOUNDARY"
echo "File: $FILE"
echo ""

# 构建测试请求
{
  echo "--$BOUNDARY"
  echo 'Content-Disposition: form-data; name="file"; filename="第八章作业.docx"'
  echo "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  echo ""
  cat "$FILE"
  echo ""
  echo "--$BOUNDARY--"
} | curl -X POST http://localhost:3002/convert/word-to-html \
  -H "Content-Type: multipart/form-data; boundary=$BOUNDARY" \
  --data-binary @- \
  2>&1 | head -20

