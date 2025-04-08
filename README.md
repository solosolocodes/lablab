# LabLab - Behavioral Economics Experiment Platform

A comprehensive platform for designing, managing, and running behavioral economics experiments with advanced experiment flow design capabilities, financial simulations, and participant management.

## Features

- **Visual Experiment Design**: Design complex experiment flows with a flexible stage system
- **Scenario Simulation**: Create financial scenarios with assets, wallets, and price movements
- **User Management**: Manage admin researchers and participants with different authentication flows
- **Experiment Flow Control**: Design branching experiment flows based on participant responses
- **Financial Asset Simulation**: Simulate changing asset prices across experiment rounds
- **Advanced Authentication**: Role-based access with NextAuth.js and secure password hashing
- **Responsive UI**: Modern interface built with Tailwind CSS

## Experiment Components

- **Stages**: Different experiment stages including instructions, scenarios, surveys, and breaks
- **Branches**: Conditional logic to control experiment flow based on participant responses
- **Scenarios**: Financial simulations with multiple rounds and changing asset prices
- **Wallets**: Collections of assets with amounts that can be tracked during experiments
- **User Groups**: Groups of participants that can be assigned to different experimental conditions

## Getting Started

### Prerequisites

- Node.js (v18.17.0 or later)
- npm or yarn
- MongoDB database

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/solosolocodes/lablab.git
   cd lablab
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables by creating a `.env.local` file:
   ```
   MONGODB_URI=your_mongodb_connection_string
   NEXTAUTH_SECRET=your_nextauth_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

4. Run the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Project Structure

- `/src/app` - Next.js App Router pages and API routes
  - `/admin` - Admin interfaces for researchers
  - `/experiment` - Participant-facing experiment interfaces
- `/src/components` - Reusable UI components
- `/src/lib` - Utility functions and configuration
- `/src/models` - MongoDB models for experiment data
  - `/experiment-components` - Models for experiment stages and branches
- `/src/types` - TypeScript type definitions

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Authentication**: NextAuth.js
- **Database**: MongoDB with Mongoose
- **Styling**: Tailwind CSS
- **UI Design**: React Flow for experiment flow visualization
- **State Management**: React with Context API
- **Language**: TypeScript
