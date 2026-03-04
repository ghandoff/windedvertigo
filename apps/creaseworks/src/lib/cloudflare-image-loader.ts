/**
 * Custom image loader for next/image.
 *
 * All creaseworks images live in Cloudflare R2 and are served through
 * Cloudflare CDN (cdn.creaseworks.co). This loader passes the URL
 * through unchanged, so we get next/image benefits (lazy loading,
 * layout-shift prevention, srcset) without consuming Vercel's
 * Image Optimization transform quota (5 000/mo on Hobby).
 *
 * When Cloudflare Image Resizing is needed later, this loader is
 * the hook point for adding width/quality transforms.
 */
export default function cloudflareImageLoader({
  src,
}: {
  src: string;
  width: number;
  quality?: number;
}) {
  return src;
}
