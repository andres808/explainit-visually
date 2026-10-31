import { handleLearningRequest } from "@/lib/learning/http";
export function POST(request: Request) {
  return handleLearningRequest(request, "learn");
}
