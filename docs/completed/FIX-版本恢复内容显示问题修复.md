# 版本恢复内容显示问题修复

## 问题描述

恢复之前的版本后，文档编辑器无法显示之前版本的内容。虽然版本恢复操作成功，但编辑器显示为空文档。

## 问题分析

### 根本原因

1. **Bootstrap 接口限制**：`getBootstrap` 接口只在 `snapshot_url` 是 `import://` 开头时才返回 `content_html` 和 `content_text`。对于恢复的版本，如果快照文件不存在或无法访问，接口不会返回这些内容字段。

2. **编辑器加载逻辑不完整**：编辑器在快照加载失败时，没有尝试从 `content_html` 或 `content_text` 初始化内容。

3. **恢复版本的数据流**：
   - 恢复版本时，会从旧版本复制 `snapshot_url`、`content_text`、`content_html` 到新版本
   - 更新文档的 `last_published_version_id` 为新版本 ID
   - 但旧版本的快照文件可能已不存在或无法访问

## 修复方案

### 1. 优化 Bootstrap 接口 (`CollaborationController.cc`)

**修改位置**：`cpp-service/src/controllers/CollaborationController.cc`

**修改内容**：
- 在返回快照信息时，即使有快照 URL，也同时返回 `content_html` 和 `content_text`（如果存在）
- 这样当快照文件无法访问时，前端仍可以从 HTML 内容初始化编辑器

**代码变更**：
```cpp
// 优化：即使有快照 URL，也返回 content_html 和 content_text 作为后备方案
// 这样当快照文件无法访问时（例如恢复的旧版本），前端仍可以从 HTML 内容初始化
if (!r[0]["content_html"].isNull() && !r[0]["content_html"].as<std::string>().empty()) {
    responseJson["content_html"] = r[0]["content_html"].as<std::string>();
}
if (!r[0]["content_text"].isNull() && !r[0]["content_text"].as<std::string>().empty()) {
    responseJson["content_text"] = r[0]["content_text"].as<std::string>();
}
```

### 2. 优化编辑器加载逻辑 (`DocumentEditor.tsx`)

**修改位置**：`frontend/src/components/DocumentEditor.tsx`

**修改内容**：
- 添加 `snapshotLoaded` 标志，跟踪快照是否成功加载
- 当快照加载失败时，检查是否有 `content_html` 或 `content_text`，如果有则从 HTML 初始化
- 确保恢复的版本即使快照文件不存在，也能正确显示内容

**代码变更**：
```typescript
let snapshotLoaded = false;
if (snapshot_url && snapshot_url !== 'null') {
    try {
        // ... 快照加载逻辑 ...
        if (snapshotBytes.length > 0) {
            Y.applyUpdate(ydoc, snapshotBytes);
            snapshotLoaded = true;
        }
    } catch (error) {
        console.warn('Failed to load snapshot, will try to initialize from HTML content:', error);
        snapshotLoaded = false;
    }
}

// 如果快照加载失败或没有快照，但有 HTML 或文本内容，则从 HTML 初始化
if (!snapshotLoaded && (content_html || content_text)) {
    // 存储 HTML 内容，等待编辑器准备好后初始化
    ydoc.getMap('temp').set('html_content', content_html || '');
    ydoc.getMap('temp').set('text_content', content_text || '');
    ydoc.getMap('temp').set('needs_html_init', true);
}
```

## 修复效果

1. **恢复版本后能正确显示内容**：即使快照文件不存在，也能从 `content_html` 或 `content_text` 恢复内容
2. **向后兼容**：不影响现有的快照加载逻辑，只是增加了后备方案
3. **更好的错误处理**：快照加载失败时，自动尝试从 HTML 内容初始化
4. **强制重新加载**：恢复版本后，编辑器会强制重新初始化，确保显示最新内容
5. **优先使用 HTML 内容**：如果有 HTML 内容，优先使用 HTML 内容初始化，避免快照文件可能指向旧内容的问题

## 额外修复（第二次修复）

