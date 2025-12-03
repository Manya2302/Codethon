import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';

// GridFS bucket for images
let gridFSBucket = null;

// Initialize GridFS bucket
export function initGridFS() {
  if (mongoose.connection.readyState === 1) {
    gridFSBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'images'
    });
    console.log('✅ GridFS bucket initialized');
  }
}

// Get GridFS bucket instance
export function getGridFSBucket() {
  if (!gridFSBucket && mongoose.connection.readyState === 1) {
    gridFSBucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'images'
    });
  }
  return gridFSBucket;
}

// Upload image to GridFS
export async function uploadImageToGridFS(fileBuffer, filename, metadata = {}) {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    if (!bucket) {
      return reject(new Error('GridFS bucket not initialized'));
    }

    const uploadStream = bucket.openUploadStream(filename, {
      metadata: {
        uploadedAt: new Date(),
        ...metadata
      }
    });

    uploadStream.on('error', (error) => {
      reject(error);
    });

    uploadStream.on('finish', () => {
      resolve({
        fileId: uploadStream.id.toString(),
        filename: filename
      });
    });

    uploadStream.end(fileBuffer);
  });
}

// Get image stream from GridFS
export function getImageStream(fileId) {
  const bucket = getGridFSBucket();
  if (!bucket) {
    throw new Error('GridFS bucket not initialized');
  }
  const ObjectId = mongoose.Types.ObjectId || mongoose.Schema.Types.ObjectId;
  return bucket.openDownloadStream(new ObjectId(fileId));
}

// Delete image from GridFS
export async function deleteImageFromGridFS(fileId) {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    if (!bucket) {
      return reject(new Error('GridFS bucket not initialized'));
    }

    const ObjectId = mongoose.Types.ObjectId || mongoose.Schema.Types.ObjectId;
    bucket.delete(new ObjectId(fileId), (error) => {
      if (error) {
        reject(error);
      } else {
        resolve(true);
      }
    });
  });
}

// Get image metadata
export async function getImageMetadata(fileId) {
  return new Promise((resolve, reject) => {
    const bucket = getGridFSBucket();
    if (!bucket) {
      return reject(new Error('GridFS bucket not initialized'));
    }

    const ObjectId = mongoose.Types.ObjectId || mongoose.Schema.Types.ObjectId;
    const files = bucket.find({ _id: new ObjectId(fileId) });
    files.toArray((error, docs) => {
      if (error) {
        reject(error);
      } else if (docs.length === 0) {
        reject(new Error('Image not found'));
      } else {
        resolve(docs[0]);
      }
    });
  });
}

