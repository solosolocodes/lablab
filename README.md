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
- **Real-time Preview**: Live preview of experiments with survey integration and interactive testing

## Architecture and Code Structure

### Core Components

The application follows a structured architecture with the following key components:

#### 1. Experiment Structure

- **Stages**: The fundamental building blocks of experiments
  - **Instructions Stage**: Display instructional content to participants
  - **Survey Stage**: Collect feedback through customizable surveys
  - **Scenario Stage**: Present financial simulations with dynamic asset pricing
  - **Break Stage**: Provide timed breaks between experiment sections

- **Context Providers**:
  - `PreviewContext`: Manages experiment stage navigation in preview mode
  - `ParticipantContext`: Handles participant state and progress tracking
  - `ParticipantPerformContext`: Manages active experiment performance

#### 2. MongoDB Data Models

The application uses MongoDB for data storage with the following models:

- `Experiment`: Core experiment configuration and stage definitions
- `Survey`: Questionnaire definitions with various question types
- `Scenario`: Financial simulation parameters including price changes
- `Wallet`: Asset collections that participants can trade during scenarios
- `User`: Authentication and user management (researchers and participants)
- `UserGroup`: Grouping of participants for different experimental conditions
- `Transaction`: Record of participant trading activity
- `PriceLog`: Historical price data for assets
- `ParticipantProgress`: Tracking participant progress through experiments
- `SurveyResponse`: Storage for participant survey answers

#### 3. Key Components

- **SurveyStage Component**: 
  - Renders survey questions in a carousel format
  - Implements multi-retry fetch mechanism with 200ms delays
  - Uses global singleton cache to prevent redundant API calls
  - Features anti-flicker technology for smooth transitions
  - Supports both local and MongoDB-sourced questions

- **ScenarioStage Component**:
  - Renders financial scenarios with real-time asset pricing
  - Displays wallet assets and trading interface
  - Tracks round progress and portfolio performance
  - Provides simulated market interface for participants

- **PreviewContext**:
  - Controls navigation between experiment stages
  - Manages stage transitions with special handling for surveys
  - Tracks timing for timed stages
  - Provides consistent API for stage progression

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
    - `/experiments` - Experiment management dashboards
    - `/surveys` - Survey design and management
    - `/scenarios` - Financial scenario management
  - `/participant` - Participant-facing experiment interfaces
    - `/experiments/[id]/perform` - Active experiment participation
- `/src/components` - Reusable UI components
  - `/admin` - Admin-specific components
  - `/participant` - Participant-facing components
  - `/preview` - Components for experiment preview mode
    - `SurveyStage.tsx` - Advanced survey rendering component
    - `ScenarioStage.tsx` - Financial scenario simulation component
- `/src/contexts` - React context providers
  - `PreviewContext.tsx` - Stage navigation and preview state
  - `ParticipantContext.tsx` - Participant-specific state management
- `/src/lib` - Utility functions and configuration
  - `auth.ts` - Authentication configuration
  - `dbConnect.ts` - MongoDB connection handling
- `/src/models` - MongoDB schemas for experiment data
- `/public` - Static assets and resources

## Technical Implementation Details

### MongoDB Integration

The application uses MongoDB as its primary database, with Mongoose for schema definition and validation. Key aspects of the MongoDB implementation:

1. **Connection Management**:
   - Dynamic connection pooling with connection caching
   - Request-scoped connections for API routes
   - Error handling with retry mechanisms

2. **Data Models**:
   - Strict schema validation using Mongoose
   - Indexing for performance optimization
   - Lean queries for improved memory usage

3. **Performance Optimizations**:
   - Field projection to reduce document size
   - Query timeouts to prevent long-running operations
   - Aggregation pipelines for complex data operations

### Component Optimization

The application uses several techniques to ensure smooth performance:

1. **SurveyStage Component**:
   - Global singleton cache to track loaded surveys across renders
   - Request deduplication using ref flags
   - Component lifecycle management with mount/unmount tracking
   - Smart loading state management to prevent flicker
   - Retry mechanism for failed API calls (200ms delay between attempts)
   - Transition detection to minimize UI disruption

2. **PreviewContext**:
   - Stage-type specific transition handling
   - Shorter transition times for survey components (50ms vs 300ms)
   - Batch state updates to prevent React render cascades
   - Memory management with useRef for cleanup functions

3. **API Routes**:
   - Optimized for performance with minimal overhead
   - Cache-control headers to prevent browser caching where needed
   - Error handling with appropriate status codes
   - Response size optimization

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Authentication**: NextAuth.js
- **Database**: MongoDB with Mongoose
- **Styling**: Tailwind CSS
- **UI Design**: React Flow for experiment flow visualization
- **State Management**: React Context API with hooks
- **Language**: TypeScript

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.
