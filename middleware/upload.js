const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const mongoose = require('mongoose');

// 파일 필터 함수
const fileFilter = (req, file, cb) => {
  // 이미지 파일만 허용
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
  }
};

// Multer 설정 (메모리 저장소 사용)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB 제한
  },
  fileFilter: fileFilter
});

// GridFS에 파일 저장하는 함수
const saveToGridFS = (buffer, filename, mimetype) => {
  return new Promise((resolve, reject) => {
    if (!mongoose.connection.db) {
      return reject(new Error('MongoDB 연결이 필요합니다.'));
    }

    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'portfolio_images'
    });

    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        originalName: filename,
        contentType: mimetype,
        uploadedAt: new Date()
      }
    });

    uploadStream.on('error', reject);
    uploadStream.on('finish', (file) => {
      resolve(file._id);
    });

    uploadStream.end(buffer);
  });
};

// GridFS에서 파일 가져오는 함수
const getFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!mongoose.connection.db) {
      return reject(new Error('MongoDB 연결이 필요합니다.'));
    }

    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'portfolio_images'
    });

    const downloadStream = bucket.openDownloadStream(new mongoose.Types.ObjectId(fileId));
    const chunks = [];

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('error', reject);

    downloadStream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
    });
  });
};

// GridFS에서 파일 삭제하는 함수
const deleteFromGridFS = (fileId) => {
  return new Promise((resolve, reject) => {
    if (!mongoose.connection.db) {
      return reject(new Error('MongoDB 연결이 필요합니다.'));
    }

    const bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'portfolio_images'
    });

    bucket.delete(new mongoose.Types.ObjectId(fileId), (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

// Base64로 이미지 인코딩
const encodeImageToBase64 = (buffer, mimetype) => {
  const base64 = buffer.toString('base64');
  return `data:${mimetype};base64,${base64}`;
};

// Base64에서 이미지 디코딩
const decodeBase64Image = (base64String) => {
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  
  if (!matches || matches.length !== 3) {
    throw new Error('잘못된 Base64 형식입니다.');
  }

  return {
    mimetype: matches[1],
    buffer: Buffer.from(matches[2], 'base64')
  };
};

// 파일 메타데이터 가져오기
const getFileInfo = async (fileId) => {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB 연결이 필요합니다.');
  }

  const bucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'portfolio_images'
  });

  const files = await bucket.find({ _id: new mongoose.Types.ObjectId(fileId) }).toArray();
  
  if (files.length === 0) {
    throw new Error('파일을 찾을 수 없습니다.');
  }

  return files[0];
};

module.exports = {
  upload,
  saveToGridFS,
  getFromGridFS,
  deleteFromGridFS,
  encodeImageToBase64,
  decodeBase64Image,
  getFileInfo
}; 