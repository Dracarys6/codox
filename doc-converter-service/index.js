/**
 * 文档转换服务
 * 提供 Word、PDF、Markdown 文档的导入导出转换功能
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const pdfParse = require('pdf-parse');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const { marked } = require('marked');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 配置 multer 用于文件上传（内存存储）
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB 限制
});

// 临时文件目录
const TEMP_DIR = path.join(__dirname, 'temp');
fs.ensureDirSync(TEMP_DIR);

/**
 * Word 文档导入：将 .docx 转换为 HTML
 */
app.post('/convert/word-to-html', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const buffer = req.file.buffer;
        
        // 使用 mammoth 将 Word 转换为 HTML
        const result = await mammoth.convertToHtml({ buffer });
        
        res.json({
            success: true,
            html: result.value,
            messages: result.messages
        });
    } catch (error) {
        console.error('Word to HTML conversion error:', error);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

/**
 * HTML 导出为 Word：将 HTML 转换为 .docx
 */
app.post('/convert/html-to-word', async (req, res) => {
    try {
        const { html, title = 'Document' } = req.body;
        
        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        // 简单的 HTML 到 Word 转换
        // 将 HTML 段落转换为 docx 段落
        const paragraphs = [];
        
        // 简单的 HTML 解析（实际项目中可以使用更完善的解析器）
        const htmlText = html.replace(/<[^>]+>/g, ''); // 移除 HTML 标签
        const lines = htmlText.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
            paragraphs.push(
                new Paragraph({
                    children: [new TextRun(line.trim())]
                })
            );
        });

        // 创建 Word 文档
        const doc = new Document({
            sections: [{
                properties: {},
                children: paragraphs.length > 0 ? paragraphs : [
                    new Paragraph({
                        children: [new TextRun('Empty document')]
                    })
                ]
            }]
        });

        // 生成 Word 文档 buffer
        const buffer = await Packer.toBuffer(doc);
        
        // 返回 base64 编码的文档
        const base64 = buffer.toString('base64');
        
        res.json({
            success: true,
            data: base64,
            filename: `${title}.docx`
        });
    } catch (error) {
        console.error('HTML to Word conversion error:', error);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

/**
 * PDF 文档导入：提取 PDF 文本内容
 */
app.post('/convert/pdf-to-text', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const buffer = req.file.buffer;
        
        // 使用 pdf-parse 提取文本
        const data = await pdfParse(buffer);
        
        res.json({
            success: true,
            text: data.text,
            pages: data.numpages,
            info: data.info
        });
    } catch (error) {
        console.error('PDF to text conversion error:', error);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

/**
 * 文本导出为 PDF：将文本转换为 PDF
 * 注意：当前实现使用 Helvetica 字体，不支持中文字符
 * 对于包含中文的文本，会尝试使用 UTF-8 编码，但可能仍会失败
 */
app.post('/convert/text-to-pdf', async (req, res) => {
    try {
        const { text, title = 'Document' } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text content is required' });
        }

        // 创建 PDF 文档
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595, 842]); // A4 尺寸
        
        // 尝试使用支持更多字符的字体
        // 注意：StandardFonts 只支持 Latin-1 字符集，不支持中文
        // 如果需要支持中文，需要嵌入支持中文的字体文件
        let font;
        try {
            font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        } catch (error) {
            console.error('Font embedding error:', error);
            return res.status(500).json({ 
                error: 'Failed to embed font. For Chinese characters, please use a font file that supports Unicode.' 
            });
        }
        
        // 检测是否包含非 ASCII 字符（可能是中文或其他 Unicode 字符）
        const hasNonAscii = /[^\x00-\x7F]/.test(text);
        if (hasNonAscii) {
            // 对于包含非 ASCII 字符的文本，尝试使用 UTF-8 编码
            // 但 StandardFonts 不支持，所以会失败
            // 这里我们提供一个友好的错误信息
            console.warn('Text contains non-ASCII characters, which may not be supported by StandardFonts');
        }
        
        // 添加文本（简单实现，实际可以支持更复杂的格式）
        const lines = text.split('\n');
        let currentPage = page;
        let y = 800; // 从顶部开始
        const lineHeight = 20;
        const margin = 50;
        const fontSize = 12;
        
        // 尝试绘制文本，如果失败则返回错误
        try {
            lines.forEach(line => {
                const trimmedLine = line.trim();
                if (!trimmedLine) {
                    y -= lineHeight / 2; // 空行间距减半
                    return;
                }
                
                if (y < margin + lineHeight) {
                    // 需要新页面
                    currentPage = pdfDoc.addPage([595, 842]);
                    y = 800;
                }
                
                // 尝试绘制文本
                // 如果包含不支持的字符，这里会抛出异常
                currentPage.drawText(trimmedLine, {
                    x: margin,
                    y: y,
                    size: fontSize,
                    font: font
                });
                y -= lineHeight; // 行间距
            });
        } catch (drawError) {
            // 如果绘制失败（通常是因为字符编码问题）
            console.error('Text drawing error:', drawError);
            if (drawError.message && drawError.message.includes('cannot encode')) {
                return res.status(400).json({ 
                    error: 'Text contains characters that cannot be encoded with the current font. Chinese and other Unicode characters require a font file that supports them. Please use a different export format or ensure the text only contains ASCII characters.',
                    details: drawError.message
                });
            }
            throw drawError;
        }

        // 生成 PDF buffer
        const pdfBytes = await pdfDoc.save();
        const base64 = Buffer.from(pdfBytes).toString('base64');
        
        res.json({
            success: true,
            data: base64,
            filename: `${title}.pdf`
        });
    } catch (error) {
        console.error('Text to PDF conversion error:', error);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

/**
 * Markdown 导入：将 Markdown 转换为 HTML
 */
app.post('/convert/markdown-to-html', async (req, res) => {
    try {
        const { markdown } = req.body;
        
        if (!markdown) {
            return res.status(400).json({ error: 'Markdown content is required' });
        }

        // 使用 marked 将 Markdown 转换为 HTML
        const html = marked.parse(markdown);
        
        res.json({
            success: true,
            html: html
        });
    } catch (error) {
        console.error('Markdown to HTML conversion error:', error);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

/**
 * HTML 导出为 Markdown：将 HTML 转换为 Markdown（简化版）
 */
app.post('/convert/html-to-markdown', async (req, res) => {
    try {
        const { html } = req.body;
        
        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        // 简单的 HTML 到 Markdown 转换
        let markdown = html
            .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
            .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
            .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
            .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
            .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
            .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
            .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
            .replace(/<[^>]+>/g, '') // 移除其他 HTML 标签
            .replace(/\n{3,}/g, '\n\n') // 移除多余空行
            .trim();
        
        res.json({
            success: true,
            markdown: markdown
        });
    } catch (error) {
        console.error('HTML to Markdown conversion error:', error);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

/**
 * 健康检查接口
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'doc-converter-service' });
});

// 启动服务
app.listen(PORT, () => {
    console.log(`Document converter service running on port ${PORT}`);
});

// 清理临时文件（定期清理）
setInterval(() => {
    fs.readdir(TEMP_DIR, (err, files) => {
        if (err) return;
        files.forEach(file => {
            const filePath = path.join(TEMP_DIR, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && Date.now() - stats.mtime.getTime() > 3600000) { // 1小时前
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}, 3600000); // 每小时清理一次

