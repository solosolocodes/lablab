# LabLab App

A secure Next.js web application with MongoDB integration, featuring user authentication with NextAuth.js and bcrypt password hashing.

## Features

- User registration and authentication
- Secure password storage with bcrypt hashing
- MongoDB integration for user data storage
- Responsive UI built with Tailwind CSS
- TypeScript for type safety

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- npm or yarn

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
- `/src/components` - Reusable UI components
- `/src/lib` - Utility functions and configuration
- `/src/models` - MongoDB models
- `/src/types` - TypeScript type definitions

## Technology Stack

- **Framework**: Next.js 14
- **Authentication**: NextAuth.js
- **Database**: MongoDB with Mongoose
- **Styling**: Tailwind CSS
- **Language**: TypeScript
