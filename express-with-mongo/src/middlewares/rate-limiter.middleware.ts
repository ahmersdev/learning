import rateLimit from "express-rate-limit";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // 100 requests per IP per window
  standardHeaders: true, // adds RateLimit-* headers so clients can see their limit status
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many requests, please try again later",
  },
});

// Stricter limiter specifically for auth routes — brute-force login protection
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5, // only 5 attempts per 15 min — this is what actually stops password-guessing attacks
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: "error",
    message: "Too many login attempts, please try again later",
  },
});
