/**
 * 文档转换服务
 * 提供 Word、PDF、Markdown 文档的导入导出转换功能
 */

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun } = require('docx');
// pdf-parse 2.x 版本：需要检查实际导出方式
// 根据测试，pdf-parse 2.x 导出的是一个对象，包含 PDFParse 类
// 但实际使用时，可能需要直接调用模块或使用特定方法
const pdfParseModule = require('pdf-parse');
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
        console.log('Word to HTML conversion request received');
        console.log('  Content-Type:', req.headers['content-type']);
        console.log('  Has file:', !!req.file);
        console.log('  Body keys:', Object.keys(req.body || {}));
        console.log('  Body:', JSON.stringify(req.body));
        
        if (!req.file) {
            console.error('No file uploaded.');
            console.error('  Request body:', req.body);
            console.error('  Request headers:', JSON.stringify(req.headers, null, 2));
            console.error('  Content-Type:', req.headers['content-type']);
            
            // 尝试提供更详细的错误信息
            if (req.headers['content-type'] && !req.headers['content-type'].includes('multipart/form-data')) {
                return res.status(400).json({ 
                    error: 'Invalid Content-Type. Expected multipart/form-data, got: ' + req.headers['content-type'],
                    details: 'Please ensure the request uses multipart/form-data format with a file field named "file"'
                });
            }
            
            return res.status(400).json({ 
                error: 'No file uploaded',
                details: 'Please ensure the file is sent in a field named "file" using multipart/form-data format'
            });
        }

        console.log('  File name:', req.file.originalname);
        console.log('  File size:', req.file.size, 'bytes');
        console.log('  File mimetype:', req.file.mimetype);

        const buffer = req.file.buffer;
        
        // 使用 mammoth 将 Word 转换为 HTML
        const result = await mammoth.convertToHtml({ buffer });
        
        console.log('Conversion successful. HTML length:', result.value.length);
        
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
 * 改进版：保留更多 HTML 格式（标题、粗体、斜体等）
 */
