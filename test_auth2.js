import crypto from "node:crypto";
import jwt from "jsonwebtoken";

async function run() {
  const payload = { userId: "6aac08e7f6ff71335416791b", accountType: "USER" };
  const accessSecret = "8f4e2c9a8db2418ca790e6db69b1df089e09d1c92582be6c97a48d0859de7dfc";
  const token = jwt.sign(payload, accessSecret, { expiresIn: "15m" });

  const appRes = await fetch("http://localhost:5001/api/wallet/deposit", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount: 100 })
  });

  console.log("Deposit Status:", appRes.status);
  console.log("Deposit Body:", await appRes.json());
}

run().catch(console.error);
