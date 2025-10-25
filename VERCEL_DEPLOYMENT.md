# 🚀 Vercel Deployment Guide

Complete guide to deploy Snapshoty to production on Vercel.

---

## 📋 Pre-Deployment Checklist

### 1. **Database Setup (Neon)**
- ✅ You already have Neon database
- Your current connection string in `.env`

### 2. **Google OAuth Setup**
**IMPORTANT**: Update OAuth redirect URLs for production!

Go to [Google Cloud Console](https://console.cloud.google.com/):

1. **Add Production URLs**:
   - Authorized JavaScript origins: `https://your-app.vercel.app`
   - Authorized redirect URIs: `https://your-app.vercel.app/api/auth/callback/google`

2. **Get OAuth Credentials**:
   - Client ID
   - Client Secret

### 3. **API Keys**
- ✅ OpenRouter API Key (for Qwen AI)
- ✅ Gemini API Key (optional)

---

## 🎯 Step-by-Step Deployment

### **Step 1: Install Vercel CLI**

```bash
npm install -g vercel
```

### **Step 2: Login to Vercel**

```bash
vercel login
```

### **Step 3: Deploy to Vercel**

```bash
# From your project directory
vercel
```

Follow the prompts:
- **Set up and deploy?** → Yes
- **Which scope?** → Your account
- **Link to existing project?** → No
- **Project name?** → snapshoty (or your choice)
- **Directory?** → `./` (current)
- **Override settings?** → No

### **Step 4: Set Environment Variables**

In your Vercel dashboard or via CLI:

```bash
# Database
vercel env add DATABASE_URL

# NextAuth
vercel env add NEXTAUTH_URL
vercel env add NEXTAUTH_SECRET

# Google OAuth
vercel env add GOOGLE_CLIENT_ID
vercel env add GOOGLE_CLIENT_SECRET

# AI Keys
vercel env add QWEN_API_KEY
vercel env add GEMINI_API_KEY
```

**For each variable**:
- Choose environment: **Production, Preview, Development** (select all 3)
- Paste the value from your `.env` file

### **Step 5: Update Environment Variables**

🔴 **CRITICAL**: Update these values for production:

1. **NEXTAUTH_URL**:
   ```
   https://your-app.vercel.app
   ```
   (Replace with your actual Vercel URL)

2. **NEXTAUTH_SECRET**:
   Generate a new secret for production:
   ```bash
   openssl rand -base64 32
   ```

### **Step 6: Deploy**

```bash
vercel --prod
```

---

## 🔧 Vercel Dashboard Configuration

### **Build Settings** (should be automatic)
- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### **Environment Variables**
All variables from Step 4 should be visible in:
`Settings → Environment Variables`

---

## ✅ Post-Deployment Checks

### 1. **Update Google OAuth**
- Go to your Vercel deployment URL
- Add it to Google Cloud Console OAuth settings:
  - Authorized origins: `https://your-actual-url.vercel.app`
  - Redirect URIs: `https://your-actual-url.vercel.app/api/auth/callback/google`

### 2. **Test Authentication**
- Visit your deployed app
- Try signing in with Google
- Upload a test screenshot

### 3. **Check Database**
- Run migrations if needed:
  ```bash
  npx prisma db push
  ```

---

## 🎨 Custom Domain (Optional)

### Add Custom Domain:
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your domain (e.g., `snapshoty.com`)
3. Follow DNS configuration instructions
4. Update `NEXTAUTH_URL` to your custom domain
5. Update Google OAuth redirect URLs

---

## 🐛 Troubleshooting

### Build Fails
**Error**: Prisma Client not generated
```bash
# Ensure postinstall script runs
npm run postinstall
```

**Error**: Environment variables missing
- Check Vercel dashboard → Environment Variables
- Redeploy: `vercel --prod`

### Authentication Fails
1. Check `NEXTAUTH_URL` matches deployment URL
2. Verify Google OAuth redirect URLs
3. Check `NEXTAUTH_SECRET` is set

### Database Connection Fails
1. Verify `DATABASE_URL` is correct
2. Check Neon database is active
3. Ensure IP allowlist includes Vercel IPs (usually 0.0.0.0/0)

---

## 📊 Monitoring

### Vercel Analytics
- Automatically enabled
- View in: Dashboard → Analytics

### Logs
```bash
# View production logs
vercel logs
```

Or check in Vercel Dashboard → Deployments → [Your Deployment] → Runtime Logs

---

## 🔄 Future Deployments

### Deploy Changes:
```bash
git add .
git commit -m "Your changes"
git push origin main
```

**Vercel auto-deploys** from GitHub/GitLab if connected!

Or manual deploy:
```bash
vercel --prod
```

---

## 🎯 Quick Deploy Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs

# List deployments
vercel ls

# Check environment variables
vercel env ls
```

---

## ✨ Production Best Practices

1. **Environment Variables**: Never commit `.env` to Git
2. **Database Backups**: Enable on Neon
3. **Error Tracking**: Consider Sentry
4. **Monitoring**: Use Vercel Analytics
5. **Custom Domain**: Professional image

---

## 🚨 Important Notes

- ✅ Prisma generates client automatically on build
- ✅ All environment variables must be set in Vercel
- ✅ Google OAuth redirect URIs must include production URL
- ✅ Database connection string should use `?sslmode=require`

---

**You're ready to deploy! 🎉**

Run: `vercel --prod`
