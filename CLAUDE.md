# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

best-x is a Twitter/X content extraction tool with a Next.js frontend and Express backend that uses browser automation to scrape and archive Twitter threads and conversations.

## Architecture

### Two-Service Architecture
- **Frontend**: Next.js app in `best-x-web/` on port 3000
- **Backend**: Express API server (`best-x-web/server.ts`) on port 3001
- **Browser Automation**: Uses better-playwright-mcp HTTP server on port 3103

### Key Components

1. **Tweet Extraction Engine** (`get-post.ts`)
   - Connects to PlaywrightClient for browser automation
   - Implements smart scrolling with configurable depth (default: 10 scrolls)
   - Text-level HTML truncation to remove recommendation sections
   - Termination condition: stops after 2 consecutive scrolls with no new content
   - Each scroll = 3 PageDown key presses

2. **Queue-Based Processing** (`best-x-web/server.ts`)
   - Async task queue for extraction requests
   - Queue processor checks every 2 seconds
   - Tasks stored in SQLite with progress tracking

3. **Database Layer** (`best-x-web/lib/`)
   - SQLite database using better-sqlite3
   - Models: ExtractionsModel, QueueModel
   - Migration system for schema management

4. **Frontend** (`best-x-web/app/page.tsx`)
   - React-based UI with real-time task status
   - History view with search capabilities
   - Configurable extraction parameters

## Commands

```bash
# Development
pnpm run dev       # Start frontend (Next.js) on :3000
pnpm run server    # Start backend (Express) on :3001

# Both services must run simultaneously:
cd best-x-web && pnpm run dev     # Terminal 1
cd best-x-web && pnpm run server  # Terminal 2

# Direct extraction (for testing)
tsx get-post.ts <twitter-url>

# Build & Production
pnpm run build     # Build Next.js app
pnpm run start     # Start production server
```

## Critical Configuration

### Scrolling Parameters (`best-x-web/lib/consts.ts`)
- `DEFAULT_SCROLLS = 10` - Default scroll depth for extraction
- `MAX_SCROLLS = 30` - Maximum allowed scrolls

### HTML Truncation Boundaries
The system truncates HTML at these text markers to remove recommendations:
- "源自于整个 X"
- "from across X" 
- "发现更多"
- "Discover more"

## Database Schema

- `extractions` - Stores extracted tweet data with JSON content
- `task_queue` - Manages async extraction tasks
- Migrations in `best-x-web/lib/migrations.ts`

## API Endpoints

All endpoints are prefixed with `/api/`:
- `POST /fetch-tweet` - Queue extraction task
- `GET /task/:id` - Check task status
- `GET /queue/status` - View queue status
- `GET /extractions` - List extraction history
- `GET /extractions/:id` - Get specific extraction
- `GET /extractions/:id/article` - Get merged article view
- `DELETE /extractions/:id` - Delete extraction
- `GET /search` - Search extractions

## Dependencies & Prerequisites

- **better-playwright-mcp** server must be running on port 3103
- Uses pnpm for package management
- TypeScript with tsx for execution
- Next.js 15.5.0 with Turbopack
- Express 5.1.0 for backend API

## Important Implementation Details

### Null Value Handling
The scrollTimes parameter default value only applies when undefined, not null. Handle null explicitly in API endpoints.

### Performance Optimization
- Text-level HTML processing instead of DOM manipulation for efficiency
- Avoids calling `$('*').toArray()` in loops which causes resource exhaustion

### Task Processing
- Tasks are processed sequentially, not in parallel
- Failed tasks due to empty results are logged but don't crash the processor
- Old tasks are automatically cleaned up hourly