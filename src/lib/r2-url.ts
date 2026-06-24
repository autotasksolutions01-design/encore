export function getR2PublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    const normalized = publicUrl.replace(/\/+$/, "");
    return `${normalized}/${key}`;
  }
  const bucket = process.env.R2_BUCKET_NAME;
  const endpoint = process.env.R2_ENDPOINT;
  if (!bucket || !endpoint) return "";
  const host = new URL(endpoint).hostname;
  return `https://${bucket}.${host}/${key}`;
}
