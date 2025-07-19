require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { connectDB } = require('./config/database');
const { initializeDefaultData } = require('./models/Portfolio');
const portfolioRoutes = require('./routes/portfolio');

const app = express();
const PORT = process.env.PORT || 3000;

// 보안 미들웨어 - CDN 허용을 위한 CSP 설정
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
});
app.use('/api/', limiter);

// CORS 설정
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:5500', 'http://localhost:5500'],
  credentials: true
}));

// JSON 파싱 미들웨어
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 이메일 발송을 위한 nodemailer 설정
const nodemailer = require('nodemailer');

// Gmail SMTP 설정
let transporter = null;
if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
} else {
    console.warn('Gmail 인증 정보가 환경변수에 설정되지 않았습니다. 이메일 기능이 비활성화됩니다.');
}

// 이메일 발송 라우트
app.post('/api/send-email', async (req, res) => {
    try {
        // transporter 체크
        if (!transporter) {
            return res.status(500).json({
                success: false,
                message: '이메일 서비스가 설정되지 않았습니다.'
            });
        }
        
        const { company, name, phone, email, project_type, message } = req.body;
        
        // 이메일 내용 구성
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: process.env.GMAIL_USER,
            subject: `[포너즈] ${company} - ${project_type} 문의`,
            html: `
                <h2>포너즈 웹사이트 문의</h2>
                <p><strong>회사명:</strong> ${company}</p>
                <p><strong>담당자명:</strong> ${name}</p>
                <p><strong>연락처:</strong> ${phone}</p>
                <p><strong>이메일:</strong> ${email}</p>
                <p><strong>프로젝트 유형:</strong> ${project_type}</p>
                <p><strong>프로젝트 설명:</strong></p>
                <p>${message.replace(/\n/g, '<br>')}</p>
                <hr>
                <p><small>이 메일은 포너즈 웹사이트의 문의 폼을 통해 발송되었습니다.</small></p>
            `
        };
        
        // 이메일 전송
        await transporter.sendMail(mailOptions);
        
        res.status(200).json({ 
            success: true, 
            message: '문의가 성공적으로 전송되었습니다!' 
        });
        
    } catch (error) {
        console.error('Email send error:', error);
        res.status(500).json({ 
            success: false, 
            message: '이메일 전송에 실패했습니다.' 
        });
    }
});

// 정적 파일 서빙
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 라우트
app.use('/api/portfolio', portfolioRoutes);

// 기본 라우트 - 메인 포트폴리오 페이지로 리다이렉트
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API 정보 라우트
app.get('/api', (req, res) => {
  res.json({
    message: 'FORNERDS 포트폴리오 API 서버',
    version: '1.0.0',
    endpoints: {
      'GET /api/portfolio': '모든 포트폴리오 조회',
      'GET /api/portfolio/:id': '특정 포트폴리오 조회',
      'POST /api/portfolio': '새 포트폴리오 생성',
      'PUT /api/portfolio/:id': '포트폴리오 수정',
      'DELETE /api/portfolio/:id': '포트폴리오 삭제'
    }
  });
});

// 404 에러 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    error: '요청한 엔드포인트를 찾을 수 없습니다.',
    path: req.originalUrl
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: '서버 내부 오류가 발생했습니다.',
    message: process.env.NODE_ENV === 'development' ? err.message : '서버 오류'
  });
});

// 서버 시작 함수
const startServer = async () => {
  try {
    // MongoDB 연결
    await connectDB();
    
    // 기본 데이터 초기화
    await initializeDefaultData();
    
    // 서버 시작
    app.listen(PORT, () => {
      console.log(`🚀 FORNERDS 포트폴리오 API 서버가 포트 ${PORT}에서 실행 중입니다.`);
      console.log(`📖 API 문서: http://localhost:${PORT}/`);
      console.log(`💾 MongoDB 연결 상태: 정상`);
    });
  } catch (error) {
    console.error('서버 시작 실패:', error);
    process.exit(1);
  }
};

// 서버 시작
startServer();

module.exports = app; 