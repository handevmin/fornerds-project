const nodemailer = require('nodemailer');

export default async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONS 요청 처리 (preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    
    try {
        const { company, name, phone, email, project_type, message } = req.body;
        
        // 환경변수 확인
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
            throw new Error('Gmail 인증 정보가 환경변수에 설정되지 않았습니다.');
        }
        
        // Gmail SMTP 설정
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });
        
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
} 