# Clever Profits HR Dashboard

An employee management dashboard powered by BambooHR API, built with Next.js and styled in Clever Profits brand colors.

## Features

- View all employees with key details (name, hire date, department, birth date, salary)
- Filter by department and location
- Search employees by name
- Sortable columns
- Responsive design
- Real-time data from BambooHR

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure BambooHR Credentials

Create a `.env.local` file in the root directory:

```env
BAMBOO_API_KEY=your_api_key_here
BAMBOO_SUBDOMAIN=your_company_subdomain
```

**To get your BambooHR API key:**
1. Log in to BambooHR
2. Go to Settings (gear icon) → API Keys
3. Click "Add New Key"
4. Copy the generated key

**Your subdomain** is the part before `.bamboohr.com` in your BambooHR URL (e.g., if your URL is `acme.bamboohr.com`, your subdomain is `acme`).

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## Deploy to Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel:
   - `BAMBOO_API_KEY`
   - `BAMBOO_SUBDOMAIN`
4. Deploy

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- BambooHR API

## Brand Colors

- Primary Dark: #040B4D
- Text Blue: #1F31D8
- Accent Cyan: #0693e3
- Purple: #9b51e0
- Light Gray: #EFEFEF
