import { billingErrorResponse, handleBillingWebhook } from "@/lib/billing";

export async function POST(request: Request) {
  try {
    return Response.json(await handleBillingWebhook(request));
  } catch (error) {
    return billingErrorResponse(error);
  }
}
