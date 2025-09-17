# 🌐 Smart Labor Hiring & Management System - Server  
*Backend API built with Node.js & Express*  

---  

## 📖 Overview  
This is the **server-side backend** for the **Smart Labor Hiring & Management System**, a location-based mobile application designed for the textile industry.  

The backend provides:  
- 🔐 Authentication & role-based accounts (Mills, Contractors, Workers)  
- 📄 REST APIs for job posting, contracts, reviews, and notifications  
- 🗄️ MongoDB database integration  
- 📍 Google Maps API integration for location-based matching  
- 🔔 Firebase push notifications support  

---  

## 🛠️ Tech Stack  

- 🌐 **Node.js** – Runtime environment  
- ⚡ **Express.js** – Web framework  
- 🍃 **MongoDB & Mongoose** – Database & ODM  
- 🔑 **JWT Authentication** – Secure login system  
- 🗺️ **Google Maps API** – Location-based search  
- 🔔 **Firebase** – Push notifications  

---  

## 📂 Project Structure  

```
/server
 ┣ 📂 config       → Database & environment configs
 ┣ 📂 controllers → API logic (jobs, users, contracts)
 ┣ 📂 models      → Mongoose schemas (User, Job, Contract)
 ┣ 📂 routes      → Express routes for APIs
 ┣ 📂 middleware  → Authentication & validation middlewares
 ┣ 📜 server.js   → Entry point
 ┗ 📜 package.json
```  

---  

## 🚀 Getting Started  

### Prerequisites  
- Node.js v18+  
- MongoDB (local or Atlas)  
- Google Maps API Key  
- Firebase Project (for notifications)  

### Installation  

```bash
# Clone the repository
git clone https://github.com/zaibten/Smart-Labor-Hiring-System.git

# Navigate into server
cd Smart-Labor-Hiring-System/server

# Install dependencies
npm install
```  

### Environment Setup  
Create a `.env` file in the `server` directory with the following variables:  

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
FIREBASE_SERVER_KEY=your_firebase_key
```  

### Run the Server  

```bash
npm start
```  

Server will start at:  
👉 `http://localhost:5000`  

---  

## 📌 API Endpoints  

### Auth  
- `POST /api/auth/register` – Register new user (Worker / Contractor / Mill)  
- `POST /api/auth/login` – Login & receive JWT token  

### Jobs  
- `POST /api/jobs` – Post a new job (Contractor/Mill)  
- `GET /api/jobs` – Get available jobs (with location filters)  

### Contracts  
- `POST /api/contracts` – Create digital contract  
- `GET /api/contracts/:id` – Fetch contract details  

### Reviews  
- `POST /api/reviews` – Add review for worker/contractor  
- `GET /api/reviews/:id` – Fetch reviews  

---  

## 🌍 Vision  
This backend provides the **foundation** for a scalable labor management platform. Future updates will include:  
- 💳 Payment gateway integration  
- 📊 Analytics dashboard APIs  
- 🌐 Multi-language API support  

---  

## 📜 License  
This project is licensed under the **MIT License** – free to use, modify, and distribute.  

👉 **Developed with passion by [Zaibten](https://github.com/zaibten)**  
