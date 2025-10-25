# Snapshoty - Next.js Version

A modern, AI-powered screenshot management application built with Next.js, featuring intelligent content analysis, smart organization, and learning path generation.

## 🎯 Why Snapshoty?

**The App That Helps You Organize Your Screenshots and Make Them Searchable**

Transform chaotic screenshot collections into an organized, AI-powered knowledge base.

## 🌟 What is Snapshoty?

- **AI-Powered Analysis**: Automatically extract text, concepts, and insights from screenshots using Qwen Vision API
- **Smart Organization**: Organize screenshots into folders with AI-generated metadata
- **Learning Paths**: Generate structured learning paths from your screenshot collections using Gemini AI
- **Powerful Search**: Find any screenshot instantly with full-text and semantic search
- **Google Authentication**: Secure login with Google OAuth
- **Modern UI**: Beautiful, responsive interface built with Tailwind CSS and shadcn/ui
- **Export**: Export your notes to Markdown format

## 📋 Prerequisites

- Node.js 18.0 or higher
- npm or yarn package manager
- Google OAuth credentials
- Qwen API key (for AI processing)
- Gemini API key (optional, for learning paths)

## 🛠️ Installation

1. **Clone the repository**
```bash
cd snapshoty-nextjs
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

Then edit `.env` with your credentials:
```env
# Database
DATABASE_URL_NEON="file:./snapshoty.db"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"  # Generate with: openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI APIs
QWEN_API_KEY="your-qwen-api-key"
GEMINI_API_KEY="your-gemini-api-key"  # Optional
```

4. **Initialize the database**
```bash
npm run db:push
npm run db:generate
```

5. **Run the development server**
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## 🔑 Getting API Keys

### Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add `http://localhost:3000/api/auth/callback/google` to authorized redirect URIs
6. Copy the Client ID and Client Secret

### Qwen API Key
1. Visit [Alibaba Cloud DashScope](https://dashscope.aliyun.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key for Qwen-VL model

### Gemini API Key (Optional)
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Generate an API key

## 📦 Building for Production

1. **Build the application**
```bash
npm run build
```

2. **Start the production server**
```bash
npm run start
```

## 🗂️ Project Structure

```
snapshoty-nextjs/
├── src/
│   ├── app/               # Next.js app router pages
│   │   ├── api/           # API routes
│   │   ├── auth/          # Authentication pages
│   │   └── page.tsx       # Main dashboard
│   ├── components/        # React components
│   │   ├── ui/           # shadcn/ui components
│   │   └── dashboard.tsx # Main dashboard component
│   ├── lib/              # Utility functions and libraries
│   │   ├── ai/          # AI processing utilities
│   │   ├── auth.ts      # NextAuth configuration
│   │   └── db.ts        # Database client
│   ├── hooks/           # Custom React hooks
│   └── types/           # TypeScript type definitions
├── prisma/
│   └── schema.prisma    # Database schema
├── public/
│   └── uploads/         # Uploaded screenshots
└── package.json
```

## 🛠️ Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:push` - Push database schema changes
- `npm run db:studio` - Open Prisma Studio
- `npm run db:generate` - Generate Prisma client

## 🔄 Migration from FastAPI

This is a complete Next.js reimplementation of the original FastAPI **Snapshoty solves these problems with:**
- Same features and functionality
- Modern React-based frontend
- Type-safe API routes with TypeScript
- Prisma ORM instead of raw SQLite
- NextAuth for authentication
- Tailwind CSS and shadcn/ui for styling

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL_NEON` | SQLite database path | Yes |
| `NEXTAUTH_URL` | NextAuth callback URL | Yes |
| `NEXTAUTH_SECRET` | NextAuth encryption secret | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `QWEN_API_KEY` | Qwen Vision API key | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Optional |

## 🐛 Troubleshooting

### Database Issues
If you encounter database errors:
```bash
rm -f snapnotes.db
npm run db:push
```

### Authentication Issues
- Ensure your Google OAuth redirect URI matches your NEXTAUTH_URL
- Regenerate NEXTAUTH_SECRET if authentication fails

### Upload Issues
- Check that the `public/uploads` directory exists and is writable
- Verify file size limits in `next.config.js`

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
