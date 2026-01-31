
# Complete Booking Flow with Razorpay Payment Integration

This plan implements a full booking flow: Quote -> Billing -> Payment -> Receipt -> Tracking

## Overview

When users click "Get Quote" on the hero section, they'll be taken through a multi-step booking process with your specified pricing in Indian Rupees.

---

## Pricing Structure

| Bags | Price |
|------|-------|
| 1 Bag | ₹300 |
| 2 Bags | ₹500 |
| 3 Bags | ₹800 |
| 4+ Bags | ₹1,200 |

---

## User Flow

```text
Hero (Quick Booking Form)
        │
        ▼ [Get Quote]
   Billing Page
   - Shows booking summary
   - Displays calculated price
   - Continue button
        │
        ▼ [Continue]
   Payment Page
   - Razorpay checkout popup
   - UPI, Cards, Wallets, Net Banking
        │
        ▼ [Payment Success]
   Receipt Page
   - Booking confirmation
   - Payment details
   - Tracking ID generated
        │
        ▼
   Tracking Page
   - View order status
   - Track luggage location
```

---

## What Will Be Created

### New Pages
1. **Billing Page** (`/booking`) - Displays booking summary and pricing
2. **Payment Page** - Integrated into billing (Razorpay popup)
3. **Receipt Page** (`/receipt/:bookingId`) - Shows confirmation after payment
4. **Tracking Page** (`/track`) - Users can track their bookings

### New Components
- `BookingSummary` - Displays booking details and price breakdown
- `PaymentButton` - Handles Razorpay checkout integration

### Backend (Edge Function)
- `create-razorpay-order` - Creates Razorpay order and handles payment verification

---

## Technical Details

### Database Schema
Two new tables will be created:

**bookings table:**
- id, user_id, pickup_location, delivery_location
- drop_off_date, pickup_date, number_of_bags
- amount, status (pending/paid/in_transit/delivered/completed)
- tracking_id, created_at

**payments table:**
- id, booking_id, razorpay_order_id, razorpay_payment_id
- amount, status (pending/success/failed), created_at

### Razorpay Integration
- Uses Razorpay Checkout.js for payment UI
- Edge function creates orders securely with API keys
- Webhook verification for payment confirmation

---

## Required Setup

Before implementation, you'll need to provide:
1. **Razorpay Key ID** (publishable, starts with `rzp_test_` or `rzp_live_`)
2. **Razorpay Key Secret** (private, stored securely)

You can get these from your Razorpay Dashboard > Settings > API Keys.

---

## Security Measures

- RLS policies ensure users can only view their own bookings
- Razorpay Key Secret stored as secure environment variable
- Payment verification done server-side in edge function
- Tracking IDs are unique and randomly generated

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/Booking.tsx` | Create - Billing/payment page |
| `src/pages/Receipt.tsx` | Create - Payment confirmation |
| `src/pages/Track.tsx` | Create - Order tracking |
| `src/components/BookingSummary.tsx` | Create - Booking details card |
| `src/components/Hero.tsx` | Modify - Navigate to booking page |
| `src/App.tsx` | Modify - Add new routes |
| `supabase/functions/create-razorpay-order/index.ts` | Create - Payment backend |
| Database migration | Create bookings and payments tables |
