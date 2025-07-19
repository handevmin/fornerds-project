const express = require('express');
const mongoose = require('mongoose');
const { Portfolio } = require('../models/Portfolio');
const { 
  upload, 
  saveToGridFS, 
  getFromGridFS, 
  deleteFromGridFS,
  encodeImageToBase64,
  decodeBase64Image,
  getFileInfo 
} = require('../middleware/upload');

const router = express.Router();

// 이미지 서빙 엔드포인트 (GridFS)
router.get('/image/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        error: '잘못된 파일 ID입니다.'
      });
    }

    const fileInfo = await getFileInfo(fileId);
    const imageBuffer = await getFromGridFS(fileId);
    
    res.set({
      'Content-Type': fileInfo.metadata.contentType,
      'Content-Length': imageBuffer.length,
      'Cache-Control': 'public, max-age=31536000' // 1년 캐시
    });
    
    res.send(imageBuffer);
  } catch (error) {
    console.error('이미지 조회 오류:', error);
    res.status(404).json({
      success: false,
      error: '이미지를 찾을 수 없습니다.'
    });
  }
});

// GET /api/portfolio - 모든 포트폴리오 조회
router.get('/', async (req, res) => {
  try {
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

// GET /api/portfolio/:id - 특정 포트폴리오 조회
router.get('/:id', async (req, res) => {
  try {
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

// POST /api/portfolio - 새 포트폴리오 생성
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { title, description, url, category, tags, featured, imageBase64 } = req.body;
    
    const portfolioData = {
      title,
      description,
      url,
      category,
      tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim())) : [],
      featured: featured === 'true' || featured === true
    };
    
    // 이미지 처리
    if (req.file) {
      // GridFS에 저장
      const fileId = await saveToGridFS(
        req.file.buffer, 
        req.file.originalname, 
        req.file.mimetype
      );
      portfolioData.imageId = fileId;
    } else if (imageBase64) {
      // Base64 이미지 저장
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

// PUT /api/portfolio/:id - 포트폴리오 업데이트
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
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
    
    // 이미지 처리
    if (req.file) {
      // 기존 GridFS 이미지 삭제
      if (portfolio.imageId) {
        try {
          await deleteFromGridFS(portfolio.imageId);
        } catch (deleteError) {
          console.warn('기존 이미지 삭제 실패:', deleteError);
        }
      }
      
      // 새 이미지 GridFS에 저장
      const fileId = await saveToGridFS(
        req.file.buffer, 
        req.file.originalname, 
        req.file.mimetype
      );
      updateData.imageId = fileId;
      updateData.imageBase64 = '';
    } else if (imageBase64) {
      // Base64 이미지 업데이트
      updateData.imageBase64 = imageBase64;
      if (portfolio.imageId) {
        try {
          await deleteFromGridFS(portfolio.imageId);
        } catch (deleteError) {
          console.warn('기존 이미지 삭제 실패:', deleteError);
        }
        updateData.imageId = null;
      }
    }
    
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

// DELETE /api/portfolio/:id - 포트폴리오 삭제
router.delete('/:id', async (req, res) => {
  try {
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
    
    // GridFS 이미지 삭제
    if (portfolio.imageId) {
      try {
        await deleteFromGridFS(portfolio.imageId);
      } catch (deleteError) {
        console.warn('이미지 삭제 실패:', deleteError);
      }
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

// POST /api/portfolio/:id/like - 좋아요 토글
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params;
    const { increment = true } = req.body;
    
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
    
    await portfolio.toggleLike(increment);
    
    res.json({
      success: true,
      data: { likes: portfolio.likes },
      message: increment ? '좋아요가 추가되었습니다.' : '좋아요가 취소되었습니다.'
    });
  } catch (error) {
    console.error('좋아요 처리 오류:', error);
    res.status(500).json({
      success: false,
      error: '좋아요 처리 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

// GET /api/portfolio/stats/summary - 통계 정보 조회
router.get('/stats/summary', async (req, res) => {
  try {
    const [
      totalCount,
      featuredCount,
      categories,
      allTags,
      topViewed
    ] = await Promise.all([
      Portfolio.countDocuments(),
      Portfolio.countDocuments({ featured: true }),
      Portfolio.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Portfolio.aggregate([
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Portfolio.find().sort({ views: -1 }).limit(5).select('title views')
    ]);
    
    const stats = {
      totalPortfolios: totalCount,
      featuredPortfolios: featuredCount,
      categoryStats: categories.map(cat => ({
        category: cat._id,
        count: cat.count
      })),
      popularTags: allTags.map(tag => ({
        tag: tag._id,
        count: tag.count
      })),
      topViewedPortfolios: topViewed
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('통계 조회 오류:', error);
    res.status(500).json({
      success: false,
      error: '통계 조회 중 오류가 발생했습니다.',
      message: error.message
    });
  }
});

module.exports = router; 