import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const bucketName = process.env.AWS_S3_BUCKET || 'your-bucket-name';

export async function uploadToStorage(audioBlob: Blob, userId: string): Promise<string> {
  const key = `summaries/${userId}/${uuidv4()}.mp3`;

  try {
    const buffer = Buffer.from(await audioBlob.arrayBuffer());
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: 'audio/mpeg',
    });

    await s3Client.send(command);
    return `https://${bucketName}.s3.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Storage upload failed:', error);
    throw new Error('Failed to store audio summary');
  }
}