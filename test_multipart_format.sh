#!/bin/bash
# 测试手动构建的 multipart 格式

BOUNDARY="WebKitFormBoundary123456"
FILE="test.docx"

echo "Testing multipart format..."
echo "Boundary: $BOUNDARY"
echo ""

# 构建请求体
{
  echo -ne "--$BOUNDARY\r\n"
  echo -ne 'Content-Disposition: form-data; name="file"; filename="test.docx"'"\r\n"
  echo -ne "Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n"
  echo -ne "\r\n"
  cat "$FILE"
  echo -ne "\r\n"
  echo -ne "--$BOUNDARY--\r\n"
} | curl -X POST http://localhost:3002/convert/word-to-html \
  -H "Content-Type: multipart/form-data; boundary=$BOUNDARY" \
  --data-binary @- \
  2>&1 | head -20

