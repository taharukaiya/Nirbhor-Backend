# Nirbhor Backend Architecture & API Documentation

> **Nirbhor** is a robust, secure, and scalable backend infrastructure built with Express.js and MongoDB. It handles authentication, role-based access control, real-time messaging, secure payment processing via SSLCommerz, and comprehensive administrative oversight.

## 🏗️ Architectural Overview

The backend follows a standard monolithic Node.js/Express MVC-inspired architecture, emphasizing separation of concerns, secure data handling, and optimized database queries.

### Tech Stack
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (via Mongoose ORM)
- **Real-Time Communication:** Socket.io
- **Authentication:** JWT (JSON Web Tokens) with Access/Refresh rotation & Google OAuth.
- **Payment Gateway:** SSLCommerz (LTS)
- **Security:** Helmet, Express Rate Limit, bcryptjs, CORS
- **Email Delivery:** Nodemailer

### Directory Structure
```text
Backend/
├── src/
│   ├── config/        # Database connection & env validation
│   ├── controllers/   # Request handling & business logic execution
│   ├── middleware/    # Auth guards, validation, rate limiters, error handling
│   ├── models/        # Mongoose schemas & data constraints
│   ├── routes/        # API endpoint definitions (express.Router)
│   ├── scripts/       # DB seeding & maintenance scripts
│   ├── services/      # External integrations (Payments, NID verification)
│   ├── sockets/       # Socket.io event handlers (Chat, Notifications)
│   └── utils/         # Helper functions (mailer, tokens, file storage)
├── uploads/           # Local storage for user-uploaded media
├── .env.example       # Template for environment variables
└── server.js          # Application entry point
```

---

## ⚙️ Setup & Environment Configuration

### Prerequisites
- Node.js (v18+)
- MongoDB (v6+ running locally or MongoDB Atlas)

### Step 1: Installation
Navigate to the `Backend` directory and install dependencies:
```bash
cd Backend
npm install
```

### Step 2: Environment Variables
Create a `.env` file in the `Backend` root by duplicating `.env.example`.

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Defines execution environment | `development` or `production` |
| `PORT` | The port the Express server binds to | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://127.0.0.1:27017/nirbhor` |
| `FRONTEND_ORIGIN(S)` | Allowed CORS origins | `http://localhost:5173` |
| `*_TOKEN_SECRET` | Cryptographic secrets for JWT signing | *Must be strong random strings* |
| `GOOGLE_CLIENT_*` | OAuth 2.0 Credentials | *From Google Cloud Console* |
| `SSLCOMMERZ_*` | Payment Gateway Credentials | `STORE_ID`, `STORE_PASSWORD` |
| `SMTP_*` | Nodemailer config for emails | *SMTP host, port, user, pass* |

### Step 3: Run the Server
```bash
# Development mode (auto-restarts on changes)
npm run dev

# Production mode
npm start
```

---

## 📡 Exhaustive API Reference

### 🔐 Authentication (`/api/auth`)
Handles user lifecycle, JWT issuance, and OAuth.
- `POST /register` - Register a new User/Provider.
- `POST /login` - Issue Access & Refresh tokens.
- `POST /refresh` - Cycle access token using a valid refresh token.
- `POST /logout` - Invalidate tokens & clear cookies.
- `POST /google` - Google OAuth authentication flow.

### 👤 Users (`/api/users` & `/api/providers` & `/api/hirers`)
- `GET /me` - Retrieve authenticated user profile.
- `PUT /me` - Update profile information.
- `GET /providers` - List active service providers (supports filters).
- `GET /hirers/:id` - Fetch public profile of a job poster.

### 🛠️ Jobs (`/api/jobs`)
- `POST /` - Post a new job (Hirer only).
- `GET /` - List available jobs (Supports location/category filtering).
- `GET /:id` - Retrieve job details including proposals.
- `PUT /:id/status` - Update job status (e.g., in-progress, completed).

### 📝 Proposals (`/api/proposals`)
- `POST /` - Submit a proposal/bid for a job (Provider only).
- `GET /job/:jobId` - List all proposals for a specific job.
- `PUT /:id/accept` - Accept a proposal (Hirer only, triggers Escrow).

### 💳 Wallet & Payments (`/api/wallet` & `/api/payments`)
- `GET /wallet/balance` - Retrieve user's current balance and history.
- `POST /payments/initiate` - Start an SSLCommerz deposit session.
- `POST /payments/ipn` - **[Webhook]** SSLCommerz IPN callback endpoint.
- `POST /payments/success/fail/cancel` - Payment redirection routes.
- `POST /wallet/withdraw` - Request a withdrawal of cleared funds.

### 💬 Real-Time Chat (`/api/chat`)
- `GET /` - List user's active chat conversations.
- `GET /:jobId/messages` - Retrieve message history for a job.
*Note: Message delivery is handled in real-time via `Socket.io` (`/src/sockets/chatSocket.js`).*

### 🛡️ Admin Oversight (`/api/admin`)
- `GET /users` - List all users with pagination.
- `PUT /users/:id/ban` - Suspend a user account.
- `GET /jobs` - System-wide job monitoring.
- `GET /disputes` - Manage escalated job disputes.
- `GET /audit-logs` - System-wide immutable action audit trail.

---

## 🔄 Integration Lifecycles

### 1. SSLCommerz Payment Flow
1. **Initiation**: User requests deposit. Backend generates a unique transaction ID (`trx_id`), saves a `WalletDeposit` record as `PENDING`, and calls the SSLCommerz initialization API.
2. **Redirection**: Backend returns the `GatewayPageURL` to the frontend, which redirects the user.
3. **IPN Callback (Async)**: SSLCommerz pings the `/payments/ipn` route with payment status.
4. **Fulfillment**: If `VALID` or `VALIDATED`, the backend verifies cryptographic signatures, updates the deposit status to `SUCCESS`, and credits the user's digital wallet.

### 2. Job Completion & Commission Pipeline
1. Hirer accepts a proposal. Funds are deducted from their wallet and moved to `EscrowPayment`.
2. Job is completed and confirmed by the hirer.
3. The backend calculates the **Platform Commission (5%)**.
4. The remaining 95% is credited to the Provider's wallet.
5. System-wide ledger (`Transaction`) entries are created for the deduction, the escrow release, and the commission capture.

### 3. Real-Time Chat Architecture
1. Client connects via Socket.io using their JWT access token for authentication.
2. Users join isolated rooms based on `jobId`.
3. Messages emitted to the room are broadcasted to active participants and simultaneously persisted to MongoDB (`JobChat` schema).
4. Offline users receive notifications via the `Notification` schema, which can be retrieved via REST or pushed upon next connection.
