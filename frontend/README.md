# Game Hub - Frontend

The frontend for the Game Hub platform, a production-ready multiplayer gaming application.

## 🚀 Key Features

- **Real-time Interactivity**: Socket.io-client for immediate game state updates.
- **Responsive Design**: Mobile-first approach with modern CSS.
- **Smooth Navigation**: Single-page application using React Router.
- **Authentication**: JWT-based login and registration flows.
- **Game Variety**: Tic Tac Toe, Drawing & Guessing, and Territory Grid.

## 🛠️ Tech Stack

- **Framework**: React 18+ (Vite)
- **Styling**: Vanilla CSS (Custom design system)
- **Communication**: Socket.io-client, Axios
- **State Management**: React Hooks & Context API

## 🏃 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Environment Variables**:
   Create a `.env` file or ensure context:
   ```env
   VITE_API_URL=http://localhost:5001/api
   ```
3. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`.

## 📁 Structure

- `src/components`: Reusable UI elements.
- `src/pages`: Application views (Auth, Dashboard, GameRoom).
- `src/games`: Logic and UI for specific game types.
- `src/context`: Socket and Auth context providers.
