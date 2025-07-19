require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// MongoDB 연결 (서버리스 환경에서는 연결 재사용)
let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }
  
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI 환경변수가 설정되지 않았습니다.');
    }
    
    cachedConnection = await mongoose.connect(
      process.env.MONGODB_URI,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        bufferCommands: false,
      }
    );
    console.log('MongoDB 연결됨');
    return cachedConnection;
  } catch (error) {
    console.error('MongoDB 연결 오류:', error);
    throw error;
  }
};

// Portfolio 스키마 및 모델 정의
const portfolioSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, '제목은 필수 항목입니다.'],
    trim: true,
    maxlength: [200, '제목은 200자를 초과할 수 없습니다.']
  },
  description: {
    type: String,
    required: [true, '설명은 필수 항목입니다.'],
    trim: true,
    maxlength: [2000, '설명은 2000자를 초과할 수 없습니다.']
  },
  image: {
    type: String,
    default: ''
  },
  imageBase64: {
    type: String,
    default: ''
  },
  url: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true;
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: '올바른 URL 형식이 아닙니다.'
    }
  },
  category: {
    type: String,
    required: [true, '카테고리는 필수 항목입니다.'],
    enum: {
      values: ['AI/ML', '엔터프라이즈', 'IoT', '플랫폼', '벤치마크', '데이터', 'OCR'],
      message: '유효하지 않은 카테고리입니다.'
    }
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, '태그는 50자를 초과할 수 없습니다.']
  }],
  featured: {
    type: Boolean,
    default: false
  },
  views: {
    type: Number,
    default: 0
  },
  likes: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// 인덱스 및 메서드 설정
portfolioSchema.index({ title: 'text', description: 'text', tags: 'text' });
portfolioSchema.index({ category: 1 });
portfolioSchema.index({ featured: -1 });
portfolioSchema.index({ createdAt: -1 });

portfolioSchema.statics.findWithFilters = function(filters = {}) {
  let query = {};
  
  if (filters.category) query.category = filters.category;
  if (filters.tags && filters.tags.length > 0) query.tags = { $in: filters.tags };
  if (filters.search) query.$text = { $search: filters.search };
  if (filters.featured !== undefined) query.featured = filters.featured;
  
  let mongoQuery = this.find(query);
  
  if (filters.sort) {
    switch (filters.sort) {
      case '최신순':
        mongoQuery = mongoQuery.sort({ createdAt: -1 });
        break;
      case '인기순':
        mongoQuery = mongoQuery.sort({ featured: -1, views: -1, likes: -1 });
        break;
      case '이름순':
        mongoQuery = mongoQuery.sort({ title: 1 });
        break;
      case '조회순':
        mongoQuery = mongoQuery.sort({ views: -1 });
        break;
      default:
        mongoQuery = mongoQuery.sort({ createdAt: -1 });
    }
  } else {
    mongoQuery = mongoQuery.sort({ createdAt: -1 });
  }
  
  return mongoQuery;
};

portfolioSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

portfolioSchema.methods.toggleLike = function(increment = true) {
  this.likes += increment ? 1 : -1;
  if (this.likes < 0) this.likes = 0;
  return this.save();
};

const Portfolio = mongoose.models.Portfolio || mongoose.model('Portfolio', portfolioSchema);

