import { isAuthenticated, jsonResponse } from "../../lib/auth.js";

export async function onRequestGet({ request, env }) {
  const configured = Boolean(env?.APP_PASSWORD);
  const dbBound = Boolean(env?.DB);
  const authenticated = configured ? await isAuthenticated(request, env) : false;
  return jsonResponse({ authenticated, configured, dbBound });
}
