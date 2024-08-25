## Getting Started

### Prerequisites

- Node.js LTS >=v20.12.2
- npm v10.5.0 or pnpm
- MongoDB instance

### Installation

#### Backend

1. Navigate to the `backend` directory:

   ```bash
   cd backend
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Create a `.env` file with your MongoDB URI:

   ```env
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   ```

4. Start the backend server:
   ```bash
   pnpm start
   ```

#### Frontend

1. Navigate to the `frontend` directory:

   ```bash
   cd frontend
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Start the Electron app:
   ```bash
   pnpm start
   ```

## Goals

- [x] Allow all users to download on any machine through an Electron JS app
- [x] Migrate to TypeScript and implement SolidJS
- [x] Set up CI/CD pipeline and automatic releases
- [x] Implement changelog using conventional commits
- [ ] Allow users to enter session goals and customize productive/unproductive sites
- [ ] Migrate from electron-storage to SQLite for improved data handling
- [ ] Add integration and automated tests
- [ ] Implement user authentication and cloud-based data persistence using MongoDB and JWT
