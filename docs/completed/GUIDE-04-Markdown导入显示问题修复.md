# Markdown 导入显示问题修复

## 问题描述

导入的 Markdown 文档在前端打开后显示空文档，保存一次后还是看不到内容。

## 问题原因

1. **导入时保存了 HTML**：Markdown 导入时，将 HTML 保存到 `content_html` 字段
2. **使用了占位符 URL**：使用 `import://markdown/{docId}` 作为 `snapshot_url`
3. **前端需要 Yjs 快照**：前端编辑器使用 Yjs 协作编辑，需要从 `bootstrap` 接口获取快照
4. **占位符无法加载**：占位符 URL 不是有效的快照 URL，导致前端无法加载内容
5. **保存后仍为空**：即使保存一次，也只是保存了空的 Yjs 快照，没有将 HTML 内容转换为 Yjs 格式

## 修复方案

### 1. 后端修改：Bootstrap 接口返回 HTML 内容

**文件**: `cpp-service/src/controllers/CollaborationController.cc`

**修改内容**:
- 当检测到 `import://` 占位符 URL 时，返回 `content_html` 和 `content_text`
- 前端可以根据这些内容初始化编辑器

**代码修改**:
```cpp
if (snapshotUrl.find("import://") == 0) {
    // 返回 content_html 和 content_text，让前端可以从 HTML 初始化
    if (!r[0]["content_html"].isNull()) {
        responseJson["content_html"] = r[0]["content_html"].as<std::string>();
    }
    if (!r[0]["content_text"].isNull()) {
        responseJson["content_text"] = r[0]["content_text"].as<std::string>();
    }
}
```

### 2. 前端修改：从 HTML 初始化编辑器

**文件**: `frontend/src/components/DocumentEditor.tsx`

**修改内容**:
- 更新 `getBootstrap` API 类型定义，包含 `content_html` 和 `content_text`
- 在获取 bootstrap 时，如果没有快照但有 HTML 内容，将 HTML 存储到 Yjs 临时字段
- 在编辑器准备好后，检查是否需要从 HTML 初始化
- 使用 TipTap 的 `setContent()` 方法从 HTML 初始化编辑器内容

**关键代码**:
```typescript
// 1. 在 bootstrap 响应中检查 HTML 内容
if (!snapshot_url && (content_html || content_text)) {
    // 将 HTML 内容存储到 Yjs 临时字段
    ydoc.getMap('temp').set('html_content', content_html || '');
    ydoc.getMap('temp').set('needs_html_init', true);
}

// 2. 在编辑器准备好后初始化
const checkAndInitFromHtml = () => {
    const tempMap = ydoc.getMap('temp');
    const needsInit = tempMap.get('needs_html_init');
    const htmlContent = tempMap.get('html_content');
    
    if (needsInit && htmlContent && editor.isEmpty()) {
        editor.commands.setContent(htmlContent);
        // 清除标记
        tempMap.delete('needs_html_init');
        tempMap.delete('html_content');
    }
};
```

## 工作流程

1. **导入 Markdown**：
   - 后端将 Markdown 转换为 HTML
   - 保存 HTML 到 `content_html` 字段
   - 使用占位符 URL `import://markdown/{docId}` 作为 `snapshot_url`

2. **前端打开文档**：
   - 调用 `bootstrap` 接口
   - 检测到 `import://` 占位符，返回 `content_html`
   - 将 HTML 内容存储到 Yjs 临时字段

3. **编辑器初始化**：
   - 编辑器准备好后，检查是否有 HTML 内容需要初始化
   - 如果编辑器为空，使用 `editor.commands.setContent(htmlContent)` 设置内容
   - 清除临时标记

4. **用户保存**：
   - 保存时，Yjs 文档包含 HTML 转换后的内容
   - 生成真实的 Yjs 快照并上传
   - 更新 `snapshot_url` 为真实的 MinIO URL

## 优势

1. **自动初始化**：导入的文档可以自动显示内容，无需用户手动操作
2. **向后兼容**：不影响现有的快照加载逻辑
3. **简单实现**：利用 TipTap 的 HTML 解析能力，无需复杂的转换逻辑
4. **用户体验好**：用户打开文档就能看到内容

## 测试步骤

1. **导入 Markdown 文档**：
   ```bash
   curl -X POST "http://localhost:8080/api/docs/import/markdown" \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"markdown":"# 测试\n\n这是测试内容","title":"测试文档"}'
   ```

2. **在前端打开文档**：
   - 应该能看到导入的内容
   - 不需要手动保存就能看到

3. **保存文档**：
   - 保存后，内容应该保持不变
   - 刷新页面，应该仍然能看到内容

## 相关文件

- `cpp-service/src/controllers/CollaborationController.cc` - Bootstrap 接口
- `frontend/src/components/DocumentEditor.tsx` - 前端编辑器
- `frontend/src/api/client.ts` - API 客户端类型定义

## 注意事项

1. **HTML 格式**：确保导入的 HTML 格式正确，TipTap 才能正确解析
2. **初始化时机**：需要在编辑器完全初始化后再设置内容，避免与 Yjs 同步冲突
3. **空文档检查**：只在编辑器为空时初始化，避免覆盖已有内容

