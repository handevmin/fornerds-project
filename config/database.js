const mongoose = require('mongoose');
const { GridFSBucket } = require('mongodb');

let gridfsBucket;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fornerds-portfolio');

    console.log(`MongoDB 연결됨: ${conn.connection.host}`);

    // GridFS 초기화
    gridfsBucket = new GridFSBucket(conn.connection.db, {
      bucketName: 'portfolio_images'
    });

    return conn;
  } catch (error) {
    console.error('MongoDB 연결 오류:', error);
    process.exit(1);
  }
};

const getGridFSBucket = () => gridfsBucket;

module.exports = {
  connectDB,
  getGridFSBucket
}; 