### 问题
用户测试发现，恢复版本后仍然显示最新内容，而不是恢复的版本内容。

### 根本原因
1. **编辑器未重新初始化**：恢复版本后，虽然 `last_published_version_id` 更新了，但编辑器组件没有重新初始化，仍在使用旧的 Yjs 文档状态
2. **快照优先加载**：编辑器优先加载快照文件，如果快照文件存在但指向旧内容，会显示错误的内容

### 修复方案

#### 1. EditorPage 处理 reload 参数 (`EditorPage.tsx`)

**修改内容**：
- 使用 `useSearchParams` 检测 URL 中的 `reload` 参数
- 添加 `editorKey` state，用于强制重新加载编辑器
- 当检测到 `reload=true` 时，增加 `editorKey` 并移除 URL 参数
- 给 `DocumentEditor` 添加 `key` prop，当 `editorKey` 改变时强制重新初始化

**代码变更**：
```typescript
const [searchParams, setSearchParams] = useSearchParams();
const [editorKey, setEditorKey] = useState(0);

useEffect(() => {
  // 检查是否有 reload 参数
  const shouldReload = searchParams.get('reload') === 'true';
  if (shouldReload) {
    setSearchParams({}, { replace: true });
    setEditorKey(prev => prev + 1);
  }
  // ...
}, [docId, id, navigate, searchParams, setSearchParams]);

// 在 DocumentEditor 上使用 key
<DocumentEditor
  key={`editor-${docId}-${editorKey}`}
  docId={docId}
  // ...
/>
```

#### 2. 编辑器优先使用 HTML 内容 (`DocumentEditor.tsx`)

**修改内容**：
- 如果有 HTML 内容，优先使用 HTML 内容初始化，而不是快照
- 只有在没有 HTML 内容时才尝试加载快照
- 这样可以确保恢复的版本显示正确的内容，避免快照文件可能指向旧内容的问题

**代码变更**：
```typescript
// 优化：如果有 HTML 内容，优先使用 HTML 内容初始化（更可靠）
const hasHtmlContent = content_html && content_html.trim().length > 0;
const hasTextContent = content_text && content_text.trim().length > 0;

let snapshotLoaded = false;

// 只有在没有 HTML 内容时才尝试加载快照
if (!hasHtmlContent && snapshot_url && snapshot_url !== 'null') {
  // 加载快照...
}

// 如果有 HTML 或文本内容，优先从 HTML 初始化
if ((hasHtmlContent || hasTextContent) && !snapshotLoaded) {
  // 从 HTML 初始化...
}
```

## 测试建议

1. **测试场景 1：正常快照加载**
   - 创建文档并保存
   - 恢复之前的版本
   - 验证内容能正确显示

2. **测试场景 2：快照文件不存在**
   - 恢复一个快照文件可能已删除的旧版本
   - 验证内容仍能从 HTML 内容恢复并显示

3. **测试场景 3：导入的文档**
   - 导入一个 Markdown/Word 文档
   - 验证内容能正确显示（原有功能）

4. **测试场景 4：恢复后编辑**
   - 恢复版本后，验证可以正常编辑
   - 验证保存后能创建新版本

## 相关文件

- `cpp-service/src/controllers/CollaborationController.cc` - Bootstrap 接口
- `frontend/src/components/DocumentEditor.tsx` - 编辑器组件
- `cpp-service/src/controllers/DocumentController.cc` - 版本恢复接口（无需修改）

## 注意事项

1. 确保版本记录中包含 `content_html` 和 `content_text` 字段
2. 如果旧版本没有这些字段，恢复后可能仍无法显示内容
3. 建议在保存版本时，确保同时保存快照和 HTML/文本内容

## 后续优化建议

1. **版本数据完整性检查**：在恢复版本时，检查是否有可用的内容（快照或 HTML）
2. **快照文件验证**：在返回快照 URL 前，验证文件是否真的存在
3. **内容同步机制**：确保快照和 HTML 内容保持同步
4. **错误提示优化**：当内容无法加载时，给用户更明确的错误提示