// 기본 데이터 초기화
const initializeDefaultData = async () => {
  try {
    const count = await Portfolio.countDocuments();
    if (count === 0) {
      const defaultPortfolios = [
        {
          title: '규정 문서 AI 챗봇',
          description: 'PDF, Word 파일 지원 및 자연어 처리를 통해 복잡한 규정 내용을 이해하고 정확한 답변을 제공하는 실시간 챗봇.',
          image: '규정 문서 AI 챗봇.png',
          url: 'https://regulation-ai-chatbot.vercel.app/',
          category: 'AI/ML',
          tags: ['AI', 'NLP'],
          featured: true
        },
        {
          title: 'HR 지원센터',
          description: '인사관리 전반에 특화된 AI 시스템. 채용, 평가, 교육, 복리후생, 노무관리 업무 자동화 및 효율성 극대화.',
          image: 'HR 지원센터.png',
          url: 'https://hr-chatbot-five.vercel.app/',
          category: '엔터프라이즈',
          tags: ['HR', 'AI'],
          featured: true
        },
        {
          title: '스마트팩토리 대시보드',
          description: '실시간 IoT 데이터 통합 및 네트워크 토폴로지 시각화. MES-7000, SCADA-8800 시스템 연동으로 효율성 추적.',
          image: '스마트팩토리 네트워크 대시보드.png',
          url: 'https://smart-factory-network-dashboard.vercel.app/',
          category: 'IoT',
          tags: ['IoT', '실시간'],
          featured: true
        },
        {
          title: 'API Hub',
          description: 'API 디스커버리 엔진과 통합 API 관리 시스템. 카테고리, 제공자, 가격 정책별 API 검색 및 개발자 친화적 환경.',
          image: 'API 허브.png',
          url: 'https://apihub.world/',
          category: '플랫폼',
          tags: ['API', '플랫폼'],
          featured: true
        },
        {
          title: 'LawChat AI',
          description: '전문 분야별 법률 AI와 법률 문서 자동 생성 시스템. 민사, 형사, 가족법 등 특화 AI 및 전문가 연결 서비스.',
          image: 'LawChat.png',
          url: 'https://lawchat-ai.fly.dev/',
          category: 'AI/ML',
          tags: ['법률', 'AI'],
          featured: true
        },
        {
          title: 'LLM Bench',
          description: '대규모 언어모델 벤치마킹 플랫폼. Llama, Mistral, SOLAR 등 주요 모델 성능 비교 및 시각화 대시보드.',
          image: 'LLM Bench.png',
          url: 'https://llm-bench.vercel.app/',
          category: '벤치마크',
          tags: ['LLM', '분석'],
          featured: true
        },
        {
          title: 'OCR 벤치마크 플랫폼',
          description: 'Tesseract, Google Vision, GPT-4o 등 주요 OCR 서비스와 AI 모델의 성능을 종합적으로 비교 분석하는 플랫폼.',
          image: 'OCR 벤치마크 플랫폼.png',
          url: 'http://ocr-benchmark.info/',
          category: 'OCR',
          tags: ['OCR', '분석'],
          featured: true
        },
        {
          title: 'CoDAi',
          description: '지능형 데이터 통합 및 변환 플랫폼. AI 기반 데이터 정규화 및 ERP 시스템 연동으로 디지털 트랜스포메이션 지원.',
          image: 'Codai.png',
          url: 'https://aicodai.com/',
          category: '데이터',
          tags: ['데이터', 'ERP'],
          featured: true
        },
        {
          title: 'CULF AI',
          description: 'AI 기반 콘텐츠 큐레이션 서비스. 개인화 알고리즘과 멀티모달 콘텐츠 처리로 맞춤형 정보 추천 제공.',
          image: 'Culf.png',
          url: 'https://culf.ai/',
          category: 'AI/ML',
          tags: ['큐레이션', 'AI'],
          featured: false
        }
      ];

      await Portfolio.insertMany(defaultPortfolios);
      console.log('기본 포트폴리오 데이터가 초기화되었습니다.');
    }
  } catch (error) {
    console.error('기본 데이터 초기화 오류:', error);
  }
};

const app = express();

