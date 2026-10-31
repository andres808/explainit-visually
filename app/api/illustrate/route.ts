import { handleIllustrationRequest } from "@/lib/learning/illustrate";
export function POST(request: Request) {
  return handleIllustrationRequest(request);
}
