# Frontend UI

React + Vite application for the Docker Web Management Interface (Stage 3).

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm run dev -- --host --port 5173
   ```

   The API base URL defaults to `http://localhost:8003`. Override with:

   ```bash
   VITE_API_URL=http://your-api:8003 npm run dev
   ```

3. Build for production:

   ```bash
   npm run build
   ```

## Features

- Sidebar navigation for Containers, Volumes, Networks, and Images
- Data tables with action buttons for each resource type
- Live log viewer that streams container logs over WebSockets
- Simple badges and layout to match the Stage 3 base UI requirements
