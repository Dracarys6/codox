/**
 * 文档转换服务
 * 提供 Word、PDF、Markdown 文档的导入导出转换功能
 */

const express = require('express');
const cors = require('cors');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const fontkit = require('fontkit');
const { marked } = require('marked');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件配置
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

/**
 * HTML 导出为 Word：将 HTML 转换为 .docx，并以二进制流形式返回
 * 使用现成库 html-to-docx 简化实现
 */
app.post('/convert/html-to-word', async (req, res) => {
    try {
        const { html, title = 'Document' } = req.body;
        
        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        // 为避免在接口中动态 require 失败，这里按需加载 html-to-docx
        const htmlToDocx = require('html-to-docx');

        // html-to-docx 返回的是一个 Buffer（Promise<Buffer>）
        const buffer = await htmlToDocx(html, null, {
            table: { row: { cantSplit: true } },
        });

        const filename = `${title}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

        // 使用流式写出二进制数据
        res.write(buffer);
        res.end();
    } catch (error) {
        console.error('HTML to Word conversion error:', error);
        res.status(500).json({ error: 'Conversion failed: ' + error.message });
    }
});

/**
 * 文本导出为 PDF：将文本转换为 PDF
 * 简化实现：优先尝试加载本地/系统中文字体，失败则回退到 Helvetica，
 * 并使用二进制流返回而不是 Base64 JSON。
 */
app.post('/convert/text-to-pdf', async (req, res) => {
    try {
        const { text, title = 'Document' } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text content is required' });
        }

        // 创建 PDF 文档
        const pdfDoc = await PDFDocument.create();
        pdfDoc.registerFontkit(fontkit);
        
        const page = pdfDoc.addPage([595, 842]); // A4 尺寸
        
        // 尝试加载支持中文的字体
        let font;
        let isChineseFont = false; // 标记是否成功加载了中文字体
        const hasNonAscii = /[^\x00-\x7F]/.test(text);
        
        if (hasNonAscii) {
            // 简化版字体加载逻辑：先尝试项目内 fonts 目录，再尝试常见系统路径
            let fontLoaded = false;

            const localFontPaths = [
                path.join(__dirname, 'fonts', 'NotoSansSC-Regular.ttf'),
                path.join(__dirname, 'fonts', 'NotoSansCJKsc-Regular.otf'),
            ];

            const systemFontPaths = [
                // Linux
                '/usr/share/fonts/truetype/noto/NotoSansCJKsc-Regular.otf',
                '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
                // Windows
                'C:/Windows/Fonts/msyh.ttc',
                'C:/Windows/Fonts/simsun.ttc',
                // macOS
                '/System/Library/Fonts/PingFang.ttc',
            ];

            const candidatePaths = [...localFontPaths, ...systemFontPaths];

            for (const fontPath of candidatePaths) {
                if (!fs.existsSync(fontPath)) continue;
                try {
                    console.log('Loading font for PDF from:', fontPath);
                    const fontBytes = await fs.readFile(fontPath);
                    const fontArray = fontBytes instanceof Uint8Array ? fontBytes : new Uint8Array(fontBytes);
                    font = await pdfDoc.embedFont(fontArray);
                    fontLoaded = true;
                    isChineseFont = true;
                    break;
                } catch (e) {
                    console.warn('Failed to load font from', fontPath, e.message);
                }
            }

            if (!fontLoaded) {
                console.warn('No Chinese font found, fallback to Helvetica. Non-ASCII characters may not render correctly.');
                font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                isChineseFont = false;
            }
        } else {
            // 纯 ASCII 文本，使用标准字体
            font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            isChineseFont = false;
        }
        
        // 添加文本（简单实现，实际可以支持更复杂的格式）
        const lines = text.split('\n');
        let currentPage = page;
        let y = 800; // 从顶部开始
        const lineHeight = 20;
        const margin = 50;
        const fontSize = 12;
        
        // 尝试绘制文本
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
                
                // 如果包含非 ASCII 字符但未加载中文字体，过滤掉不支持字符
                let textToDraw = trimmedLine;
                if (hasNonAscii && !isChineseFont) {
                    // 如果使用 Helvetica 且包含非 ASCII 字符，过滤掉非 ASCII 字符
                    // 或者替换为占位符
                    textToDraw = trimmedLine.replace(/[^\x00-\x7F]/g, '?');
                    console.warn('Filtering non-ASCII characters (Chinese font not available)');
                }
                
                // 绘制文本
                try {
                    currentPage.drawText(textToDraw, {
                        x: margin,
                        y: y,
                        size: fontSize,
                        font: font
                    });
                } catch (drawLineError) {
                    // 如果单行绘制失败，记录错误但继续
                    console.error('Error drawing line:', drawLineError.message);
                    console.error('Problematic line:', textToDraw.substring(0, 50));
                    // 尝试绘制一个占位符
                    try {
                        currentPage.drawText('[Text rendering error]', {
                            x: margin,
                            y: y,
                            size: fontSize,
                            font: font
                        });
                    } catch (placeholderError) {
                        console.error('Even placeholder failed:', placeholderError.message);
                    }
                }
                y -= lineHeight; // 行间距
            });
        } catch (drawError) {
            // 如果绘制失败（通常是因为字符编码问题）
            console.error('Text drawing error:', drawError);
            if (drawError.message && drawError.message.includes('cannot encode')) {
                return res.status(400).json({ 
                    error: 'Text contains characters that cannot be encoded with the current font. Please ensure a Chinese font is available on the system.',
                    details: drawError.message
                });
            }
            throw drawError;
        }

        // 生成 PDF buffer，并以二进制流形式返回
        const pdfBytes = await pdfDoc.save();
        const buffer = Buffer.from(pdfBytes);
        const filename = `${title}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

        res.write(buffer);
        res.end();
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
