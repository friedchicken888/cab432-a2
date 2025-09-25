const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const s3Service = {
  /**
   * Uploads a file buffer to S3.
   * @param {Buffer} fileBuffer - The buffer of the file to upload.
   * @param {string} contentType - The content type of the file (e.g., 'image/png').
   * @param {string} folder - The folder within the S3 bucket (e.g., 'fractals').
   * @returns {Promise<string>} The S3 object key of the uploaded file.
   */
  async uploadFile(fileBuffer, contentType, folder = 'fractals') {
    const key = `${folder}/${uuidv4()}.png`; // Assuming PNG for fractals
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'private', // Ensure private access, only accessible via pre-signed URLs
    };

    try {
      const command = new PutObjectCommand(params);
      await s3Client.send(command);
      console.log(`File uploaded successfully: ${key}`);
      return key;
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error('Failed to upload file to S3.');
    }
  },

  /**
   * Generates a pre-signed URL for a given S3 object key.
   * @param {string} key - The S3 object key.
   * @param {number} expiresSeconds - The expiration time in seconds for the URL.
   * @returns {Promise<string>} The pre-signed URL.
   */
  async getPresignedUrl(key, expiresSeconds = 300) { // Default 5 minutes
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    try {
      const url = await getSignedUrl(s3Client, command, { expiresIn: expiresSeconds });
      return url;
    } catch (error) {
      console.error('Error generating pre-signed URL:', error);
      throw new Error('Failed to generate pre-signed URL.');
    }
  },

  /**
   * Deletes an object from S3.
   * @param {string} key - The S3 object key to delete.
   */
  async deleteFile(key) {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    try {
      const command = new DeleteObjectCommand(params);
      await s3Client.send(command);
      console.log(`File deleted successfully: ${key}`);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error('Failed to delete file from S3.');
    }
  },
};

module.exports = s3Service;