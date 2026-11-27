import { listGecaResultSessions, findGecaEnrollmentResults, discoverGecaEnrollmentCandidates } from "./gecaResultParser";

type WorkerRequest =
  | { id: number; type: "sessions" }
  | { id: number; type: "match"; resultId: string; enrollment: string; semester?: number }
  | { id: number; type: "discover"; input: Parameters<typeof discoverGecaEnrollmentCandidates>[0] };

self.addEventListener("message", async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    let result: unknown;
    if (request.type === "sessions") result = await listGecaResultSessions();
    else if (request.type === "match") result = await findGecaEnrollmentResults(request.resultId, request.enrollment, request.semester);
    else result = await discoverGecaEnrollmentCandidates(request.input);
    (self as unknown as { postMessage(message: unknown): void }).postMessage({ id: request.id, success: true, result });
  } catch (error) {
    (self as unknown as { postMessage(message: unknown): void }).postMessage({
      id: request.id,
      success: false,
      error: error instanceof Error ? error.message : "GECA document processing failed."
    });
  }
});

export {};
