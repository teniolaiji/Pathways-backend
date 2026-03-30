# Pathways — Backend API

AI-Assisted Inclusive STEAM Learning Platform for African Women  
**Live Backend:** https://pathways-backend-3151.onrender.com  
**Frontend Repo:** [pathways-frontend](https://github.com/teniolaiji/Pathways-frontend)  
**Live App:** https://stem-pathways-stem4u.netlify.app

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB Atlas (via Mongoose)
- **AI:** Groq API (LLaMA 3.1 8b Instant)
- **Email:** Brevo HTTP API
- **Auth:** JWT (JSON Web Tokens)
- **Hosting:** Render (free tier)

---

## Features

- JWT authentication with email verification and password reset
- AI-generated personalised STEAM learning pathways (Groq/LLaMA)
- Automatic resource URL validation and AI-powered replacement of broken links
- Guaranteed minimum one working resource per module
- Progress tracking with badge awards and feedback analytics
- In-app notification system with email alerts via Brevo
- Role-based access control (Learner / Admin)
- Admin panel: user management, pathway oversight, flagged resource moderation
- Resource flagging with auto-invalidation at 3 flags
- Pathway regeneration with archiving of previous pathways
- Keep-alive ping to prevent Render free tier sleep

---

## Project Structure

```
pathways-backend/
├── config/
│   └── db.js                    # MongoDB connection
├── controllers/
│   ├── adminController.js        # Admin user/pathway/resource management
│   ├── assessmentController.js   # Assessment CRUD
│   ├── authController.js         # Register, login, verify, reset password
│   ├── notificationController.js # In-app notifications
│   ├── pathwaysController.js     # AI pathway generation and management
│   ├── profileController.js      # User profile
│   └── progressController.js    # Module completion, badges, flagging
├── middleware/
│   ├── authMiddleware.js         # protect + adminOnly middleware
│   └── errorHandler.js           # Global error handler
├── models/
│   ├── Assessment.js
│   ├── LearningPathway.js
│   ├── Notification.js
│   ├── Profile.js
│   ├── Progress.js
│   └── User.js
├── routes/
│   ├── adminRoutes.js
│   ├── assessmentRoutes.js
│   ├── authRoutes.js
│   ├── notificationRoutes.js
│   ├── pathwayRoutes.js
│   ├── profileRoutes.js
│   └── progressRoutes.js
├── services/
│   ├── aiService.js              # Groq API integration
│   ├── emailService.js           # Brevo HTTP API email sending
│   ├── notificationService.js    # Notification creation
│   └── personalizationEngine.js  # Resource URL validation
├── .gitignore
├── package.json
└── server.js                    # Entry point
```

---

## Local Setup

### Prerequisites

- Node.js v18 or higher
- A MongoDB Atlas account (free tier works)
- A Groq API key — free at https://console.groq.com
- A Brevo account — free at https://brevo.com

### Step 1 — Clone the repository

```bash
git clone https://github.com/teniolaiji/Pathways-backend
cd pathways-backend
```

### Step 2 — Install dependencies

```bash
npm install
```

### Step 3 — Create your `.env` file

Create a file named `.env` in the root of the project with the following variables:

```
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/pathwaysDB?retryWrites=true&w=majority
JWT_SECRET=your_random_secret_string_here
GROQ_API_KEY=gsk_your_groq_key_here
BREVO_API_KEY=xkeysib_your_brevo_api_key_here
EMAIL_FROM=your_verified_brevo_sender_email@gmail.com
FRONTEND_URL=http://localhost:5173
PORT=8000
NODE_ENV=development
```

**How to get each key:**
- `MONGO_URI` — Create a free cluster at https://mongodb.com/atlas, then go to Connect → Drivers → copy the connection string. Replace `<password>` with your database password and add `pathwaysDB` as the database name before the `?`
- `JWT_SECRET` — Any random string e.g. `mysecretkey123`
- `GROQ_API_KEY` — Sign up at https://console.groq.com → API Keys → Create key
- `BREVO_API_KEY` — Sign up at https://brevo.com → Settings → API Keys → Generate
- `EMAIL_FROM` — The email address you verified as a sender in Brevo

### Step 4 — Run the server

```bash
node server.js
```

You should see:
```
Server running on port 8000
MongoDB Connected: your-cluster.mongodb.net
```

### Step 5 — Test the API

Open your browser and go to:
```
http://localhost:8000/
```

You should see: `{"message":"Pathways API is running."}`

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| GET | `/api/auth/verify-email?token=` | Verify email address |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/resend-verification` | Resend verification email |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |

### Assessment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/assessment` | Submit assessment |
| GET | `/api/assessment` | Get user assessments |
| GET | `/api/assessment/subfields` | Get available domains and subfields |

### Pathways
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/pathway/generate/:assessmentId` | Generate AI pathway |
| POST | `/api/pathway/:pathwayId/regenerate` | Regenerate pathway |
| GET | `/api/pathway` | Get all user pathways |
| GET | `/api/pathway/:pathwayId` | Get single pathway |
| GET | `/api/pathway/:pathwayId/feedback-analytics` | Get feedback analytics |

### Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/progress/complete/:pathwayId/:moduleId` | Mark module complete |
| GET | `/api/progress/:pathwayId` | Get pathway progress |
| GET | `/api/progress` | Get all progress |
| POST | `/api/progress/flag/:pathwayId/:moduleId/:resourceId` | Flag a resource |

### Notifications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | Get notifications |
| PUT | `/api/notifications/read-all` | Mark all as read |
| PUT | `/api/notifications/:id/read` | Mark one as read |
| DELETE | `/api/notifications/:id` | Delete notification |

### Admin (requires admin role)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Platform statistics |
| GET | `/api/admin/users` | All users |
| PUT | `/api/admin/users/:userId/promote` | Promote to admin |
| PUT | `/api/admin/users/:userId/demote` | Demote to learner |
| DELETE | `/api/admin/users/:userId` | Delete user |
| GET | `/api/admin/pathways` | All pathways |
| DELETE | `/api/admin/pathways/:pathwayId` | Delete pathway |
| GET | `/api/admin/flagged-resources` | Flagged resources |
| PUT | `/api/admin/resources/:pathwayId/:moduleId/:resourceId/restore` | Restore resource |
| DELETE | `/api/admin/resources/:pathwayId/:moduleId/:resourceId` | Remove resource |

---

## Creating an Admin User

Admin users cannot be created through the registration form for security reasons.

1. Register a normal account through the app
2. Go to MongoDB Atlas → your cluster → Browse Collections → `pathwaysDB` → `users`
3. Find your user document → click Edit
4. Change `"role": "learner"` to `"role": "admin"`
5. Also set `"isVerified": true` if not already set
6. Click Update
7. Log out and log back in — the Admin Panel will appear in the sidebar

---

## Deployment (Render)

This backend is deployed on Render. To deploy your own instance:

1. Push this repo to GitHub
2. Go to https://render.com → New → Web Service
3. Connect your GitHub repo
4. Set Build Command: `npm install`
5. Set Start Command: `node server.js`
6. Add all environment variables from the `.env` section above
7. Add `FRONTEND_URL` pointing to your Netlify frontend URL
8. Deploy

---

## Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `GROQ_API_KEY` | Yes | Groq API key for AI pathway generation |
| `BREVO_API_KEY` | Yes | Brevo API key for email sending |
| `EMAIL_FROM` | Yes | Verified sender email address |
| `FRONTEND_URL` | Yes | Frontend URL for CORS and email links |
| `PORT` | No | Server port (defaults to 8000) |
| `NODE_ENV` | No | Set to `production` on Render |
