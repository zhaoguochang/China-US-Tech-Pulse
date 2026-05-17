# Global Tech Pulse (全球科技脉搏)

Strategic Insight Bridge: Mapping Tech Trends between China and the US with AI.

## 🚀 Features
- **Real-time Pulse**: Aggregates top tech news feeds from major US and Chinese media.
- **AI Analysis**: Uses Gemini 3.0 to extract keywords, trend scores, and provide strategic summaries.
- **Data Visualization**: Comparison charts using Recharts for visual trend analysis.
- **Data Portability**: Export keyword data as CSV for further research.
- **Bilingual Interface**: Seamlessly switch between Chinese and English.

## 🛠️ Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Framer Motion, html2canvas.
- **Backend**: Express (Node.js), RSS Parser.
- **AI Engine**: Google Gemini 3.0 API.

## 📦 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/global-tech-pulse.git
   cd global-tech-pulse
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Create a `.env` file in the root directory:
   ```env
   GEMINI_API_KEY=your_actual_api_key_here
   ```

### Development
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

### Production Build
```bash
npm run build
npm start
```

## 🏗️ Architecture & Data Pipeline

The application operates as a real-time aggregator and analyst.

### 1. Data Acquisition (RSS)
The system fetches live headlines from a curated list of top-tier US and Chinese technology media outlets using **RSS feeds**.
- **US Sources**: TechCrunch, The Verge, Wired, Engadget, etc.
- **CN Sources**: 36Kr, ITHome, PingWest, TMTPost, etc.

### 2. Time Window Constraints
**Important**: RSS feeds typically only persist the most recent 20-50 articles (roughly 1 to 3 days of news). 
- The "Last 24h" and "Last 3d" options provide the most accurate mapping.
- For analysis spanning weeks or months, a persistent database (e.g., PostgreSQL or Firestore) and a scheduled cron-job "crawler" would be required to archive data daily.

### 3. AI Processing
Articles are deduplicated and passed to the **Gemini 3.0 Flash** model to:
- Identify recurring themes.
- Calculate importance scores based on media volume and topic gravity.
- Generate bilingual summaries.

## 📝 License
MIT License

## 👤 Author
**Guochang Zhao**
- Email: guochang.zhao81@gmail.com
- Project Link: [https://github.com/your-username/global-tech-pulse](https://github.com/your-username/global-tech-pulse)