// 미들웨어 설정
app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 라우트 핸들러들
app.get('/', async (req, res) => {
  try {
    await connectDB();
    await initializeDefaultData();
    
    const { 
      category, 
      tags, 
      search, 
      sort = '최신순', 
      page = 1, 
      limit = 10,
      featured 
    } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (tags) filters.tags = tags.split(',');
    if (search) filters.search = search;
    if (sort) filters.sort = sort;
    if (featured !== undefined) filters.featured = featured === 'true';
    
    const query = Portfolio.findWithFilters(filters);
    
    // 페이지네이션
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const portfolios = await query.skip(skip).limit(parseInt(limit));
    
    // 전체 개수 계산
    const totalQuery = Portfolio.findWithFilters(filters);
    const totalItems = await totalQuery.countDocuments();
    const totalPages = Math.ceil(totalItems / parseInt(limit));
    
    res.json({
      success: true,
      data: portfolios,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('포트폴리오 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '포트폴리오 조회 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

app.get('/:id', async (req, res) => {
  try {
    await connectDB();
    
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: '잘못된 포트폴리오 ID입니다.'
      });
    }
    
    const portfolio = await Portfolio.findById(id);
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: '포트폴리오를 찾을 수 없습니다.'
      });
    }
    
    // 조회수 증가
    await portfolio.incrementViews();
    
    res.json({
      success: true,
      data: portfolio
    });
  } catch (error) {
    console.error('포트폴리오 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '포트폴리오 조회 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

app.post('/', async (req, res) => {
  try {
    await connectDB();
    
    const { title, description, url, category, tags, featured, imageBase64 } = req.body;
    
    const portfolioData = {
      title,
      description,
      url,
      category,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : [],
      featured: featured === 'true' || featured === true
    };
    
    if (imageBase64) {
      portfolioData.imageBase64 = imageBase64;
    }
    
    const portfolio = new Portfolio(portfolioData);
    await portfolio.save();
    
    res.status(201).json({
      success: true,
      data: portfolio,
      message: '포트폴리오가 성공적으로 생성되었습니다.'
    });
  } catch (error) {
    console.error('포트폴리오 생성 오류:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      res.status(400).json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다.',
        details: validationErrors
      });
    } else {
      res.status(500).json({
        success: false,
        error: '포트폴리오 생성 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  }
});

app.put('/:id', async (req, res) => {
  try {
    await connectDB();
    
    const { id } = req.params;
    const { title, description, url, category, tags, featured, imageBase64 } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: '잘못된 포트폴리오 ID입니다.'
      });
    }
    
    const portfolio = await Portfolio.findById(id);
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: '포트폴리오를 찾을 수 없습니다.'
      });
    }
    
    // 업데이트할 데이터 준비
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (url !== undefined) updateData.url = url;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim());
    if (featured !== undefined) updateData.featured = featured === 'true' || featured === true;
    if (imageBase64 !== undefined) updateData.imageBase64 = imageBase64;
    
    // 포트폴리오 업데이트
    Object.assign(portfolio, updateData);
    await portfolio.save();
    
    res.json({
      success: true,
      data: portfolio,
      message: '포트폴리오가 성공적으로 업데이트되었습니다.'
    });
  } catch (error) {
    console.error('포트폴리오 업데이트 오류:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      res.status(400).json({
        success: false,
        error: '입력 데이터가 올바르지 않습니다.',
        details: validationErrors
      });
    } else {
      res.status(500).json({
        success: false,
        error: '포트폴리오 업데이트 중 오류가 발생했습니다.',
        message: error.message
      });
    }
  }
});

app.delete('/:id', async (req, res) => {
  try {
    await connectDB();
    
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: '잘못된 포트폴리오 ID입니다.'
      });
    }
    
    const portfolio = await Portfolio.findById(id);
    
    if (!portfolio) {
      return res.status(404).json({
        success: false,
        error: '포트폴리오를 찾을 수 없습니다.'
      });
    }
    
    // 포트폴리오 삭제
    await Portfolio.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: '포트폴리오가 성공적으로 삭제되었습니다.',
      data: { id }
    });
  } catch (error) {
    console.error('포트폴리오 삭제 오류:', error);
    res.status(500).json({
      success: false,
      error: '포트폴리오 삭제 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// 서버리스 함수 내보내기
module.exports = app; 