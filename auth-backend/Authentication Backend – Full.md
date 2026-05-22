🔐 Authentication Backend – Full Technical Explanation (So Far)

1️⃣ Project Overview



This backend is a secure authentication system built with Node.js + Express + MongoDB, designed for a graduation project.

It supports multiple authentication methods, security protections, and production-level practices.



✅ Supported Authentication Methods



Email + Password



SMS + Password (2-Step Verification)



Google Sign-In (OAuth2)



JWT Access Tokens



Refresh Tokens



Email Rate Limiting



SMS Verification Codes (Twilio)



2️⃣ Project Structure (Final)

Graduation\_Project/auth-backend

│

├── server.js

├── .env

├── package.json

│

├── models/

│   ├── User.js

│   ├── SmsCode.js

│   ├── EmailLog.js

│   ├── EmailRateLimit.js

│   └── RefreshToken.js

│

├── routes/

│   ├── auth.js

│   ├── authRoutes.js

│   ├── protected.js

│   └── sms.js

│

├── controllers/

│   ├── authController.js

│   └── smsController.js

│

├── middleware/

│   └── auth.js

│

├── logs/

│   ├── combined.log

│   └── error.log

│

└── utils/

    ├── googleAuth.js

    ├── verifyGoogleToken.js

    ├── twilio.js

    ├── token.js

    ├── refreshTokenUtil.js

    ├── sendEmail.js

    ├── emailRateLimit.js

    ├── emailMonitor.js

    └── logger.js



3️⃣ Server Initialization (server.js)

Purpose



App entry point



Middleware configuration



Database connection



Route registration



Error handling



Key Responsibilities



Enables CORS with credentials



Parses JSON \& cookies



Loads environment variables



Connects to MongoDB



Starts Express server



Data Flow

Client → Express → Routes → Controllers → Models → MongoDB



4️⃣ User Model (models/User.js)

Stored Fields



email



password (hashed with bcrypt)



phone



isEmailVerified



isPhoneVerified



googleId



createdAt



Security



Passwords are never stored in plain text



Google users may not have a password



5️⃣ Authentication Core Logic (authController.js)

Signup Flow

Client → /api/auth/signup

→ validate input

→ hash password

→ create user

→ send verification email

→ save user



Login Flow (Email + Password)

Client → /api/auth/login

→ find user

→ compare bcrypt password

→ generate JWT + refresh token

→ send tokens



6️⃣ JWT \& Refresh Token System

Files Involved



utils/token.js



models/RefreshToken.js



utils/refreshTokenUtil.js



Token Types

Token	Purpose

Access Token	Short-lived authentication

Refresh Token	Long-lived session renewal

Flow

Login → accessToken + refreshToken

Access expires → refreshToken → new accessToken



7️⃣ Google Sign-In (OAuth2)

File

utils/googleAuth.js



Why This File Exists



Google ID Tokens must be verified server-side, not trusted from frontend.



How It Works

Frontend → Google Login

→ idToken sent to backend

→ verifyGoogleToken()

→ Google public keys validation

→ user info extracted



Allowed Client IDs



Loaded from:



GOOGLE\_CLIENT\_IDS=id1,id2,id3



Result



Returns:



email



name



picture



google user ID



8️⃣ SMS Verification (Twilio)

Models

models/SmsCode.js





Stores:



phone number



OTP code



expiration time



verified flag



Utilities

utils/twilio.js





Handles:



SMS sending



Twilio credentials



9️⃣ SMS + Password Authentication (Step 2)

This Is a 2-Factor Flow

Step A – Send SMS Code

POST /api/sms/send

→ generate OTP

→ store hashed OTP

→ send SMS via Twilio



Step B – Verify SMS Code

POST /api/sms/verify

→ compare OTP

→ mark phone as verified



Step C – Login

POST /api/auth/login

→ password correct

→ phone verified

→ login allowed





🚫 Login fails if SMS verification not completed.



🔟 Email Rate Limiting (Step 3 – After SMS)

Models

EmailRateLimit.js

EmailLog.js



Purpose



Prevent spam



Prevent brute force



Prevent email flooding



Logic

If emails sent > limit

→ block further sends

→ log event



1️⃣1️⃣ Middleware Protection (middleware/auth.js)

Used For



Protected routes



JWT validation



Flow

Request → Authorization Header

→ verify JWT

→ attach user to req

→ allow access



1️⃣2️⃣ Logging System

Files

utils/logger.js

logs/combined.log

logs/error.log



What Is Logged



Errors



Authentication attempts



Rate limit events



System failures



1️⃣3️⃣ Routes Overview

Auth Routes (routes/auth.js)

Route	Purpose

/signup	Register user

/login	Login

/google-signin	Google auth

/refresh-token	Renew JWT

