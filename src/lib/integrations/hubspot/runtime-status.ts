import { HubSpotApiError } from "./client";

export type HubSpotRunFailureStatus = "partial" | "failed";

export function hubSpotRunFailureStatus(error: unknown): HubSpotRunFailureStatus {
  if (error instanceof HubSpotApiError && (error.status === 401 || error.status === 403)) {
    return "failed";
  }
  return "partial";
}
