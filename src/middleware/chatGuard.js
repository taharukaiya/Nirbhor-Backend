/**
 * Chat Guard Middleware
 * 
 * Architectural Intent:
 * An alias for the Trust & Safety contact filter. Applied to chat routes 
 * to intercept payloads attempting to share phone numbers or emails.
 */
import { rejectContactInfo } from "../utils/contactFilter.js";

export const chatGuard = rejectContactInfo;
