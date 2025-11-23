# 字体文件说明

此目录包含用于 PDF 导出的中文字体文件。

## 当前字体文件

- `NotoSansCJK-Regular.ttf` - Noto Sans CJK 字体（从 TTC 提取的单个字体）
  - 文件大小：约 17MB
  - 来源：从 `NotoSansCJK-Regular.ttc` 提取（使用 fonttools）
  - 支持：中文（简体、繁体）、日文、韩文
  - **注意**：`pdf-lib` 无法直接处理 TTC 文件，必须使用 TTF 或 OTF 格式

- `NotoSansCJK-Regular.ttc` - Noto Sans CJK 字体集合（TTC 格式，包含多个子字体）
  - 文件大小：约 20MB
  - 来源：系统字体目录 `/usr/share/fonts/opentype/noto/`
  - 支持：中文（简体、繁体）、日文、韩文
  - **注意**：此文件仅作为备份，实际使用的是从它提取的 TTF 文件

## 字体加载优先级

PDF 导出服务会按以下顺序尝试加载字体：

1. **项目本地字体**（`doc-converter-service/fonts/`）
   - `NotoSansCJK-Regular.ttf` ⭐ **优先使用**
   - `NotoSansCJKsc-Regular.otf`
   - `NotoSansSC-Regular.ttf`
   - `NotoSansCJK-Regular.ttc`（备用，pdf-lib 无法直接使用）

2. **系统字体**
   - Linux: `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`
   - macOS: `/System/Library/Fonts/STHeiti Light.ttc`
   - Windows: `C:/Windows/Fonts/msyh.ttc`

3. **在线下载**（如果网络可用）
   - 从 GitHub 或 Google Fonts CDN 下载

## 注意事项

- **重要**：`pdf-lib` **无法直接处理 TTC 文件**，必须使用 TTF 或 OTF 格式
- 如果系统只有 TTC 文件，需要使用 `fonttools` 提取单个字体：
  ```bash
  python3 -m pip install fonttools
  python3 -c "from fontTools.ttLib import TTFont; TTFont('NotoSansCJK-Regular.ttc', fontNumber=0).save('NotoSansCJK-Regular.ttf')"
  ```
- 如果字体加载失败，PDF 导出会使用 Helvetica 作为备选（中文会显示为 `?`）
- 建议将 TTF 字体文件添加到版本控制中，以确保所有环境都能使用

