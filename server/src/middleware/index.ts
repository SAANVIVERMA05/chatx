/**
 * Middleware barrel export.
 * Import all middleware from this single entry point.
 *
 * Usage:
 *   import { authenticate, AuthRequest } from "../middleware";
 */

export { authenticate } from "./authenticate";
export type { AuthRequest } from "./authenticate";
