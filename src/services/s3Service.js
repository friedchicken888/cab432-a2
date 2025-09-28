const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, CreateBucketCommand, PutBucketTaggingCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
const { getAwsRegion } = require("../services/secretManagerService");

dotenv.config();

let s3ClientInstance = null;

async function getS3Client() {
  if (s3ClientInstance) {
    return s3ClientInstance;
  }
  const region = await getAwsRegion();
  s3ClientInstance = new S3Client({
    region: region,
  });
  return s3ClientInstance;
}


const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const QUT_USERNAME = process.env.S3_TAG_QUT_USERNAME;
const PURPOSE = process.env.S3_TAG_PURPOSE;

const s3Service = {
  async ensureBucketAndTags() {
    if (!BUCKET_NAME) {
      console.error('S3_BUCKET_NAME is not defined in .env');
      throw new Error('S3_BUCKET_NAME is not defined.');
    }

    try {
      const s3Client = await getS3Client();
      // Check if bucket exists
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    } catch (error) {
      if (error.name === 'NotFound' || error.name === 'NoSuchBucket') {
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        } catch (createError) {
          console.error(`Error creating S3 Bucket '${BUCKET_NAME}':`, createError);
          throw new Error(`Failed to create S3 Bucket '${BUCKET_NAME}'.`);
        }
      } else {
        console.error(`Error checking S3 Bucket '${BUCKET_NAME}':`, error);
        throw new Error(`Failed to check S3 Bucket '${BUCKET_NAME}'.`);
      }
    }

    // Apply tags
    if (QUT_USERNAME && PURPOSE) {
      try {
        await s3Client.send(new PutBucketTaggingCommand({
          Bucket: BUCKET_NAME,
          Tagging: {
            TagSet: [
              { Key: 'qut-username', Value: QUT_USERNAME },
              { Key: 'purpose', Value: PURPOSE },
            ],
          },
        }));
      } catch (tagError) {
        console.error(`Error tagging S3 Bucket '${BUCKET_NAME}':`, tagError);
      }
    } else {
      console.warn('S3_TAG_QUT_USERNAME or S3_TAG_PURPOSE not defined. S3 bucket will not be tagged programmatically.');
    }
  },

  /**
   * Uploads a file buffer to S3.
   * @param {Buffer} fileBuffer - The buffer of the file to upload.
   * @param {string} contentType - The content type of the file (e.g., 'image/png').
   * @param {string} folder - The folder within the S3 bucket (e.g., 'fractals').
   * @returns {Promise<string>} The S3 object key of the uploaded file.
   */
  async uploadFile(fileBuffer, contentType, folder = 'fractals') {
    const key = `${folder}/${uuidv4()}.png`;
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ACL: 'private',
    };

          try {
          const s3Client = await getS3Client();
          const command = new PutObjectCommand(params);
          await s3Client.send(command);
          return key;    } catch (error) {
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
  async getPresignedUrl(key, expiresSeconds = 300) {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    try {
      const s3Client = await getS3Client();
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
      const s3Client = await getS3Client();
      const command = new DeleteObjectCommand(params);
      await s3Client.send(command);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      throw new Error('Failed to delete file from S3.');
    }
  },
};

module.exports = s3Service;