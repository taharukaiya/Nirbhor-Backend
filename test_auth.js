import http from "http";

async function run() {
  // 1. Register a user
  const registerRes = await fetch("http://localhost:5001/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Hirer",
      email: "test.hirer2@example.com",
      password: "password123",
      phone: "01700000000",
      role: "HIRER",
      nidNumber: "1234567890",
      dateOfBirth: "1990-01-01"
    })
  });
  const regData = await registerRes.json();
  console.log("Register:", regData);

  // 2. Login
  const loginRes = await fetch("http://localhost:5001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test.hirer2@example.com",
      password: "password123"
    })
  });
  
  const cookies = loginRes.headers.getSetCookie();
  console.log("Login Cookies:", cookies);

  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');

  // 3. Hit the applicants endpoint
  const appRes = await fetch("http://localhost:5001/api/hirer/jobs/12345/applicants", {
    headers: {
      "Cookie": cookieHeader
    }
  });

  console.log("Applicants Status:", appRes.status);
  console.log("Applicants Body:", await appRes.json());
}

run().catch(console.error);
