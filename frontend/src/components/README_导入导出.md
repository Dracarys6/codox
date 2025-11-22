# 导入导出功能使用说明

## 组件说明

### ImportModal（导入弹窗）
- **位置**: `frontend/src/components/ImportModal.tsx`
- **功能**: 提供文档导入界面，支持 Word、PDF、Markdown 三种格式
- **使用方式**:
  ```tsx
  <ImportModal
    isOpen={showImportModal}
    onClose={() => setShowImportModal(false)}
    onImportSuccess={(document) => {
      // 导入成功后的回调
      console.log('导入的文档:', document);
    }}
  />
  ```

### ExportMenu（导出菜单）
- **位置**: `frontend/src/components/ExportMenu.tsx`
- **功能**: 提供文档导出功能，支持导出为 Word、PDF、Markdown
- **使用方式**:
  ```tsx
  // 下拉菜单模式
  <ExportMenu docId={123} docTitle="文档标题" variant="dropdown" />
  
  // 按钮模式（三个独立按钮）
  <ExportMenu docId={123} docTitle="文档标题" variant="button" />
  ```

## 已集成位置

1. **DocumentsPage** (`frontend/src/pages/DocumentsPage.tsx`)
   - 顶部工具栏：添加了"导入文档"按钮
   - 文档列表：每个文档的操作列中添加了导出下拉菜单
   - 卡片视图：每个文档卡片中添加了导出按钮

2. **EditorPage** (`frontend/src/pages/EditorPage.tsx`)
   - 顶部工具栏：添加了导出按钮组（Word、PDF、Markdown）

## 功能特点

- ✅ 支持 Word (.docx) 导入导出
- ✅ 支持 PDF 导入导出
- ✅ 支持 Markdown 导入导出
- ✅ 文件大小限制：50MB
- ✅ 自动文件下载
- ✅ 错误处理和用户提示
- ✅ 加载状态显示

## 注意事项

1. 确保 `doc-converter-service` 服务正在运行（端口 3002）
2. 导出需要文档的 viewer 权限
3. Word 导入仅支持 .docx 格式（不支持 .doc）
4. PDF 导出可能丢失复杂格式，主要保留文本内容