app.post('/convert/html-to-word', async (req, res) => {
    try {
        const { html, title = 'Document' } = req.body;
        
        if (!html) {
            return res.status(400).json({ error: 'HTML content is required' });
        }

        // 改进的 HTML 到 Word 转换
        // 使用简单的正则表达式解析 HTML，保留基本格式
        const paragraphs = [];
        
        // 移除 script 和 style 标签及其内容
        let cleanHtml = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        cleanHtml = cleanHtml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
        
        // 按块级元素分割（p, div, h1-h6, li 等）
        const blockRegex = /<(p|div|h[1-6]|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
        const blocks = [];
        let lastIndex = 0;
        let match;
        
        while ((match = blockRegex.exec(cleanHtml)) !== null) {
            // 添加匹配前的文本（如果有）
            if (match.index > lastIndex) {
                const beforeText = cleanHtml.substring(lastIndex, match.index).trim();
                if (beforeText) {
                    blocks.push({ type: 'text', content: beforeText });
                }
            }
            
            const tagName = match[1].toLowerCase();
            const content = match[2];
            blocks.push({ type: tagName, content: content });
            lastIndex = match.index + match[0].length;
        }
        
        // 处理剩余的文本
        if (lastIndex < cleanHtml.length) {
            const remaining = cleanHtml.substring(lastIndex).trim();
            if (remaining) {
                blocks.push({ type: 'text', content: remaining });
            }
        }
        
        // 如果没有找到块级元素，按换行符分割
        if (blocks.length === 0) {
            const lines = cleanHtml.split(/\n+/).filter(line => line.trim());
            lines.forEach(line => {
                blocks.push({ type: 'text', content: line });
            });
        }
        
        // 将块转换为 Word 段落
        blocks.forEach(block => {
            const content = block.content;
            
            // 提取内联格式（粗体、斜体、代码）
            const textRuns = [];
            let currentIndex = 0;
            let formatMatch;
            
            // 匹配内联格式标签
            const inlineRegex = /<(strong|b|em|i|code|u)[^>]*>([^<]*)<\/\1>/gi;
            const formatStack = [];
            let lastPos = 0;
            
            // 简单处理：提取所有格式标签
            let processedText = content;
            processedText = processedText.replace(/<(strong|b)[^>]*>/gi, '**');
            processedText = processedText.replace(/<\/(strong|b)>/gi, '**');
            processedText = processedText.replace(/<(em|i)[^>]*>/gi, '*');
            processedText = processedText.replace(/<\/(em|i)>/gi, '*');
            processedText = processedText.replace(/<code[^>]*>/gi, '`');
            processedText = processedText.replace(/<\/code>/gi, '`');
            processedText = processedText.replace(/<u[^>]*>/gi, '');
            processedText = processedText.replace(/<\/u>/gi, '');
            processedText = processedText.replace(/<[^>]+>/g, ''); // 移除其他标签
            
            // 按格式标记分割文本
            const parts = processedText.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/);
            
            parts.forEach(part => {
                if (!part.trim()) return;
                
                if (part.startsWith('**') && part.endsWith('**')) {
                    // 粗体
                    const text = part.slice(2, -2);
                    if (text) {
                        textRuns.push(new TextRun({ text: text, bold: true }));
                    }
                } else if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
                    // 斜体
                    const text = part.slice(1, -1);
                    if (text) {
                        textRuns.push(new TextRun({ text: text, italics: true }));
                    }
                } else if (part.startsWith('`') && part.endsWith('`')) {
                    // 代码
                    const text = part.slice(1, -1);
                    if (text) {
                        textRuns.push(new TextRun({ text: text, font: 'Courier New' }));
                    }
                } else {
                    // 普通文本
                    if (part) {
                        textRuns.push(new TextRun(part));
                    }
                }
            });
            
            // 如果没有提取到格式，使用纯文本
            if (textRuns.length === 0) {
                const plainText = content.replace(/<[^>]+>/g, '').trim();
                if (plainText) {
                    textRuns.push(new TextRun(plainText));
                }
            }
            
            // 根据块类型创建段落
            if (textRuns.length > 0) {
                if (block.type.startsWith('h')) {
                    // 标题
                    const level = parseInt(block.type.charAt(1)) || 1;
                    const headingSize = Math.max(24 - (level - 1) * 2, 12);
                    paragraphs.push(
                        new Paragraph({
                            children: textRuns.map(tr => {
                                return new TextRun({ 
                                    text: tr.text, 
                                    bold: true,
                                    size: headingSize * 2 // docx 使用半磅单位
                                });
                            }),
                            spacing: { after: 200 }
                        })
                    );
                } else {
                    // 普通段落
                    paragraphs.push(
                        new Paragraph({
                            children: textRuns,
                            spacing: { after: 100 }
                        })
                    );
                }
            }
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
        
        console.log('PDF to text conversion request received');
        console.log('  File name:', req.file.originalname);
        console.log('  File size:', req.file.size, 'bytes');
        console.log('  File mimetype:', req.file.mimetype);
        
        // 检查文件头，验证是否为有效的 PDF 文件
        const fileHeader = buffer.slice(0, 4).toString('ascii');
        if (fileHeader !== '%PDF') {
            console.error('Invalid PDF file header:', fileHeader);
            return res.status(400).json({ 
                error: 'Invalid PDF file. The uploaded file does not appear to be a valid PDF document.',
                details: `Expected PDF header, got: ${fileHeader}`
            });
        }
        
        // pdf-parse 2.2.2 版本：使用 PDFParse 类
        let data;
        try {
            if (!pdfParseModule.PDFParse) {
                throw new Error('PDFParse class not found in pdf-parse module');
            }
            
            const PDFParse = pdfParseModule.PDFParse;
            // PDFParse 构造函数需要 Uint8Array，将 Buffer 转换为 Uint8Array
            const uint8Array = new Uint8Array(buffer);
            const parser = new PDFParse(uint8Array);
            
            // 等待解析完成
            await parser.load();
            
            // 获取文本和页面信息
            // getText() 返回 Promise，解析后得到包含 pages 数组的对象
            let text = '';
            try {
                const textResult = await parser.getText();
                
                // getText() 返回的对象格式：{ pages: [{ text: "..." }, ...] }
                if (textResult && typeof textResult === 'object') {
                    if (textResult.pages && Array.isArray(textResult.pages)) {
                        // 提取所有页面的文本
                        text = textResult.pages
                            .map(page => page.text || '')
                            .join('\n\n');
                    } else if (typeof textResult === 'string') {
                        text = textResult;
                    } else {
                        // 尝试其他方式提取文本
                        console.warn('PDF getText() returned unexpected format:', Object.keys(textResult));
                        text = JSON.stringify(textResult);
                    }
                } else if (typeof textResult === 'string') {
                    text = textResult;
                }
            } catch (textError) {
                console.error('Error getting text from PDF:', textError);
                text = '';
            }
            
            const numpages = parser.doc ? parser.doc.numPages : 0;
            const info = parser.getInfo() || {};
            
            data = {
                text: text,
                numpages: numpages,
                info: info
            };
        } catch (parseError) {
            console.error('PDF parsing error:', parseError);
            console.error('  Error type:', parseError.constructor.name);
            console.error('  Error message:', parseError.message);
            if (parseError.stack) {
                console.error('  Stack:', parseError.stack.split('\n').slice(0, 5).join('\n'));
            }
            
            // 提供更友好的错误信息
            let errorMessage = 'Failed to parse PDF';
            if (parseError.message && parseError.message.includes('Invalid PDF structure')) {
                errorMessage = 'Invalid PDF structure. The file may be corrupted or not a valid PDF document.';
            } else {
                errorMessage = 'Failed to parse PDF: ' + parseError.message;
            }
            
            return res.status(400).json({ error: errorMessage });
        }
        
        console.log('Conversion successful. Text length:', data.text ? data.text.length : 0, 'characters');
        console.log('  Pages:', data.numpages || data.pages || 'N/A');
        
        res.json({
            success: true,
            text: data.text || '',
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
 * 支持中文字符，使用系统 Noto Sans CJK 字体（如果可用）或回退到 Helvetica
 */
app.post('/convert/text-to-pdf', async (req, res) => {
    try {
        const { text, title = 'Document' } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text content is required' });
        }

        // 创建 PDF 文档
        const pdfDoc = await PDFDocument.create();
        
        // 注册 fontkit 以支持自定义字体嵌入
        pdfDoc.registerFontkit(fontkit);
        
        const page = pdfDoc.addPage([595, 842]); // A4 尺寸
        
        // 尝试加载支持中文的字体
        let font;
        let isChineseFont = false; // 标记是否成功加载了中文字体
        const hasNonAscii = /[^\x00-\x7F]/.test(text);
        
        if (hasNonAscii) {
            // 检测是否包含非 ASCII 字符（可能是中文或其他 Unicode 字符）
            let fontLoaded = false;
            
            // 优先使用项目中的本地字体文件（最可靠）
            // 注意：pdf-lib 无法直接处理 TTC 文件，需要使用 TTF 或 OTF
            const localFontPaths = [
                path.join(__dirname, 'fonts', 'NotoSansCJK-Regular.ttf'), // 从 TTC 提取的 TTF 文件
                path.join(__dirname, 'fonts', 'NotoSansCJKsc-Regular.otf'),
                path.join(__dirname, 'fonts', 'NotoSansSC-Regular.ttf'),
                // TTC 文件放在最后，如果其他都失败，会尝试（但可能会失败）
                path.join(__dirname, 'fonts', 'NotoSansCJK-Regular.ttc'),
            ];
            
            for (const localFontPath of localFontPaths) {
                if (fs.existsSync(localFontPath)) {
                    try {
                        console.log('Loading Chinese font from local file:', localFontPath);
                        const fontBytes = await fs.readFile(localFontPath);
                        console.log('Font file read, size:', fontBytes.length, 'bytes');
                        
                        const fontArray = fontBytes instanceof Uint8Array 
                            ? fontBytes 
                            : new Uint8Array(fontBytes);
                        
                        console.log('Embedding font into PDF document...');
                        // pdf-lib 可以处理 TTF 和 OTF 文件，但无法直接处理 TTC 文件
                        // 如果文件是 TTC，会在这里失败并继续尝试下一个
                        font = await pdfDoc.embedFont(fontArray);
                        console.log('Successfully loaded Chinese font from local file:', localFontPath);
                        fontLoaded = true;
                        isChineseFont = true;
                        break;
                    } catch (fontError) {
                        console.error('Failed to load local font file:', localFontPath);
                        console.error('  Error:', fontError.message);
                        if (fontError.stack) {
                            console.error('  Stack:', fontError.stack.split('\n').slice(0, 5).join('\n'));
                        }
                        // 继续尝试下一个字体文件
                        continue;
                    }
                }
            }
            
            if (!fontLoaded) {
                console.log('No local font file found in fonts directory');
            }
            
            // 如果本地字体加载失败，尝试使用系统字体
            if (!fontLoaded) {
                // 优先使用系统字体（更可靠）
                const fontPaths = [
                    // Linux - Noto Sans CJK SC (简体中文) - 优先使用单独的 OTF 文件
                    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
                    '/usr/share/fonts/truetype/noto/NotoSansCJKsc-Regular.otf',
                    // Linux - Noto Sans CJK (TTC 格式，包含多个子字体)
                    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
                    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
                    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
                    '/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc',
                    // macOS
                    '/System/Library/Fonts/STHeiti Light.ttc',
                    '/System/Library/Fonts/PingFang.ttc',
                    // Windows
                    'C:/Windows/Fonts/msyh.ttc', // 微软雅黑
                    'C:/Windows/Fonts/simsun.ttc', // 宋体
                    'C:/Windows/Fonts/simhei.ttf', // 黑体
                ];
                
                for (const fontPath of fontPaths) {
                    try {
                        if (fs.existsSync(fontPath)) {
                            console.log('Attempting to load font from:', fontPath);
                            const fontBytes = await fs.readFile(fontPath);
                            console.log('Font file read, size:', fontBytes.length, 'bytes');
                            
                            // TTC 文件（TrueType Collection）包含多个字体
                            // pdf-lib 的 embedFont 方法应该能够处理 TTC 文件
                            // 它会自动选择第一个可用的字体
                            const fontArray = fontBytes instanceof Uint8Array 
                                ? fontBytes 
                                : new Uint8Array(fontBytes);
                            
                            console.log('Embedding font into PDF document...');
                            font = await pdfDoc.embedFont(fontArray);
                            console.log('Successfully loaded and embedded Chinese font from:', fontPath);
                            console.log('Font object:', typeof font, font.constructor.name);
                            fontLoaded = true;
                            isChineseFont = true;
                            break;
                        } else {
                            console.log('Font file not found:', fontPath);
                        }
                    } catch (fontError) {
                        console.error('Failed to load font from', fontPath);
                        console.error('  Error message:', fontError.message);
                        console.error('  Error type:', fontError.constructor.name);
                        if (fontError.stack) {
                            console.error('  Stack (first 5 lines):', fontError.stack.split('\n').slice(0, 5).join('\n'));
                        }
                        continue;
                    }
                }
            }
            
            // 如果所有字体加载都失败，尝试从在线 URL 下载字体（最后备选）
            if (!fontLoaded) {
                console.log('Attempting to download font from online sources...');
                const fontUrls = [
                    // 使用 jsDelivr CDN，更稳定
                    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosanscjksc/NotoSansCJKsc-Regular.otf',
                    // GitHub raw 作为备选
                    'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanscjksc/NotoSansCJKsc-Regular.otf',
                    // Google Fonts CDN
                    'https://fonts.gstatic.com/s/notosanssc/v36/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnY1.ttf',
                ];
                
                for (const fontUrl of fontUrls) {
                    try {
                        const https = require('https');
                        const http = require('http');
                        const client = fontUrl.startsWith('https') ? https : http;
                        
                        console.log('Attempting to download font from:', fontUrl);
                        
                        const fontBytes = await new Promise((resolve, reject) => {
                            const req = client.get(fontUrl, (res) => {
                                if (res.statusCode !== 200) {
                                    reject(new Error(`HTTP ${res.statusCode}`));
                                    return;
                                }
                                const chunks = [];
                                res.on('data', (chunk) => chunks.push(chunk));
                                res.on('end', () => {
                                    const buffer = Buffer.concat(chunks);
                                    console.log('Font downloaded, size:', buffer.length, 'bytes');
                                    resolve(buffer);
                                });
                            });
                            req.on('error', reject);
                            req.setTimeout(10000, () => { // 10 秒超时
                                req.destroy();
                                reject(new Error('Font download timeout'));
                            });
                        });
                        
                        // 确保 fontBytes 是 Uint8Array
                        const fontArray = fontBytes instanceof Uint8Array 
                            ? fontBytes 
                            : new Uint8Array(fontBytes);
                        
                        font = await pdfDoc.embedFont(fontArray);
                        console.log('Successfully loaded Chinese font from online URL:', fontUrl);
                        fontLoaded = true;
                        isChineseFont = true;
                        break;
                    } catch (fontError) {
                        console.warn('Failed to load font from URL:', fontUrl, ':', fontError.message);
                        continue;
                    }
                }
            }
            
            // 如果所有字体加载都失败，使用 Helvetica 并给出警告
            if (!fontLoaded) {
                console.error('Failed to load any Chinese font. Using Helvetica as fallback (Chinese characters may not display correctly).');
                // 使用 Helvetica 作为最后的备选，虽然中文会显示为乱码，但至少能导出
                font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                isChineseFont = false;
                // 注意：这里不返回错误，而是继续处理，但会在绘制时过滤掉非 ASCII 字符
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

