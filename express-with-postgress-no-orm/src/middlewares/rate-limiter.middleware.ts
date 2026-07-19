import rateLimit from "express-rate-limit";

const skipInTest = () => process.env.NODE_ENV === "test";

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // 100 requests per IP per window
  standardHeaders: true, // adds RateLimit-* headers so clients can see their limit status
  legacyHeaders: false,
  skip: skipInTest,
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
  skip: skipInTest,
  message: {
    status: "error",
    message: "Too many auth attempts, please try again later",
  },
});

// Looser limiter for token refresh — legitimate clients call this often
// (multiple tabs/devices, token expiry every 15m), so it shouldn't share
// the strict brute-force limit meant for password guessing
export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    status: "error",
    message: "Too many refresh attempts, please try again later",
  },
});
