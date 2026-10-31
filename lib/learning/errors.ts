export class LearningError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 500,
  ) {
    super(message);
  }
}

export function abortIfNeeded(signal?: AbortSignal) {
  if (signal?.aborted)
    throw new LearningError("CANCELLED", "This request was cancelled.", 499);
}
