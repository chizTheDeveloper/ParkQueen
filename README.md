# ParQueen 👑🚗

**The Ultimate NYC Parking Companion**

ParQueen is a mobile-first, community-driven application designed to solve the nightmare of parking in dense urban environments like New York City. It combines real-time community data with powerful AI to help users find street parking, rent private garages, and decipher complex parking rules.

## ✨ Features

### 🗺️ Street Parking & Community Pings
- **Real-time Availability**: See spots pinged by other users leaving within 15 minutes.
- **Navigation**: Integrated routing to guide you directly to the spot.
- **Smart Filters**: Visual indicators for "Leaving Now" vs "Later Today".
- **Gamification**: Earn reputation by sharing open spots.

### 🤖 AI Sign Decoder (Powered by Google Gemini)
- **Instant Analysis**: Snap a photo of confusing parking signs.
- **Clear Verdicts**: Get a simple "YES", "NO", or "CONDITIONAL" answer.
- **Context Aware**: Uses the latest Gemini Vision models to interpret rules based on time and day.

### 🏠 Garage & Driveway Rentals
- **Peer-to-Peer**: Rent out your driveway or find a private garage.
- **Host Dashboard**: Track earnings and view analytics (powered by Recharts).
- **AI Listing Gen**: Generate professional descriptions for your parking spot using AI.

### 💬 Smart Messaging
- **In-App Chat**: Coordinate with spot holders or garage owners.
- **Smart Replies**: AI-generated responses to speed up communication while driving (safety first).

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS
- **Maps**: Leaflet (OpenStreetMap/CartoDB Dark Matter tiles)
- **AI**: Google Gemini API (`@google/genai` SDK)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Deployment**: Netlify Ready

## 🚀 Getting Started

### Prerequisites
- Node.js 20
- Restricted development browser credentials for Mapbox and Google Maps Platform

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/parqueen.git
   cd parqueen
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Environment Variables**
   Copy `.env.example` to `.env.local`:
   ```env
   VITE_MAPBOX_TOKEN=
   VITE_GOOGLE_MAPS_API_KEY=
   ```
   Use development-only values. See `SECURITY.md` for provider restrictions and production configuration.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in Browser**
   Navigate to `http://localhost:5173` (or the port shown in your terminal).

## 🌍 Deployment

### Netlify
This project is configured for seamless deployment on Netlify.

1. Connect your repository to Netlify.
2. The `netlify.toml` file handles the build settings (`npm run build`).
3. Configure the two browser variables from `.env.example` in the approved production environment. Never commit their values.

## 📱 Mobile First Design
ParQueen is optimized for mobile browsers. For the best experience during development, use your browser's DevTools and toggle "Device Toolbar" to simulate a mobile view (e.g., iPhone 12/14 Pro).

## 📄 License
MIT
