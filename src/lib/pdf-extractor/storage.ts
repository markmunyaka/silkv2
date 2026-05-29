import { createClient } from '@supabase/supabase-js';

/**
 * Initialize a Supabase client for storage operations.
 * Uses environment variables SUPABASE_URL and SUPABASE_ANON_KEY (or SERVICE_ROLE_KEY).
 */
function getStorageClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Supabase storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment variables.'
    );
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Default bucket name for CSV exports.
 */
const DEFAULT_BUCKET = 'csv-exports';

/**
 * Ensures the storage bucket exists. Creates it if it doesn't.
 */
export async function ensureBucketExists(bucketName: string = DEFAULT_BUCKET): Promise<void> {
  const supabase = getStorageClient();

  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b: { name: string }) => b.name === bucketName);

  if (!bucketExists) {
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: false, // We'll generate signed URLs for access
      fileSizeLimit: 50 * 1024 * 1024, // 50 MB max file size
    });

    if (error) {
      throw new Error(`Failed to create storage bucket: ${error.message}`);
    }
  }
}

/**
 * Uploads a CSV buffer to Supabase Storage and returns a temporary public URL.
 * 
 * @param csvBuffer The CSV file buffer to upload
 * @param fileName The desired file name (e.g., "invoice-extract-2024-01-01.csv")
 * @param userId Optional user ID for folder isolation
 * @param bucketName Optional bucket name (defaults to 'csv-exports')
 * @param expiresIn URL expiration in seconds (defaults to 3600 = 1 hour)
 * @returns The temporary download URL
 */
export async function uploadCSVAndGetURL(
  csvBuffer: Buffer,
  fileName: string,
  userId?: string,
  bucketName: string = DEFAULT_BUCKET,
  expiresIn: number = 3600
): Promise<{ url: string; path: string }> {
  const supabase = getStorageClient();

  // Ensure the bucket exists
  await ensureBucketExists(bucketName);

  // Build the file path with optional user isolation
  const filePath = userId
    ? `${userId}/${fileName}`
    : `exports/${fileName}`;

  // Upload the CSV buffer
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(filePath, csvBuffer, {
      contentType: 'text/csv',
      upsert: true, // Overwrite existing files with the same name
    });

  if (uploadError) {
    throw new Error(`Failed to upload CSV: ${uploadError.message}`);
  }

  // Generate a signed URL for temporary access (no authentication required)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, expiresIn);

  if (signedUrlError || !signedUrlData) {
    throw new Error(`Failed to generate download URL: ${signedUrlError?.message || 'Unknown error'}`);
  }

  return {
    url: signedUrlData.signedUrl,
    path: filePath,
  };
}

/**
 * Deletes previously exported CSV files for cleanup.
 */
export async function deleteExportFile(
  filePath: string,
  bucketName: string = DEFAULT_BUCKET
): Promise<void> {
  const supabase = getStorageClient();

  const { error } = await supabase.storage
    .from(bucketName)
    .remove([filePath]);

  if (error) {
    console.error(`Failed to delete file ${filePath}:`, error.message);
  }
}

/**
 * Lists all CSV exports for a given user.
 */
export async function listUserExports(
  userId: string,
  bucketName: string = DEFAULT_BUCKET
): Promise<{ name: string; created: string; size: number }[]> {
  const supabase = getStorageClient();

  const { data, error } = await supabase.storage
    .from(bucketName)
    .list(userId);

  if (error) {
    throw new Error(`Failed to list exports: ${error.message}`);
  }

  return (data || []).map((file) => ({
    name: file.name,
    created: file.created_at || '',
    size: (file.metadata as { size?: number } | null)?.size || 0,
  }));
}