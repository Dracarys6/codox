# 文档导入导出功能说明

## 功能概述

文档导入导出功能支持以下格式：
- **Word (.docx)**: 导入和导出
- **PDF**: 导入和导出
- **Markdown (.md)**: 导入和导出

## 架构说明

### 1. doc-converter-service (Node.js 服务)

独立的文档转换服务，运行在端口 3002，提供以下转换接口：

- `POST /convert/word-to-html` - Word 转 HTML
- `POST /convert/html-to-word` - HTML 转 Word
- `POST /convert/pdf-to-text` - PDF 提取文本
- `POST /convert/text-to-pdf` - 文本转 PDF
- `POST /convert/markdown-to-html` - Markdown 转 HTML
- `POST /convert/html-to-markdown` - HTML 转 Markdown
- `GET /health` - 健康检查

### 2. 后端接口 (C++)

在 `DocumentController` 中实现：

**导入接口：**
- `POST /api/docs/import/word` - 导入 Word 文档
- `POST /api/docs/import/pdf` - 导入 PDF 文档
- `POST /api/docs/import/markdown` - 导入 Markdown 文档

**导出接口：**
- `GET /api/docs/{id}/export/word` - 导出为 Word
- `GET /api/docs/{id}/export/pdf` - 导出为 PDF
- `GET /api/docs/{id}/export/markdown` - 导出为 Markdown

### 3. 前端 API

在 `frontend/src/api/client.ts` 中提供：

```typescript
// 导入
await apiClient.importWord(file);
await apiClient.importPdf(file);
await apiClient.importMarkdown({ markdown: "...", title: "..." });

// 导出
await apiClient.exportWord(docId);
await apiClient.exportPdf(docId);
await apiClient.exportMarkdown(docId);
```

### 4. 前端 UI 组件

- **ImportModal** (`frontend/src/components/ImportModal.tsx`)
  - 导入文档弹窗组件
  - 支持文件上传和 Markdown 文本输入
  - 集成在主页、文档列表页

- **ExportMenu** (`frontend/src/components/ExportMenu.tsx`)
  - 导出菜单组件
  - 支持下拉菜单和按钮两种模式
  - 集成在文档列表、编辑页面

## 启动服务

### 1. 启动 doc-converter-service

```bash
cd doc-converter-service
npm install  # 如果还没有安装依赖
npm start    # 启动服务（默认端口 3002）
```

### 2. 配置后端

在 `cpp-service/config.json` 中添加：

```json
{
  "app": {
    "doc_converter_url": "http://localhost:3002"
  }
}
```

### 3. 启动后端服务

```bash
cd cpp-service
# 编译并启动服务
```

## 前端使用

### 导入文档

在主页、文档列表页面：
1. 点击"导入文档"按钮
2. 选择导入类型（Word/PDF/Markdown）
3. 上传文件或输入 Markdown 内容
4. 导入成功后自动跳转到文档编辑页

### 导出文档

在文档列表或编辑页面：
1. 点击文档操作列的"导出"按钮
2. 选择导出格式（Word/PDF/Markdown）
3. 文件自动下载到本地

## API 使用示例

### 导入 Word 文档

**使用 curl:**
```bash
curl -X POST "http://localhost:8080/api/docs/import/word" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.docx"
```

**使用 httpie:**
```bash
http --form POST localhost:8080/api/docs/import/word \
  Authorization:"Bearer YOUR_TOKEN" \
  file@document.docx
```

### 导入 PDF 文档

**使用 curl:**
```bash
curl -X POST "http://localhost:8080/api/docs/import/pdf" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf"
```

**使用 httpie:**
```bash
http --form POST localhost:8080/api/docs/import/pdf \
  Authorization:"Bearer YOUR_TOKEN" \
  file@document.pdf
```

### 导入 Markdown

```bash
curl -X POST "http://localhost:8080/api/docs/import/markdown" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "markdown": "# 标题\n\n内容...",
    "title": "文档标题"
  }'
```

### 导出文档

