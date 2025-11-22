#!/bin/bash

# 文档导入导出功能测试脚本

echo "=== 文档导入导出功能测试 ==="
echo ""

# 配置
API_BASE="http://localhost:8080/api"
CONVERTER_URL="http://localhost:3002"

# 测试用户凭据（需要根据实际情况修改）
EMAIL="test@example.com"
PASSWORD="test12345"

echo "1. 测试 doc-converter-service 健康检查..."
curl -s "$CONVERTER_URL/health" | jq .
echo ""

echo "2. 登录获取 Token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"account\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token')
if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "登录失败，请检查用户凭据"
  echo "响应: $LOGIN_RESPONSE"
  exit 1
fi
echo "Token 获取成功"
echo ""

echo "3. 测试 Markdown 导入..."
MARKDOWN_CONTENT="# 测试文档

这是一个测试文档。

## 章节1

这是章节1的内容。

### 子章节

- 列表项1
- 列表项2
- 列表项3

**粗体文本** 和 *斜体文本*"

IMPORT_RESPONSE=$(curl -s -X POST "$API_BASE/docs/import/markdown" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"markdown\":\"$MARKDOWN_CONTENT\",\"title\":\"测试Markdown导入\"}")

DOC_ID=$(echo $IMPORT_RESPONSE | jq -r '.id')
if [ "$DOC_ID" == "null" ] || [ -z "$DOC_ID" ]; then
  echo "Markdown 导入失败"
  echo "响应: $IMPORT_RESPONSE"
  exit 1
fi
echo "Markdown 导入成功，文档ID: $DOC_ID"
echo ""

echo "4. 测试 Markdown 导出..."
EXPORT_RESPONSE=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/export/markdown" \
  -H "Authorization: Bearer $TOKEN")

echo "导出响应:"
echo $EXPORT_RESPONSE | jq .
echo ""

echo "5. 测试 Word 导出..."
WORD_EXPORT=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/export/word" \
  -H "Authorization: Bearer $TOKEN")

if echo $WORD_EXPORT | jq -e '.data' > /dev/null; then
  echo "Word 导出成功"
  echo "文件名: $(echo $WORD_EXPORT | jq -r '.filename')"
  echo "数据长度: $(echo $WORD_EXPORT | jq -r '.data' | wc -c) 字符"
else
  echo "Word 导出失败"
  echo "响应: $WORD_EXPORT"
fi
echo ""

echo "6. 测试 PDF 导出..."
PDF_EXPORT=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/export/pdf" \
  -H "Authorization: Bearer $TOKEN")

if echo $PDF_EXPORT | jq -e '.data' > /dev/null; then
  echo "PDF 导出成功"
  echo "文件名: $(echo $PDF_EXPORT | jq -r '.filename')"
  echo "数据长度: $(echo $PDF_EXPORT | jq -r '.data' | wc -c) 字符"
else
  echo "PDF 导出失败"
  echo "响应: $PDF_EXPORT"
fi
echo ""

echo "=== 测试完成 ==="
echo ""
echo "注意：Word 和 PDF 导入需要实际的文件，可以使用以下命令测试："
echo "  curl -X POST \"$API_BASE/docs/import/word\" \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" \\"
echo "    -F \"file=@test.docx\""
echo ""
echo "  curl -X POST \"$API_BASE/docs/import/pdf\" \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" \\"
echo "    -F \"file=@test.pdf\""

