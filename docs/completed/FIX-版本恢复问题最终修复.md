# 版本恢复问题最终修复

## 问题描述

1. **恢复版本后内容不显示**：恢复之前的版本后，编辑器仍然显示最新内容，而不是恢复的版本内容
2. **每次恢复都创建新版本**：用户询问这是否正确

## 问题分析

### 问题 1：内容不显示的原因

1. **编辑器初始化逻辑问题**：
   - `checkAndInitFromHtml` 函数只在编辑器为空时才初始化
   - 当编辑器重新初始化时，Yjs 文档可能还保留着之前的内容（通过 WebSocket 同步）
   - 导致 `isEmpty` 检查失败，HTML 内容无法初始化

2. **内容加载优先级问题**：
   - 即使有 HTML 内容，如果快照加载成功，也不会使用 HTML 内容
   - 快照文件可能指向旧内容，导致显示错误

### 问题 2：每次恢复都创建新版本

这是**正确的设计**，原因如下：

1. **保留版本历史**：创建新版本可以保留完整的版本历史，不会丢失任何版本
2. **可追溯性**：可以追踪每次恢复操作，知道什么时候恢复了哪个版本
3. **安全性**：不会直接覆盖当前版本，如果恢复错误可以再次恢复
4. **符合 Git 等版本控制系统的最佳实践**

## 修复方案

### 修复 1：强制使用 HTML 内容初始化

**修改位置**：`frontend/src/components/DocumentEditor.tsx`

**修改内容**：
1. **优先使用 HTML 内容**：如果有 HTML 内容，强制使用 HTML 内容初始化，而不是快照
2. **移除空内容检查**：`checkAndInitFromHtml` 不再检查编辑器是否为空，直接强制设置内容
3. **确保恢复版本显示正确内容**：恢复的版本总是从 HTML 内容初始化，避免快照文件可能指向旧内容的问题

**代码变更**：

```typescript
// 如果有 HTML 内容，强制使用 HTML 内容初始化（优先于快照）
if (hasHtmlContent || hasTextContent) {
    console.log('HTML content available, will initialize from HTML (preferred for restored versions)...');
    
    // 将 HTML 内容存储到 Yjs 的临时字段中，等待编辑器准备好后初始化
    ydoc.getMap('temp').set('html_content', content_html || '');
    ydoc.getMap('temp').set('text_content', content_text || '');
    ydoc.getMap('temp').set('needs_html_init', true);
} else if (snapshot_url && snapshot_url !== 'null') {
    // 只有在没有 HTML 内容时才尝试加载快照
    // ...
}

// checkAndInitFromHtml 函数修改
const checkAndInitFromHtml = () => {
    if (!editor || !isMounted) return;
    
    try {
        const tempMap = ydoc.getMap('temp');
        const needsInit = tempMap.get('needs_html_init');
        const htmlContent = tempMap.get('html_content') as string | undefined;
        
        if (needsInit && htmlContent) {
            // 优化：对于恢复的版本，应该强制设置内容，而不是检查是否为空
            console.log('Initializing editor from HTML content (force mode for restored versions)...');
            
            // 使用 TipTap 的 setContent 方法从 HTML 初始化
            // 这会替换当前内容，确保显示恢复的版本内容
            editor.commands.setContent(htmlContent);
            
            // 清除标记，避免重复初始化
            tempMap.delete('needs_html_init');
            tempMap.delete('html_content');
            tempMap.delete('text_content');
            console.log('Editor initialized from HTML successfully');
        }
    } catch (error) {
        console.error('Failed to initialize from HTML:', error);
    }
};
```

### 修复 2：关于每次恢复都创建新版本

这是**正确的设计**，不需要修改。但可以优化用户体验：

1. **添加确认提示**：在恢复版本时，明确告知用户会创建新版本
2. **显示版本信息**：在恢复成功后，显示新创建的版本号
3. **提供撤销选项**：如果恢复错误，可以再次恢复到之前的版本

## 修复效果

1. **恢复版本后能正确显示内容**：
   - 优先使用 HTML 内容初始化，确保显示恢复的版本内容
   - 不再依赖快照文件，避免快照文件可能指向旧内容的问题

2. **强制设置内容**：
   - 不再检查编辑器是否为空，直接强制设置内容
   - 确保恢复的版本内容能正确显示

3. **版本历史保留**：
   - 每次恢复都创建新版本，保留完整的版本历史
   - 可以追踪每次恢复操作

## 测试建议

1. **测试恢复版本**：
   - 创建一个文档并编辑多次，保存多个版本
   - 恢复到之前的某个版本
   - 验证编辑器显示的是恢复的版本内容，而不是最新内容

2. **测试版本历史**：
   - 恢复版本后，检查版本列表
   - 验证新创建的版本记录（source 为 "restore"）
   - 验证可以再次恢复到其他版本

3. **测试内容一致性**：
   - 恢复版本后，检查编辑器内容是否与恢复的版本内容一致
   - 验证可以正常编辑和保存

## 相关文件

- `frontend/src/components/DocumentEditor.tsx` - 编辑器组件（内容初始化逻辑）
- `cpp-service/src/controllers/DocumentController.cc` - 版本恢复接口（创建新版本逻辑）

## 注意事项

1. **版本历史会增长**：每次恢复都会创建新版本，版本历史会不断增长
2. **存储空间**：每个版本都会占用存储空间，需要考虑版本保留策略
3. **性能影响**：版本数量过多可能影响查询性能，建议设置版本保留限制

## 后续优化建议

1. **版本保留策略**：可以设置自动删除旧版本（例如只保留最近 N 个版本）
2. **版本合并**：可以考虑合并相同内容的版本
3. **恢复确认**：在恢复版本时，显示更详细的确认信息
4. **版本预览**：在恢复前，可以预览要恢复的版本内容

