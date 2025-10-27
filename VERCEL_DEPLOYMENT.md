# 🚀 Vercel Deployment Guide (GitHub Route)

Complete guide to deploy Snapshoty to production on Vercel via GitHub.

---

## 📋 Pre-Deployment Checklist

### 1. **Database Setup (Neon)**
- ✅ You already have Neon database
- Your current connection string in `.env`

### 2. **Google OAuth Setup**
**IMPORTANT**: Update OAuth redirect URLs for production!

Go to [Google Cloud Console](https://console.cloud.google.com/):

1. **Add Production URLs** (update after deployment):
   - Authorized JavaScript origins: `https://your-app.vercel.app`
   - Authorized redirect URIs: `https://your-app.vercel.app/api/auth/callback/google`

2. **Get OAuth Credentials**:
   - Client ID
   - Client Secret

### 3. **API Keys**
- ✅ OpenRouter API Key (for Qwen AI)
- ✅ Gemini API Key (optional)

---

## 🎯 GitHub → Vercel Deployment (Recommended)

### **Step 1: Push to GitHub**

```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Ready for production deployment"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/snapshoty.git
git branch -M main
git push -u origin main
```

### **Step 2: Connect to Vercel**

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Click **"Import Git Repository"**
4. Select your GitHub repository: `snapshoty`

### **Step 3: Configure Project**

Vercel will auto-detect Next.js. Verify settings:

- **Framework Preset**: Next.js ✅
- **Root Directory**: `./`
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)

Click **"Deploy"** (will fail without env vars - that's OK!)

### **Step 4: Add Environment Variables**

In Vercel Dashboard → Your Project → Settings → Environment Variables:

Add these variables for **Production** environment:

| Variable | Value | Source |
|----------|-------|--------|
| `DATABASE_URL_NEON` | Your Neon PostgreSQL URL | From `.env` |
| `NEXTAUTH_URL` | `https://your-app.vercel.app` | Update after first deploy |
| `NEXTAUTH_SECRET` | Generate new: `openssl rand -base64 32` | New for production |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID | From `.env` |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret | From `.env` |
| `QWEN_API_KEY` | Your OpenRouter API Key | From `.env` |
| `GEMINI_API_KEY` | Your Gemini API Key | From `.env` |

### **Step 5: Redeploy**

After adding environment variables:

1. Go to **Deployments** tab
2. Click **"..."** on the latest deployment
3. Click **"Redeploy"**

OR just push a new commit:
```bash
git commit --allow-empty -m "Trigger deployment"
git push
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
1. Verify `DATABASE_URL_NEON` is correct
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

## 🔄 Future Deployments (Auto-Deploy!)

### That's the beauty of GitHub → Vercel:

**Just push to GitHub, Vercel auto-deploys!** 🎉

```bash
# Make your changes
git add .
git commit -m "Your changes"
git push origin main
```

Vercel will:
- ✅ Automatically detect the push
- ✅ Build your app
- ✅ Deploy to production
- ✅ Send you a notification

**No manual deployment needed!**

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
