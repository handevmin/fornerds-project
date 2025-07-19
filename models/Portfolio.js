const mongoose = require('mongoose');

// 포트폴리오 스키마 정의
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
  imageId: {
    // GridFS 파일 ID
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  imageBase64: {
    // Base64 이미지 데이터 (작은 이미지용)
    type: String,
    default: ''
  },
  url: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // URL이 없으면 유효
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
  timestamps: true, // createdAt, updatedAt 자동 생성
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// 인덱스 설정
portfolioSchema.index({ title: 'text', description: 'text', tags: 'text' });
portfolioSchema.index({ category: 1 });
portfolioSchema.index({ featured: -1 });
portfolioSchema.index({ createdAt: -1 });

// 가상 필드 - 이미지 URL
portfolioSchema.virtual('imageUrl').get(function() {
  if (this.imageBase64) {
    return this.imageBase64;
  } else if (this.imageId) {
    return `/api/portfolio/image/${this.imageId}`;
  } else if (this.image) {
    return this.image;
  }
  return '';
});

// 정적 메서드 - 검색 및 필터링
portfolioSchema.statics.findWithFilters = function(filters = {}) {
  let query = {};
  
  // 카테고리 필터
  if (filters.category) {
    query.category = filters.category;
  }
  
  // 태그 필터
  if (filters.tags && filters.tags.length > 0) {
    query.tags = { $in: filters.tags };
  }
  
  // 텍스트 검색
  if (filters.search) {
    query.$text = { $search: filters.search };
  }
  
  // 추천 필터
  if (filters.featured !== undefined) {
    query.featured = filters.featured;
  }
  
  let mongoQuery = this.find(query);
  
  // 정렬
  if (filters.sort) {
    switch (filters.sort) {
      case '최신순':
        mongoQuery = mongoQuery.sort({ featured: -1, createdAt: -1 });
        break;
      case '인기순':
        mongoQuery = mongoQuery.sort({ featured: -1, views: -1, likes: -1 });
        break;
      case '이름순':
        mongoQuery = mongoQuery.sort({ featured: -1, title: 1 });
        break;
      case '조회순':
        mongoQuery = mongoQuery.sort({ featured: -1, views: -1 });
        break;
      default:
        mongoQuery = mongoQuery.sort({ featured: -1, createdAt: -1 });
    }
  } else {
    // 기본 정렬: 추천 포트폴리오 우선, 그 다음 최신순
    mongoQuery = mongoQuery.sort({ featured: -1, createdAt: -1 });
  }
  
  return mongoQuery;
};

// 인스턴스 메서드 - 조회수 증가
portfolioSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// 인스턴스 메서드 - 좋아요 증가/감소
portfolioSchema.methods.toggleLike = function(increment = true) {
  this.likes += increment ? 1 : -1;
  if (this.likes < 0) this.likes = 0;
  return this.save();
};

// 모델 생성
const Portfolio = mongoose.model('Portfolio', portfolioSchema);

// 기본 데이터 초기화 함수
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

module.exports = {
  Portfolio,
  initializeDefaultData
}; 