/logout	Invalidate token

/me	Auth check

SMS Routes (routes/sms.js)

Route	Purpose

/send	Send OTP

/verify	Verify OTP

1️⃣4️⃣ Thunder Client Testing (VS Code)

Why Thunder Client



Local API testing



No external tools needed



Ideal for backend validation



Tests You Perform



Signup



Login (password)



SMS send



SMS verify



Login after SMS



Google Sign-In



Token refresh



Protected route access



Rate limit blocking



1️⃣5️⃣ Security Features Summary



✅ Password hashing

✅ JWT authentication

✅ Refresh token rotation

✅ SMS OTP verification

✅ Email rate limiting

✅ Google token verification

✅ Logging \& monitoring

✅ Environment-based secrets



1️⃣6️⃣ Final Data Flow Diagram (Simplified)

Client

 ↓

Express Routes

 ↓

Controllers

 ↓

Utilities (JWT / Google / Twilio)

 ↓

MongoDB Models

 ↓

Response

























































































































🔐 Authentication Backend – Full Technical Explanation (So Far)

1️⃣ Project Overview



This backend is a secure authentication system built with Node.js + Express + MongoDB, designed for a graduation project.

It supports multiple authentication methods, security protections, and production-level practices.



✅ Supported Authentication Methods



Email + Password



SMS + Password (2-Step Verification)



Google Sign-In (OAuth2)



JWT Access Tokens



Refresh Tokens



Email Rate Limiting



SMS Verification Codes (Twilio)



2️⃣ Project Structure (Final)

Graduation\_Project/auth-backend

│

├── server.js

├── .env

├── package.json

│

├── models/

│   ├── User.js

│   ├── SmsCode.js

│   ├── EmailLog.js

│   ├── EmailRateLimit.js

│   └── RefreshToken.js

│

├── routes/

│   ├── auth.js

│   ├── authRoutes.js

│   ├── protected.js

│   └── sms.js

│

├── controllers/

│   ├── authController.js

│   └── smsController.js

│

├── middleware/

│   └── auth.js

│

├── logs/

│   ├── combined.log

│   └── error.log

│

└── utils/

    ├── googleAuth.js

    ├── verifyGoogleToken.js

    ├── twilio.js

    ├── token.js

    ├── refreshTokenUtil.js

    ├── sendEmail.js

    ├── emailRateLimit.js

    ├── emailMonitor.js

    └── logger.js



3️⃣ Server Initialization (server.js)

Purpose



App entry point



Middleware configuration



Database connection



Route registration



Error handling



Key Responsibilities



Enables CORS with credentials



Parses JSON \& cookies



Loads environment variables



Connects to MongoDB



Starts Express server



Data Flow

Client → Express → Routes → Controllers → Models → MongoDB



4️⃣ User Model (models/User.js)

Stored Fields



email



password (hashed with bcrypt)



phone



isEmailVerified



isPhoneVerified



googleId



createdAt



Security



Passwords are never stored in plain text



Google users may not have a password



5️⃣ Authentication Core Logic (authController.js)

Signup Flow

Client → /api/auth/signup

→ validate input

→ hash password

→ create user

→ send verification email

→ save user



Login Flow (Email + Password)

Client → /api/auth/login

→ find user

→ compare bcrypt password

→ generate JWT + refresh token

→ send tokens



6️⃣ JWT \& Refresh Token System

Files Involved



utils/token.js



models/RefreshToken.js



utils/refreshTokenUtil.js



Token Types

Token	Purpose

Access Token	Short-lived authentication

Refresh Token	Long-lived session renewal

Flow

Login → accessToken + refreshToken

Access expires → refreshToken → new accessToken



7️⃣ Google Sign-In (OAuth2)

File

utils/googleAuth.js



Why This File Exists



Google ID Tokens must be verified server-side, not trusted from frontend.



How It Works

Frontend → Google Login

→ idToken sent to backend

→ verifyGoogleToken()

→ Google public keys validation

→ user info extracted



Allowed Client IDs



Loaded from:



GOOGLE\_CLIENT\_IDS=id1,id2,id3



Result



Returns:



email



name



picture



google user ID



8️⃣ SMS Verification (Twilio)

Models

models/SmsCode.js





Stores:



phone number



OTP code



expiration time



verified flag



Utilities

utils/twilio.js





Handles:



SMS sending



Twilio credentials



9️⃣ SMS + Password Authentication (Step 2)

This Is a 2-Factor Flow

Step A – Send SMS Code

POST /api/sms/send

→ generate OTP

→ store hashed OTP

→ send SMS via Twilio



Step B – Verify SMS Code

POST /api/sms/verify

→ compare OTP

→ mark phone as verified



Step C – Login

POST /api/auth/login

