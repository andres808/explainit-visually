import {
  handleLearningRequest,
  learningErrorResponse,
} from "@/lib/learning/http";
import { readAsset } from "@/lib/learning/storage";
import { LearningError } from "@/lib/learning/errors";
export function POST(request: Request) {
  return handleLearningRequest(request, "visualize");
}
export async function GET(request: Request) {
  try {
    const asset = new URL(request.url).searchParams.get("asset");
    if (!asset)
      throw new LearningError(
        "ASSET_REQUIRED",
        "Choose a saved illustration.",
        400,
      );
    const { bytes, mime } = await readAsset(asset);
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
      },
    });
  } catch (error) {
    return learningErrorResponse(error);
  }
}
