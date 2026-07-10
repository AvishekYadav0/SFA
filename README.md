# SFA Sales Tracker

A full-stack Sales Force Automation system built with MERN Stack.

## Tech Stack

- **Frontend:** React.js + Vite + Tailwind CSS
- **Backend:** Express.js + Node.js
- **Database:** MongoDB Atlas
- **Auth:** JWT + bcrypt

## Features

- Admin & Staff role-based authentication
- Order Plans management
- Lifting Plans management
- Collection Plans management
- Sales Reports & Dashboard
- Product & Dealer management

## Setup Instructions

### Backend
```bash
cd backend
npm install
# Create .env file with your credentials
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Login Credentials (Development)
```
Admin:  admin@sfa.com  / admin123
Staff:  staff@sfa.com  / staff123
```

## Environment Variables

Create a `.env` file inside `backend/` folder:
```
PORT=8000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
NODE_ENV=development
```
