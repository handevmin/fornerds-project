# FORNERDS 포트폴리오 관리 시스템

MongoDB 기반의 동적 포트폴리오 관리 시스템입니다. Express.js 백엔드와 Vanilla JavaScript 프론트엔드로 구성되어 있으며, 이미지 업로드(GridFS/Base64), 실시간 검색, 필터링, 관리자 패널 등의 기능을 제공합니다.

## 주요 기능

- **RESTful API**: 포트폴리오 데이터 CRUD 작업
- **이미지 업로드**: Multer를 사용한 이미지 파일 업로드
- **실시간 데이터 연동**: 프론트엔드와 실시간 데이터 동기화
- **관리자 패널**: 포트폴리오 관리를 위한 웹 인터페이스
- **필터링 및 검색**: 카테고리, 태그, 키워드 기반 검색
- **통계 대시보드**: 포트폴리오 통계 정보 제공

## API 엔드포인트

### 포트폴리오 관리
- `GET /api/portfolio` - 모든 포트폴리오 조회
- `GET /api/portfolio/:id` - 특정 포트폴리오 조회
- `POST /api/portfolio` - 새 포트폴리오 생성
- `PUT /api/portfolio/:id` - 포트폴리오 수정
- `DELETE /api/portfolio/:id` - 포트폴리오 삭제

### 통계
- `GET /api/portfolio/stats/summary` - 포트폴리오 통계 조회

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

### 3. 프로덕션 서버 실행
```bash
npm start
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## 프로젝트 구조

```
포너즈 포트폴리오/
├── config/
│   └── database.js         # MongoDB 연결 설정
├── models/
│   └── Portfolio.js        # Mongoose 스키마 및 모델
├── middleware/
│   └── upload.js          # GridFS 업로드 미들웨어
├── routes/
│   └── portfolio.js       # API 라우트
├── api/portfolio/
│   └── index.js          # Vercel 서버리스 함수
├── public/
│   ├── index.html        # 메인 포트폴리오 페이지
│   ├── admin.html        # 관리자 패널
│   └── *.png            # 이미지 파일들
├── server.js             # Express 서버
├── package.json          # 의존성 및 스크립트
├── vercel.json           # Vercel 배포 설정
├── .env.example          # 환경 변수 예시
└── README.md
```

## 사용 방법

### 1. 포트폴리오 웹사이트 접속
- `index.html` 파일을 브라우저에서 열거나 웹 서버에서 서빙
- 백엔드 API 서버가 실행 중이어야 함

### 2. 관리자 패널 접속
- `admin.html` 파일을 브라우저에서 열기
- 포트폴리오 추가, 수정, 삭제 가능
- 통계 정보 확인 가능

### 3. API 직접 호출
```javascript
// 포트폴리오 조회
fetch('http://localhost:3000/api/portfolio')
  .then(response => response.json())
  .then(data => console.log(data));

// 새 포트폴리오 생성
const formData = new FormData();
formData.append('title', '새 프로젝트');
formData.append('description', '프로젝트 설명');
formData.append('category', 'AI/ML');
formData.append('tags', 'AI,ML,딥러닝');

fetch('http://localhost:3000/api/portfolio', {
  method: 'POST',
  body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

## 주요 기능 설명

### 1. 동적 포트폴리오 관리
- 기존 정적 HTML에서 API 기반 동적 데이터로 전환
- 실시간 데이터 업데이트 및 동기화

### 2. 이미지 업로드
- 5MB 이하의 이미지 파일 업로드 지원
- JPG, PNG, GIF, WebP 형식 지원
- 자동 파일명 생성 및 저장

### 3. 검색 및 필터링
- 제목, 설명, 태그 기반 검색
- 카테고리별 필터링
- 정렬 기능 (최신순, 인기순, 이름순)

### 4. 관리자 패널
- 직관적인 웹 인터페이스
- 드래그 앤 드롭 이미지 업로드
- 실시간 통계 대시보드

## 보안 기능

- **Helmet**: 기본 보안 헤더 설정
- **Rate Limiting**: API 요청 제한 (15분당 100요청)
- **CORS**: 허용된 도메인에서만 접근 가능
- **파일 검증**: 이미지 파일 타입 및 크기 제한

## 데이터 구조

### 포트폴리오 객체
```javascript
{
  id: "unique-id",
  title: "프로젝트 제목",
  description: "프로젝트 설명",
  image: "이미지 파일명 또는 URL",
  url: "프로젝트 URL",
  category: "카테고리",
  tags: ["태그1", "태그2"],
  featured: true/false,
  createdAt: "2025-01-XX",
  updatedAt: "2025-01-XX"
}
```

## 프론트엔드 연동

기존 `index.html`이 자동으로 백엔드 API와 연동됩니다:

- 페이지 로드 시 자동으로 포트폴리오 데이터 fetch
- 검색 및 필터링 기능 동작
- 삭제 버튼으로 포트폴리오 제거 가능
- API 연결 실패 시 기본 데이터 표시

## 주의사항

1. **서버 실행**: 프론트엔드 사용 전 반드시 백엔드 서버 실행
2. **CORS 설정**: 필요시 `server.js`에서 허용 도메인 추가
3. **이미지 경로**: 업로드된 이미지는 `/uploads` 경로에서 서빙
4. **메모리 저장**: 현재 데이터는 메모리에 저장 (서버 재시작 시 초기화)

## 향후 개선사항

- 데이터베이스 연동 (MongoDB, PostgreSQL)
- 사용자 인증 및 권한 관리
- 이미지 최적화 및 CDN 연동
- 실시간 알림 기능
- 백업 및 복원 기능

## 문의

프로젝트 관련 문의사항이 있으시면 FORNERDS 개발팀에 연락해주세요.

---

**FORNERDS** - AI 기반 솔루션 전문 개발사 