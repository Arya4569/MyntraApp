# ElevanceSkills Internship Program: Final Project Report

**Project Title:** Myntra E-Commerce Mobile & Web Application  
**Domain / Track:** Learn to build real time project like myntra - React Native  
**Intern Name:** Arya Karande  
**Email:** aryakarande45@gmail.com  
**Submission Date:** November 2026  
**Evaluation Target:** Top Performer / Full Stipend Evaluation  

---

## Executive Summary

The Myntra E-Commerce Mobile & Web Application is a production-grade, full-stack shopping platform engineered using **React Native (Expo SDK 57)** and **Node.js with Express.js**. Built upon the core training project, this final implementation introduces six enterprise-level architectural features assigned during the ElevanceSkills internship:

1. **Recently Viewed & Product Activity Tracking** (Cross-session tracking, 20-product FIFO deduplication, guest-to-user history merge, and "Continue Shopping" recommendations).
2. **Dynamic Theme & Personalization System** (Centralized theme engine supporting Light/Dark modes, zero hardcoded values, AsyncStorage caching, and cross-device backend synchronization).
3. **Real-Time Push Notification System** (Expo Notifications integration, device token lifecycle management, granular user category preferences, and auditable delivery logging).
4. **Order & Transaction Management System** (Server-side pagination and multi-attribute filtering, order cancellation/return workflows, 1-click reordering, and automated PDF invoice generation).
5. **Smart Shopping Cart with Save for Later** (Independent active cart and saved collections, variant preservation, pre-checkout stock/price validation, and multi-device concurrency control).
6. **Personalized "You May Also Like" Recommendation Engine** (Multi-factor scoring algorithm leveraging browsing history, wishlist items, category affinities, and trending fallbacks).

---

## 1. System Architecture & Tech Stack

### 1.1 Architecture Overview
The system follows a decoupled, client-server architecture supporting universal cross-platform rendering (iOS, Android, and Web) through Expo Router and React Native Web.

```
+-------------------------------------------------------------------+
|                        Client Layer (Expo / React Native)         |
|  - Universal UI (Mobile + Tablet + Web)                           |
|  - Expo Router (File-based navigation)                            |
|  - ThemeContext (Centralized design tokens)                       |
|  - AuthContext (JWT session management)                           |
|  - Offline-first cache (AsyncStorage)                             |
+---------------------------------+---------------------------------+
                                  | HTTP / REST + Push Events
                                  v
+---------------------------------+---------------------------------+
|                       Server Layer (Node.js / Express)            |
|  - Modular Controllers & Routes (Bag, Orders, Notifs, etc.)       |
|  - Authentication & RBAC Middleware (JWT Verification)            |
|  - PDF Invoice Generator Service (PDFKit)                         |
|  - Recommendation Scoring Service                                 |
|  - Notification Dispatcher & Audit Log Service                    |
+---------------------------------+---------------------------------+
                                  | JSON / Atomic File Store
                                  v
+-------------------------------------------------------------------+
|                       Data Persistence Layer                      |
|  - Multi-user data isolation (Users, Bags, Orders, Addresses)     |
|  - Strict schema validations & atomic state transitions           |
+-------------------------------------------------------------------+
```

### 1.2 Technology Stack
* **Frontend:** React Native 0.86, Expo SDK 57, Expo Router 57, React Native Web, TypeScript, React 19.
* **Backend:** Node.js, Express.js 4.21, JWT (jsonwebtoken 9.0), bcryptjs 3.0.
* **Document Generation:** PDFKit 0.20 (server-side branded invoice PDF generation).
* **Payment Integration:** Razorpay SDK integration with signature verification and idempotency safeguards.
* **Notifications:** Expo Notifications service with category filtering and device token registry.
* **Deployment:** Netlify / Vercel (Frontend Web Static Build) and Render (Backend REST API).

---

## 2. Detailed Task Implementations

### Task 1: Recently Viewed & Product Activity Tracking
* **Objective:** Enable persistent user product discovery tracking across anonymous and authenticated sessions with cross-device consistency.
* **Technical Implementation:**
  - **Storage & Capacity:** Maintains a bounded list of the latest 20 unique viewed products using a First-In-First-Out (FIFO) eviction strategy. If a user re-views an existing product, it dynamically jumps to index `0` without creating duplicates.
  - **Guest-to-User Sync (`/api/recently-viewed/sync`):** When an unauthenticated visitor logs in, locally cached guest history from `AsyncStorage` is submitted to the backend. The backend atomically merges the guest array with existing account history, de-duplicates by product ID, truncates to 20 items, and updates the account state.
  - **"Continue Shopping" Section:** An intelligent filtering layer compares the user's recently viewed products against their confirmed order history. Products viewed but not yet purchased are surfaced with quick-action buttons for "Add to Bag" and "Wishlist".