```bash
# 导出为 Word
curl -X GET "http://localhost:8080/api/docs/123/export/word" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 导出为 PDF
curl -X GET "http://localhost:8080/api/docs/123/export/pdf" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 导出为 Markdown
curl -X GET "http://localhost:8080/api/docs/123/export/markdown" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 测试

### 运行完整测试脚本

推荐使用完整的测试脚本，它会测试所有导入导出功能：

```bash
./test_import_export_comprehensive.sh
```

该脚本会：
1. 检查 doc-converter-service 健康状态
2. 测试用户登录获取 Token
3. 测试 Markdown 导入
4. 测试 Markdown 导出
5. 测试 Word 导出
6. 测试 PDF 导出
7. 测试 Word 导入（如果有测试文件）
8. 测试 PDF 导入（如果有测试文件）

### 运行基础测试脚本

也可以使用基础测试脚本：

```bash
./test_import_export.sh
```

### 环境变量

测试脚本支持通过环境变量配置测试用户：

```bash
export TEST_EMAIL="your-email@example.com"
export TEST_PASSWORD="your-password"
./test_import_export_comprehensive.sh
```

## 注意事项

1. **doc-converter-service 必须运行**：导入导出功能依赖转换服务
2. **文件大小限制**：默认限制 50MB
3. **权限检查**：导出需要文档的 viewer 权限
4. **格式支持**：
   - Word: 仅支持 .docx 格式（不支持 .doc）
   - PDF: 
     - 导入：文本提取可能不完美，复杂格式可能丢失
     - 导出：当前使用 StandardFonts，**不支持中文字符**。包含中文的文档导出 PDF 会失败，建议使用 Word 或 Markdown 格式导出
   - Markdown: 支持标准 Markdown 语法
5. **内容处理**：
   - PDF 导出：优先使用 `content_text`，如果为空则从 `content_html` 中提取纯文本
   - Word 导出：优先使用 `content_html`，如果为空则使用 `content_text`
   - Markdown 导出：优先使用 `content_html`，如果为空则使用 `content_text`
6. **错误处理**：所有接口都包含完善的错误处理，包括：
   - 转换服务连接失败检测
   - 转换服务错误响应处理
   - JSON 响应格式验证
   - 详细的错误日志输出

## 技术栈

- **转换服务**: Node.js + Express
- **Word 处理**: mammoth (导入), docx (导出)
- **PDF 处理**: pdf-parse (导入), pdf-lib (导出)
- **Markdown 处理**: marked (导入), 简单正则转换 (导出)

## 前端组件

### ImportModal 组件
- **位置**: `frontend/src/components/ImportModal.tsx`
- **功能**: 文档导入弹窗，支持 Word/PDF/Markdown 三种格式
- **特性**:
  - 文件上传（拖拽或点击选择）
  - Markdown 文本输入
  - 文件类型和大小验证
  - 加载状态和错误提示

### ExportMenu 组件
- **位置**: `frontend/src/components/ExportMenu.tsx`
- **功能**: 文档导出菜单，支持导出为 Word/PDF/Markdown
- **特性**:
  - 下拉菜单模式（dropdown）
  - 按钮模式（button，三个独立按钮）
  - 自动文件下载
  - 加载状态显示

### 集成位置
- **主页** (`HomePage.tsx`): 欢迎区域和快速操作卡片
- **文档列表** (`DocumentsPage.tsx`): 顶部工具栏和文档操作列
- **编辑页面** (`EditorPage.tsx`): 顶部工具栏

## 故障排查

1. **转换服务无法连接**
   - 检查 doc-converter-service 是否运行
   - 检查 `config.json` 中的 `doc_converter_url` 配置

2. **导入失败**
   - 检查文件格式是否正确
   - 检查文件大小是否超过限制
   - 查看后端日志

3. **导出失败**
   - 检查文档是否存在
   - 检查用户权限
   - 检查文档是否有内容（content_html 或 content_text）
   - 查看转换服务日志
   - 查看后端日志（包含详细的错误信息）

4. **PDF 导出内容为空或失败**
   - 检查文档版本是否有 content_text 或 content_html
   - 如果只有 HTML 内容，系统会自动提取纯文本
   - 确保文档已发布（有 last_published_version_id）
   - **如果文档包含中文**：当前 PDF 导出不支持中文字符，会返回错误。建议：
     - 使用 Word 格式导出（支持中文）
     - 使用 Markdown 格式导出（支持中文）
     - 或者等待后续版本添加中文字体支持

