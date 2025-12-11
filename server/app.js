const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// 文件上传配置
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型'));
    }
  }
});

// 加载功能词词典
let functionWordDict = {};
try {
  const dictPath = path.join(__dirname, '../dictionary/function_words.json');
  if (fs.existsSync(dictPath)) {
    functionWordDict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
  }
} catch (error) {
  console.error('词典加载失败:', error);
}

// API 路由
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'TextDiff+ API is running' });
});

app.get('/api/dictionary', (req, res) => {
  res.json(functionWordDict);
});

// 兼容旧版API路径
app.get('/get-dict', (req, res) => {
  res.json(functionWordDict);
});

// 文件处理函数
const handleFileExtraction = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '未找到文件' });
    }

    const { originalname, buffer } = req.file;
    const ext = path.extname(originalname).toLowerCase();
    let text = '';

    switch (ext) {
      case '.txt':
        text = buffer.toString('utf8');
        break;
        
      case '.pdf':
        const pdfData = await pdfParse(buffer);
        text = pdfData.text;
        break;
        
      case '.docx':
        const docxResult = await mammoth.extractRawText({ buffer });
        text = docxResult.value;
        break;
        
      default:
        return res.status(400).json({ error: '不支持的文件类型' });
    }

    if (!text.trim()) {
      return res.status(400).json({ error: '文件为空或无法提取文本' });
    }

    res.json({ text: text.trim() });
  } catch (error) {
    console.error('文件处理错误:', error);
    res.status(500).json({ error: '文件处理失败: ' + error.message });
  }
};

// 新版和旧版API路径
app.post('/api/extract-text', upload.single('file'), handleFileExtraction);
app.post('/extract-text', upload.single('file'), handleFileExtraction);

// 保存自定义词典
app.post('/api/dictionary/save', (req, res) => {
  try {
    const { dictionary } = req.body;
    const dictPath = path.join(__dirname, '../dictionary/function_words.json');
    
    // 确保目录存在
    const dictDir = path.dirname(dictPath);
    if (!fs.existsSync(dictDir)) {
      fs.mkdirSync(dictDir, { recursive: true });
    }
    
    fs.writeFileSync(dictPath, JSON.stringify(dictionary, null, 2), 'utf8');
    functionWordDict = dictionary;
    
    res.json({ success: true, message: '词典保存成功' });
  } catch (error) {
    console.error('词典保存失败:', error);
    res.status(500).json({ error: '词典保存失败: ' + error.message });
  }
});

// 静态文件服务 - 用于生产环境
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 错误处理中间件
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小超过限制(10MB)' });
    }
  }
  res.status(500).json({ error: error.message });
});

app.listen(PORT, () => {
  console.log(`🚀 TextDiff+ 服务器运行在 http://localhost:${PORT}`);
});

module.exports = app;