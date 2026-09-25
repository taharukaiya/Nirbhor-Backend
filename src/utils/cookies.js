/**
 * Cookie Management Utility
 * 
 * Architectural Intent:
 * Abstracts the `express` Response cookie API to ensure consistent application 
 * of `COOKIE_OPTIONS` (HttpOnly, Secure, SameSite) across all authentication routes.
 * 
 * Logic:
 * Splits User cookies from Admin cookies to allow a developer/admin to be logged in 
 * to both the public portal and the admin dashboard simultaneously in the same browser.
 */
import { COOKIE_OPTIONS } from "./tokens.js";

export function setUserCookies(response, accessToken, refreshToken) {
  response.cookie("access_token", accessToken, COOKIE_OPTIONS);
  response.cookie("refresh_token", refreshToken, COOKIE_OPTIONS);
}

export function setAdminCookies(response, accessToken, refreshToken) {
  response.cookie("admin_access_token", accessToken, COOKIE_OPTIONS);
  response.cookie("admin_refresh_token", refreshToken, COOKIE_OPTIONS);
}

export function clearUserCookies(response) {
  response.clearCookie("access_token", COOKIE_OPTIONS);
  response.clearCookie("refresh_token", COOKIE_OPTIONS);
}

export function clearAdminCookies(response) {
  response.clearCookie("admin_access_token", COOKIE_OPTIONS);
  response.clearCookie("admin_refresh_token", COOKIE_OPTIONS);
}