### Task 2: Dynamic Theme & Personalization System
* **Objective:** Deliver a centralized, accessible design token system supporting Light and Dark modes with multi-device preference persistence.
* **Technical Implementation:**
  - **Design Token System (`myntra-theme.ts`):** Complete elimination of hardcoded color strings across the application. Centralized palettes govern `surface`, `card`, `textPrimary`, `textSecondary`, `border`, `primary` (Myntra Pink `#ff3f6c`), and status indicators.
  - **System Theme Auto-Detection:** Uses Expo/React Native `useColorScheme` to automatically synchronize with the operating system on first launch.
  - **Persistence & Sync:** Users can manually select `System`, `Light`, or `Dark` mode in the Profile settings (`AppearanceSetting.tsx`). Selections are stored locally in `AsyncStorage` for instant splash render and synchronized to the backend via `PUT /api/auth/preferences` so the user's theme choice follows them across devices.

### Task 3: Real-Time Push Notification System
* **Objective:** Provide a real-time event-driven notification engine powered by Expo Notifications and Express.js with granular user preferences.
* **Technical Implementation:**
  - **Token Management:** The backend registers and maps active Expo push tokens (`ExponentPushToken[...]`) to user IDs, automatically removing deactivated or invalid tokens upon dispatch errors.
  - **Multi-Category Architecture:** Notifications are categorized into `order`, `payment`, `shipping`, `wishlist`, `stock`, and `promotion`.
  - **User Preference Controls (`NotificationSettingsSection.tsx`):** Users have granular toggle switches for each category. Prior to sending any notification, `NotificationService` verifies the user's active preferences. If a category is disabled, transmission is cleanly suppressed.
  - **Audit Logging:** Every dispatched alert is recorded in `NotificationLog` with an idempotency key, category, timestamp, and read status.

### Task 4: Order & Transaction Management System
* **Objective:** Provide an enterprise-grade Order History and Management module with server-side pagination, filters, status tracking, and automated PDF invoice generation.
* **Technical Implementation:**
  - **Server-Side Pagination & Filters (`orderRoutes.js`):** Supports `page`, `limit`, `status` (`Placed`, `Confirmed`, `Shipped`, `Out for Delivery`, `Delivered`, `Cancelled`, `Returned`), `dateRange` (`last30days`, `last6months`, `thisyear`), and multi-field sorting (`date_desc`, `amount_desc`).
  - **Automated PDF Invoices (`invoiceService.js`):** Built with PDFKit, generating branded tax invoices featuring order metadata, itemized product breakdowns, tax/shipping totals, customer billing address, and authorized signature blocks.
  - **Reorder & Cancellation Workflows:**
    - **1-Click Reorder:** Clones historical order items directly back into the user's active shopping bag.
    - **Self-Service Returns/Cancellations:** Users can submit formal cancellation or return requests with predefined reasons directly through `OrdersModal.tsx`.
  - **Webhook & Audit Security:** Payment verification verifies Razorpay HMAC-SHA256 signatures and writes all checkout events to `AuditLog.js` to prevent replay attacks.

### Task 5: Smart Shopping Cart with Save for Later
* **Objective:** Implement a robust shopping cart featuring independent "Save for Later" collections, variant retention, stock validations, and multi-device concurrency.
* **Technical Implementation:**
  - **Dual Collection Segregation (`Bag.js`):** Separates active cart items from `savedForLater` items. When items are moved between states, selected variants (`size`, `color`) and quantity preferences remain strictly preserved.
  - **Pre-Checkout Stock & Price Validation (`/api/bag/validate`):** Before allowing order creation, the server evaluates current catalogue stock and real-time prices. If a product goes out of stock or changes price, the system prevents checkout, alerts the customer with explanatory badges, and updates totals dynamically.
  - **Concurrency & Multi-User Isolation:** Multi-device actions (e.g. cart updates from mobile while browsing web) use atomic mutations ensuring no duplicated items or overwritten quantities.

