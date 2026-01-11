# Occasio - Event Management and Booking System

A full-stack event management platform built with React + Node.js + PostgreSQL that allows organizers to create events, manage registrations, and issue QR-coded tickets.

## 🌟 Features

### Admin/Organizer Features
- 🔐 Secure JWT authentication
- 📅 Create, edit, and delete events
- 🖼️ Upload event posters via Cloudinary
- 📝 Drag-and-drop custom registration form builder
- 🎫 Customizable ticket styling (colors, logos, templates)
- 📊 Analytics dashboard with registration & revenue insights
- 💰 Revenue tracking and financial reports
- 📥 Export attendee data to CSV
- 🎟️ Discount & promo code management
- ✉️ Broadcast emails to event participants
- 👥 Team management with role-based permissions
- ✅ QR-based check-in/check-out dashboard
- 📋 Event polls and voting

### Public User Features
- 🔍 Browse and search events by category
- 📖 View detailed event information
- 📋 Fill dynamic registration forms
- 💳 Secure payment processing (Razorpay)
- 📧 Receive PDF tickets with QR codes via email
- ⭐ Reviews and ratings for events
- 📆 Add events to calendar (.ics download)
- 📝 Join waitlist for sold-out events

### Technical Features
- 🔒 HMAC-signed QR codes for security
- 🔔 Webhook-based payment confirmation
- ☁️ Cloudinary integration for image storage
- 📄 PDF ticket generation with PDFKit
- 📱 PWA support with push notifications
- 🎨 Modern responsive UI with Tailwind CSS & glassmorphism

## 🛠️ Tech Stack

### Frontend
- React 18 + Vite
- Tailwind CSS
- React Router v6
- React Hook Form
- Motion (animations)
- Lucide Icons
- Three.js (3D backgrounds)

### Backend
- Node.js + Express
- PostgreSQL + Prisma ORM
- JWT Authentication
- PDFKit (PDF generation)
- QRCode generation
- Razorpay integration
- Nodemailer (email)
- Cloudinary (images)

## 📋 Prerequisites

- Node.js v18+
- PostgreSQL database

## 🚀 Quick Start

### 1. Database Setup

```sql
CREATE DATABASE event_management;
```

### 2. Backend Setup

```bash
cd backend
npm install
# Configure .env with your DATABASE_URL
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
Backend runs on `http://localhost:5000`

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```
Frontend runs on `http://localhost:5173`

## 🔑 Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/event_management
JWT_SECRET=your_jwt_secret
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
QR_SECRET_KEY=your_qr_secret
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
```

## 🚢 Deployment

**Backend**: Deploy to Render or Azure App Service  
**Frontend**: Deploy to Vercel  
**Database**: Use Neon or Supabase for PostgreSQL

## 📄 License

ISC
