import "dotenv/config";

const required = [
  "MONGO_URI",
  "ACCESS_TOKEN_SECRET",
  "REFRESH_TOKEN_SECRET",
  "EMAIL_TOKEN_SECRET",
];
for (const name of required) {
  if (
    (!process.env[name] || process.env[name].startsWith("replace-with-")) &&
    process.env.NODE_ENV !== "test"
  ) {
    throw new Error(`${name} is required in production`);
  }
}

const frontendOrigins = (
  process.env.FRONTEND_ORIGINS ||
  process.env.FRONTEND_ORIGIN ||
  "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/nirbhor",
  frontendOrigin: frontendOrigins[0],
  frontendOrigins,
  accessSecret: process.env.ACCESS_TOKEN_SECRET,
  refreshSecret: process.env.REFRESH_TOKEN_SECRET,
  emailSecret: process.env.EMAIL_TOKEN_SECRET,
  isProduction: process.env.NODE_ENV === "production",
  apiPublicUrl: process.env.API_PUBLIC_URL || "http://localhost:5000",
};

export function isAllowedOrigin(origin) {
  return !origin || config.frontendOrigins.includes(origin);
}
