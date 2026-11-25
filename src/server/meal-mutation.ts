import "server-only";
import { EXPECTED_MEAL_ACCOUNT_HEADER } from "@/shared/meal";
import { apiError } from "@/server/http-errors";
import { checkMutationOrigin } from "@/server/request-origin";

export function checkMealMutation(request: Request, sessionAccountId: string) {
  const originError = checkMutationOrigin(request);
  if (originError) return originError;

  const expectedAccount = request.headers.get(EXPECTED_MEAL_ACCOUNT_HEADER);
  if (expectedAccount !== null && expectedAccount !== sessionAccountId) {
    return apiError(409, "SESSION_ACCOUNT_CHANGED", "La cuenta de la sesión ha cambiado");
  }
}
