# 文档转换服务（doc-converter-service）

Node.js + Express 的格式转换微服务，为 `cpp-service` 与前端导入/导出流程提供 Word / PDF / Markdown 能力，默认端口为 `3002`。

## 📦 核心特性
- ⏫ **上传限制**：内置 `multer` 内存存储，单文件最大 50MB。
- 📄 **Word ↔ HTML**：
  - `POST /convert/word-to-html` （multipart/form-data，字段 `file`）
  - `POST /convert/html-to-word` （JSON `{ html, title }`，返回 base64 `.docx`）
- 📑 **PDF ↔ 文本**：
  - `POST /convert/pdf-to-text` （multipart/form-data，自动校验 `%PDF` 头）
  - `POST /convert/text-to-pdf` （JSON `{ text, title }`，支持中文字体，默认嵌入 `fonts/` 中的 Noto Sans）
- 📝 **Markdown ↔ HTML**：
  - `POST /convert/markdown-to-html` （JSON `{ markdown }`）
  - `POST /convert/html-to-markdown` （JSON `{ html }`）
- 🫶 **健康检查**：`GET /health` 返回 `{"status":"ok"}`，供 `cpp-service` 启动检查使用。

## 🛠️ 技术栈
- Node.js 18+
- Express 4 / CORS / Multer
- mammoth（Word → HTML）、docx（HTML → Word）
- pdf-parse 2.x、pdf-lib + fontkit（中文字体嵌入）
- marked（Markdown 解析）
- fs-extra / path（临时目录管理）

## 🚀 快速开始
```bash
cd doc-converter-service
npm install

# 可选：指定端口
export PORT=3002

# 开发
npm start

# 或使用 nodemon / pm2 进行守护
```

> 首次启动会自动创建 `temp/` 目录；如需自定义字体，可将 `.ttf` 放入 `fonts/` 并在 `index.js` 中注册。

## ⚙️ 配置
| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | HTTP 服务端口 | `3002` |
| `FONT_PATH` *(可选)* | 自定义 PDF 字体路径 | `fonts/NotoSansSC-Regular.ttf` |

`cpp-service/config.json` 中的 `doc_converter_url` 需指向该服务，例如 `http://localhost:3002`。

## 🔗 调用示例
```bash
# Word → HTML
curl -F "file=@demo.docx" http://localhost:3002/convert/word-to-html

# HTML → Word
curl -X POST http://localhost:3002/convert/html-to-word \
  -H "Content-Type: application/json" \
  -d '{"title":"Demo","html":"<p>Hello</p>"}'

# Markdown → HTML
curl -X POST http://localhost:3002/convert/markdown-to-html \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Codox"}'
```

## 🤝 与其它服务的联动
- `cpp-service` 的 `DocumentController` 负责将导入的 HTML 存入 MinIO/数据库，并在导出时调用本服务获取转换结果。
- 前端的 `ImportModal` / `ExportMenu` 通过后端 API 间接使用文档转换服务，无需直接暴露。
- `docker-compose.yml` 可将该服务与主后端一起编排，或单独部署并通过 `doc_converter_url` 指向。

## 🧪 排障提示
- **转换失败 (500)**：查看日志获取详细堆栈，常见原因是格式损坏或编码不兼容。
- **PDF 中文乱码**：确保字体文件存在且 `fontkit` 能加载，必要时设置 `FONT_PATH`。
- **请求报 400**：检查 Content-Type 是否正确（上传必须 `multipart/form-data`，JSON 需 `application/json`）。

> 所有接口均返回结构化 JSON，包含 `success`、`data`/`html`/`text` 字段与必要的错误提示，方便 `cpp-service` 统一封装。