→ password correct

→ phone verified

→ login allowed





🚫 Login fails if SMS verification not completed.



🔟 Email Rate Limiting (Step 3 – After SMS)

Models

EmailRateLimit.js

EmailLog.js



Purpose



Prevent spam



Prevent brute force



Prevent email flooding



Logic

If emails sent > limit

→ block further sends

→ log event



1️⃣1️⃣ Middleware Protection (middleware/auth.js)

Used For



Protected routes



JWT validation



Flow

Request → Authorization Header

→ verify JWT

→ attach user to req

→ allow access



1️⃣2️⃣ Logging System

Files

utils/logger.js

logs/combined.log

logs/error.log



What Is Logged



Errors



Authentication attempts



Rate limit events



System failures



1️⃣3️⃣ Routes Overview

Auth Routes (routes/auth.js)

Route	Purpose

/signup	Register user

/login	Login

/google-signin	Google auth

/refresh-token	Renew JWT

/logout	Invalidate token

/me	Auth check

SMS Routes (routes/sms.js)

Route	Purpose

/send	Send OTP

/verify	Verify OTP

1️⃣4️⃣ Thunder Client Testing (VS Code)

Why Thunder Client



Local API testing



No external tools needed



Ideal for backend validation



Tests You Perform



Signup



Login (password)



SMS send



SMS verify



Login after SMS



Google Sign-In



Token refresh



Protected route access



Rate limit blocking



1️⃣5️⃣ Security Features Summary



✅ Password hashing

✅ JWT authentication

✅ Refresh token rotation

✅ SMS OTP verification

✅ Email rate limiting

✅ Google token verification

✅ Logging \& monitoring

✅ Environment-based secrets



1️⃣6️⃣ Final Data Flow Diagram (Simplified)

Client

 ↓

Express Routes

 ↓

Controllers

 ↓

Utilities (JWT / Google / Twilio)

 ↓

MongoDB Models

 ↓

Response



this is my auth-backend and now i need to start in the home screan backend nad make it in folder named (home-backend) and this is the proposal of this project

(An Intelligent Personal Budgeting App

Introduction:

In today’s fast-paced world, personal financial management is a growing challenge. Many people

struggle to track expenses, plan budgets, and achieve savings goals effectively. Our graduation

project, our application, aims to address this need with an intelligent, user-friendly mobile

application that combines the essential features of modern budgeting tools with innovative

enhancements.

Core Features:

• Expense Tracking \& Categorization: Easily record daily transactions and organize them by

category.

• Budget Planning: Set monthly budgets, monitor spending, and receive detailed reports and

analytics.

• Strong \& Detailed Analysis: Gain deep insights into spending habits with detailed charts,

trends, and comparisons over time to help users make better financial decisions.

• Savings Goals \& Jars: Create savings targets and allocate money to multiple goals.

• Debt \& Loan Tracking: Manage debts and monitor repayments.

• Notifications \& Alerts: Get reminders for bills, overspending, and savings opportunities.

• Data Backup \& Restore: Secure storage and easy recovery of financial data.

• Shared Budgets: A unique feature allowing families, couples, or roommates to manage shared

expenses and savings goals collaboratively with clear roles and permissions.

Innovative Additions:

• Multi-format Entry: Users can input expenses via text, voice, images, scanned invoices,

camera capture, and PDFs — making it quick and convenient to log transactions.

• AI Assistant: An integrated AI advisor provides personalized insights, spending analyses, and

practical saving suggestions to help users make better financial decisions.

• Personalized Offers: The app recommends relevant deals or money-saving offers based on

users’ spending patterns and needs — adding real value without being intrusive.

Target Users \& Market Need:

Our app is designed for youth, university students, and early-career professionals who often face

challenges managing their personal finances due to limited income, fluctuating expenses.

Vision:

Our application goes beyond simple expense tracking by making budgeting smarter, more practical,

and more collaborative. By combining modern AI technologies, flexible data entry, and innovative

shared budgeting, we aim to deliver a practical solution that truly supports users in achieving financial

well-being.)

so see the photo of mobile app and we need to start to make the backend together include (the header part (welcome back,Name of user ) , his photo too , the total palance and (income and expence) , quick Actions include (add expence , create budget , saving goal , Analytics , debt tracking , AI chat , offers ) , and in the buttom include (home , Analytics , budgets , profile))

so do not make edeitinh in the auth-backend file and make theme work together (i am an backend dev only )do not make  any part of frontend







npm install speakeasy qrcode









https://drive.google.com/file/d/1iRKthIlL3NDDp8cdj1PzLi-Hk-kl9Hit/view







Nvidia:

https://build.nvidia.com/meta/llama-3\_1-8b-instruct







LLAMS

TensorFlow
Speeking

