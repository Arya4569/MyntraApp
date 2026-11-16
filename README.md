# Myntra Clone - React Native & Node.js E-Commerce Platform

[![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_57-blue.svg)](https://reactnative.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express_4.21-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A production-grade, full-stack e-commerce shopping application modeled after Myntra, built with **React Native (Expo SDK 57)** for universal cross-platform rendering (iOS, Android, and Web) and a **Node.js / Express.js REST API**.

---

## 🌟 Key Features & Assigned Internship Modules

### 1. Recently Viewed & Product Activity Tracking
- **Cross-Session Tracking:** Tracks viewed items for both guest and authenticated users.
- **FIFO 20-Product Capacity:** Automatically caps history to 20 unique products, jumping re-viewed products to index 0.
- **Seamless Merge on Login:** Unauthenticated guest browsing history merges cleanly into server-side user history without duplicates.
- **"Continue Shopping" Section:** Displays viewed products that have not yet been purchased, featuring quick 1-tap "Add to Bag" and "Wishlist" actions.

### 2. Dynamic Theme & Personalization System
- **Centralized Design System:** Strict tokens for Light and Dark modes (`myntra-theme.ts`) with zero hardcoded values.
- **System Theme Auto-Detection:** Automatically matches OS appearance on initial launch.
- **Multi-Device Synchronization:** User theme preferences persist locally via `AsyncStorage` and synchronize with the backend (`/api/auth/preferences`) across all logged-in devices.

### 3. Real-Time Push Notification System
- **Expo Notifications:** Real-time push delivery for Order Confirmations, Payment Success, Shipping Updates, Wishlist Price Drops, and Back-in-Stock alerts.
- **Token Lifecycle:** Automatically tracks and purges invalid or expired device tokens.
- **Granular Preference Management:** In-app toggles allowing users to enable or disable specific notification categories.
- **Auditable Logging:** Persistent storage of dispatched notifications with delivery tracking.

### 4. Order & Transaction Management System
- **Server-Side Pagination & Filtering:** Filter orders by status (`Placed`, `Confirmed`, `Shipped`, `Out for Delivery`, `Delivered`, `Cancelled`), date range, and payment method.
- **Automated Branded PDF Invoices:** Server-side tax invoice generation using PDFKit, downloadable directly from the order details modal.
- **1-Click Reorder:** Instantly repopulates the active shopping bag with items from previous orders.
- **Self-Service Cancellations & Returns:** Interactive cancellation and return submission with predefined reason categories.

### 5. Smart Shopping Cart with Save for Later
- **Dual List Architecture:** Independent Active Cart and Save for Later sections.
- **Variant Integrity:** Moving items between cart and saved collections preserves selected size, color, and quantity.
- **Pre-Checkout Integrity:** Live validation checks stock availability and price discrepancies prior to payment, preventing checkout errors.
- **Atomic Multi-Device Updates:** Prevents duplicate items or corrupt quantities during simultaneous multi-device actions.

### 6. Personalized "You May Also Like" Recommendation Engine
- **Multi-Factor Scoring Engine:** Ranks catalogue items using browsing categories (+3), active wishlist items (+5), previous order categories (+4), and platform trending metrics (+2).
- **Dynamic Suppression:** Filters out items currently in the cart, out-of-stock items, and recently purchased products.
- **Cold-Start Fallback:** Automatically presents top-rated trending items to new or unauthenticated users.

---

## 🛠️ Tech Stack

- **Frontend:** React Native (v0.86), Expo SDK 57, Expo Router 57, React Native Web, TypeScript.
- **Backend:** Node.js, Express.js 4.21, JWT (jsonwebtoken), bcryptjs.
- **PDF Generation:** PDFKit.
- **Payment Verification:** Razorpay SDK with HMAC-SHA256 signature verification.
- **State Management & Persistence:** React Context API, `@react-native-async-storage/async-storage`.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/myntra.git
cd myntra
```

### 2. Backend Setup
```bash
cd server
npm install
node src/server.js
```
The server will start on `http://localhost:5000`. Health check endpoint: `http://localhost:5000/api/health`.

### 3. Frontend Web / Mobile Setup
```bash
cd ../MyntraApp
npm install

# Start development server
npx expo start

# Or run specifically for Web
npx expo start --web
```

---

## 🌐 Deployment

### Frontend Web (Netlify / Vercel)
1. Build the production static web export:
   ```bash
   npx expo export -p web
   ```
2. The export is created in `MyntraApp/dist`.
3. Drag and drop the `dist` folder to [Netlify Drop](https://app.netlify.com/drop) or deploy via Vercel CLI.

### Backend API (Render)
Use the included `render.yaml` configuration to deploy the `server/` directory as a Node Web Service.

---

## 🧪 Testing

Run backend automated test suites:
```bash
cd server
node test-auth.js
node test-orders.js
node test-cart.js
node test-notifications.js
node test-recommendations.js
```

---

## 👤 Author
**Arya Karande**  
- Email: aryakarande45@gmail.com  
- Internship Program: ElevanceSkills

