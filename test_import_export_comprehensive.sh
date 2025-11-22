#!/bin/bash

# 文档导入导出功能完整测试脚本
# 测试所有导入导出接口的功能

set -e  # 遇到错误立即退出

echo "=== 文档导入导出功能完整测试 ==="
echo ""

# 配置
API_BASE="http://localhost:8080/api"
CONVERTER_URL="http://localhost:3002"

# 测试用户凭据（需要根据实际情况修改）
EMAIL="${TEST_EMAIL:-test@example.com}"
PASSWORD="${TEST_PASSWORD:-test12345}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0

# 辅助函数：打印成功消息
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
    ((PASSED++)) || true
}

# 辅助函数：打印失败消息
print_fail() {
    echo -e "${RED}✗ $1${NC}"
    ((FAILED++)) || true
}

# 辅助函数：打印信息消息
print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# 1. 测试 doc-converter-service 健康检查
echo "1. 测试 doc-converter-service 健康检查..."
if curl -s "$CONVERTER_URL/health" | jq -e '.status == "ok"' > /dev/null 2>&1; then
    print_success "doc-converter-service 运行正常"
else
    print_fail "doc-converter-service 无法访问"
    echo "请确保 doc-converter-service 正在运行: cd doc-converter-service && npm start"
    exit 1
fi
echo ""

# 2. 登录获取 Token
echo "2. 登录获取 Token..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"account\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token // .data.access_token // empty')
if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
    print_fail "登录失败"
    echo "响应: $LOGIN_RESPONSE"
    echo "请检查用户凭据或先创建测试用户"
    exit 1
fi
print_success "Token 获取成功"
echo ""

# 3. 测试 Markdown 导入
echo "3. 测试 Markdown 导入..."
MARKDOWN_CONTENT="# 测试文档

这是一个测试文档。

## 章节1

这是章节1的内容。

### 子章节

- 列表项1
- 列表项2
- 列表项3

**粗体文本** 和 *斜体文本*

\`\`\`python
def hello():
    print('Hello, World!')
\`\`\`"

IMPORT_RESPONSE=$(curl -s -X POST "$API_BASE/docs/import/markdown" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"markdown\":$(echo "$MARKDOWN_CONTENT" | jq -Rs .),\"title\":\"测试Markdown导入\"}")

DOC_ID=$(echo $IMPORT_RESPONSE | jq -r '.id // .data.id // empty')
if [ -z "$DOC_ID" ] || [ "$DOC_ID" == "null" ]; then
    print_fail "Markdown 导入失败"
    echo "响应: $IMPORT_RESPONSE"
    exit 1
fi
print_success "Markdown 导入成功，文档ID: $DOC_ID"
echo ""

# 等待一下确保数据已保存
sleep 1

# 4. 测试 Markdown 导出
echo "4. 测试 Markdown 导出..."
EXPORT_RESPONSE=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/export/markdown" \
  -H "Authorization: Bearer $TOKEN")

if echo $EXPORT_RESPONSE | jq -e '.markdown // .data.markdown' > /dev/null 2>&1; then
    print_success "Markdown 导出成功"
    MARKDOWN_EXPORTED=$(echo $EXPORT_RESPONSE | jq -r '.markdown // .data.markdown')
    if [ -n "$MARKDOWN_EXPORTED" ]; then
        echo "  导出内容长度: ${#MARKDOWN_EXPORTED} 字符"
    fi
else
    print_fail "Markdown 导出失败"
    echo "响应: $EXPORT_RESPONSE"
fi
echo ""

# 5. 测试 Word 导出
echo "5. 测试 Word 导出..."
WORD_EXPORT=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/export/word" \
  -H "Authorization: Bearer $TOKEN")

if echo $WORD_EXPORT | jq -e '.data // .data.data' > /dev/null 2>&1; then
    print_success "Word 导出成功"
    FILENAME=$(echo $WORD_EXPORT | jq -r '.filename // .data.filename // "unknown.docx"')
    echo "  文件名: $FILENAME"
    DATA_LEN=$(echo $WORD_EXPORT | jq -r '.data // .data.data' | wc -c)
    echo "  数据长度: $DATA_LEN 字符"
else
    print_fail "Word 导出失败"
    echo "响应: $WORD_EXPORT"
fi
echo ""

# 6. 测试 PDF 导出
echo "6. 测试 PDF 导出..."
PDF_EXPORT=$(curl -s -X GET "$API_BASE/docs/$DOC_ID/export/pdf" \
  -H "Authorization: Bearer $TOKEN")

if echo $PDF_EXPORT | jq -e '.data // .data.data' > /dev/null 2>&1; then
    print_success "PDF 导出成功"
    FILENAME=$(echo $PDF_EXPORT | jq -r '.filename // .data.filename // "unknown.pdf"')
    echo "  文件名: $FILENAME"
    DATA_LEN=$(echo $PDF_EXPORT | jq -r '.data // .data.data' | wc -c)
    echo "  数据长度: $DATA_LEN 字符"
else
    print_fail "PDF 导出失败"
    echo "响应: $PDF_EXPORT"
fi
echo ""

# 7. 测试 Word 导入（如果有测试文件）
if [ -f "test.docx" ] || [ -f "第八章作业.docx" ]; then
    echo "7. 测试 Word 导入..."
    WORD_FILE=""
    if [ -f "test.docx" ]; then
        WORD_FILE="test.docx"
    else
        WORD_FILE="第八章作业.docx"
    fi
    
    WORD_IMPORT=$(curl -s -X POST "$API_BASE/docs/import/word" \
      -H "Authorization: Bearer $TOKEN" \
      -F "file=@$WORD_FILE")
    
    WORD_DOC_ID=$(echo $WORD_IMPORT | jq -r '.id // .data.id // empty')
    if [ -n "$WORD_DOC_ID" ] && [ "$WORD_DOC_ID" != "null" ]; then
        print_success "Word 导入成功，文档ID: $WORD_DOC_ID"
    else
        print_fail "Word 导入失败"
        echo "响应: $WORD_IMPORT"
    fi
    echo ""
else
    print_info "跳过 Word 导入测试（未找到测试文件 test.docx 或 第八章作业.docx）"
    echo ""
fi

# 8. 测试 PDF 导入（如果有测试文件）
if [ -f "test.pdf" ] || [ -f "第八章作业.pdf" ]; then
    echo "8. 测试 PDF 导入..."
    PDF_FILE=""
    if [ -f "test.pdf" ]; then
        PDF_FILE="test.pdf"
    else
        PDF_FILE="第八章作业.pdf"
    fi
    
    PDF_IMPORT=$(curl -s -X POST "$API_BASE/docs/import/pdf" \
      -H "Authorization: Bearer $TOKEN" \
      -F "file=@$PDF_FILE")
    
    PDF_DOC_ID=$(echo $PDF_IMPORT | jq -r '.id // .data.id // empty')
    if [ -n "$PDF_DOC_ID" ] && [ "$PDF_DOC_ID" != "null" ]; then
        print_success "PDF 导入成功，文档ID: $PDF_DOC_ID"
    else
        print_fail "PDF 导入失败"
        echo "响应: $PDF_IMPORT"
    fi
    echo ""
else
    print_info "跳过 PDF 导入测试（未找到测试文件 test.pdf 或 第八章作业.pdf）"
    echo ""
fi

# 测试总结
echo "=== 测试总结 ==="
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}部分测试失败，请检查上述错误信息${NC}"
    exit 1
fi