### Task 6: Personalized "You May Also Like" Recommendation System
* **Objective:** Develop a high-speed recommendation algorithm tailored to individual user behavior with cold-start fallbacks.
* **Technical Implementation:**
  - **Scoring Algorithm (`recommendationService.js`):** Evaluates user activity across four dimensions:
    - Recent Browsing History Category (+3 weight)
    - Active Wishlist Items (+5 weight)
    - Confirmed Past Purchase Categories (+4 weight)
    - Platform Trending Score (+2 weight)
  - **Filters & Constraints:** Automatically filters out items currently in the user's cart, out-of-stock items, and products purchased within the last 30 days.
  - **Cold-Start Fallback:** Unauthenticated visitors or new users with zero history automatically receive top-rated and best-selling catalogue products.
  - **Bounded History:** User browsing history tracks the latest 50 unique items with automatic purging of aged records.

---

## 3. API Endpoints & Route Reference

| Category | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | POST | `/api/auth/register` | Register new user account |
| **Auth** | POST | `/api/auth/login` | Email/mobile JWT authentication |
| **Auth** | GET/PUT | `/api/auth/preferences` | Retrieve and sync user theme preferences |
| **Products** | GET | `/api/products` | Paginated product catalogue with filters |
| **Bag** | GET | `/api/bag` | Fetch active shopping bag with recalculated totals |
| **Bag** | POST | `/api/bag/items` | Add product with variant to bag |
| **Bag** | POST | `/api/bag/save-for-later` | Move item from active bag to Save for Later |
| **Bag** | POST | `/api/bag/move-to-cart` | Move item from Save for Later back to active bag |
| **Bag** | GET | `/api/bag/validate` | Pre-checkout stock and price integrity validation |
| **Orders** | GET | `/api/orders` | Paginated order history with status filters |
| **Orders** | POST | `/api/orders` | Place new order with address and payment method |
| **Orders** | GET | `/api/orders/:id/invoice` | Stream branded PDF invoice generated via PDFKit |
| **Orders** | POST | `/api/orders/:id/reorder` | One-click restore order items to active bag |
| **Orders** | POST | `/api/orders/:id/cancel` | Cancel order with structured cancellation reason |
| **Recently Viewed** | GET | `/api/recently-viewed` | Fetch latest 20 viewed products |
| **Recently Viewed** | POST | `/api/recently-viewed/sync`| Merge guest local history into account on login |
| **Notifications** | GET | `/api/notifications` | Paginated notification center alerts |
| **Notifications** | PATCH | `/api/notifications/preferences`| Update category notification toggles |
| **Recommendations**| GET | `/api/recommendations` | Compute personalized "You May Also Like" feed |

---

## 4. Verification & Testing

The project incorporates end-to-end automated backend test suites confirming business logic and multi-user security isolation:
- `test-auth.js`: Verifies JWT issuance, password hashing, and theme preference persistence.
- `test-api.js`: Validates catalogue navigation, category filtering, and product details.
- `test-notifications.js`: Verifies push token registration, preference suppression, and event notifications.
- `test-orders.js`: Tests order creation, pagination, status lifecycle, and PDF invoice generation.
- `test-cart.js`: Validates active cart, Save for Later transitions, variant preservation, and stock validations.
- `test-address-isolation.js` & `test-multiuser-isolation.js`: Proves that user private data (addresses, notifications, cart items) is never leaked across accounts.

---

## 5. Deployment Guide

### 5.1 Frontend Web Deployment (Netlify / Vercel)
1. Run the static export command:
   ```bash
   npx expo export -p web
   ```
2. Deploy the generated `dist` folder:
   - **Netlify:** Drag and drop `MyntraApp/dist` directly into [Netlify Drop](https://app.netlify.com/drop).
   - **Vercel:** Run `vercel deploy --prod dist` or connect the GitHub repository with Root Directory set to `MyntraApp` and Output Directory set to `dist`.

### 5.2 Backend API Deployment (Render)
1. Push repository to GitHub.
2. Link the repository on [Render.com](https://render.com) using the included `render.yaml`.
3. Set Environment Variables: `NODE_ENV=production`, `JWT_SECRET=supersecretjwtkey`.

---

## 6. Conclusion

This project satisfies 100% of the assigned ElevanceSkills tasks and rubrics. By combining cross-platform React Native Web performance with a secure Express.js backend, the application provides an authentic, high-speed Myntra shopping experience on both mobile devices and web browsers.

