import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

/**
 * Minimal Cloudflare R2 client over the S3-compatible API.
 *
 * Connection settings are read from env vars (`R2_ENDPOINT_URL`,
 * `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`) when the
 * instance is constructed. Upload failures propagate to the caller.
 */
export class R2 {
  private readonly client: S3Client

  constructor() {
    this.client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT_URL,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  }

  /**
   * Upload an object to the configured bucket.
   *
   * @param key         - The object key (e.g. `thumbnails/{id}.png`).
   * @param body        - The object bytes.
   * @param contentType - The MIME type (e.g. `image/png`).
   */
  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    )
  }

  /**
   * Fetch an object from the configured bucket.
   *
   * @param key - The object key (e.g. `thumbnails/{id}.png`).
   * @returns The object bytes, or null when no object exists at the key.
   */
  async get(key: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
        }),
      )
      if (!res.Body) return null
      const chunks: Buffer[] = []
      for await (const chunk of res.Body as AsyncIterable<Buffer>) chunks.push(chunk)
      return Buffer.concat(chunks)
    } catch (e) {
      if (e instanceof Error && e.name === "NoSuchKey") return null
      throw e
    }
  }

  /**
   * Delete an object from the configured bucket.
   *
   * @param key - The object key (e.g. `thumbnails/{id}.png`).
   */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
      }),
    )
  }
}
