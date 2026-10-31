# RaltONDC - ONDC Logistics Service Provider (LSP) & Rider Fleet Platform

A dedicated, standalone solution for **RALT** operating as an **ONDC Logistics Service Provider (BPP)** in the **`P2P - ONDC:LOG10`** domain (Point-to-Point Hyperlocal Food & Retail Delivery).

---

## 📁 Project Architecture

```
d:\RALT\RaltONDC\
├── backend/                  # ONDC Logistics Engine & Dispatch Server (Node.js + TypeScript)
│   ├── src/
│   │   ├── config.ts         # Loads ONDC credentials (ralt.in, UKID, Ed25519 keys)
│   │   ├── crypto/auth.ts    # ONDC Ed25519 digital signature creation & verification
│   │   ├── controllers/
│   │   │   ├── ondcController.ts   # /search, /init, /confirm, /status, /track, /cancel
│   │   │   └── riderController.ts  # Rider APIs (status, location, OTP verification)
│   │   ├── services/
│   │   │   ├── ondcClient.ts       # Outgoing Beckn callbacks (on_search, on_confirm, etc.)
│   │   │   ├── orderManager.ts     # Order lifecycle & 4-digit customer delivery OTP
│   │   │   └── riderManager.ts     # Real-time fleet tracking & WebSocket dispatch
│   │   ├── public/index.html       # Web dashboard for monitoring live ONDC deliveries
│   │   └── server.ts
│   ├── .env                  # Your official ONDC preprod keys & subscriber ID
│   ├── Dockerfile
│   └── package.json
│
├── mobile-app/               # Delivery Partner Mobile App (React Native / Expo)
│   ├── App.tsx               # Full-featured Rider App (Deliveries, Live Task, OTP, Earnings)
│   ├── app.json
│   └── package.json
│
└── docker-compose.yml        # Docker configuration for production deployment
```

---

## 🚀 Quick Start Guide

### 1. Start the ONDC Backend & Dashboard

Open your terminal:

```bash
cd d:\RALT\RaltONDC\backend
npm start
```

* Backend runs at: `http://localhost:5000`
* **Live ONDC Dashboard:** Open `http://localhost:5000` in your browser to view active deliveries, rider statuses, and trigger test orders.

---

### 2. Start the Rider Mobile App

In a second terminal window:

```bash
cd d:\RALT\RaltONDC\mobile-app
npm install
npm run web    # Runs instantly in your browser!
```

*(You can also run `npx expo start` and scan the QR code using the **Expo Go** app on your Android or iPhone).*

#### Rider App Features:
1. **Online / Offline Switch:** Control rider availability.
2. **Deliveries Tab:** See incoming ONDC food delivery assignments (₹50 payout tag, pickup restaurant, customer drop).
3. **Live Task Tab:** Step-by-step delivery workflow:
   * *I Have Reached Restaurant*
   * *Confirm Order Picked Up*
   * *Start Journey to Customer*
   * *Verify 4-Digit Customer OTP & Complete Delivery*
4. **Earnings Tab:** Track today's ₹50 per delivery settlements.
5. **+ Test ONDC Order Button:** Tap to simulate an immediate Biryani delivery and test the rider flow on your screen!

---

## 🌐 Connecting to the ONDC Workbench

1. **Expose your server to the internet:**
   Because ONDC sends callbacks to your webhook URL (`https://ralt.in/ondc`):
   ```bash
   ngrok http 5000
   ```
2. **In the ONDC Portal:**
   * Go to **Task 2.b** and click **Go to Workbench**.
   * Run the test suite: the Workbench will send a simulated delivery request to your backend.
   * Your backend will quote ₹50, assign the order to your Rider App, and stream real-time updates back to ONDC!

