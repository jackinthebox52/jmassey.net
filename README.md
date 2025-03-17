## Deploying to Cloudflare Pages

### Option 1: Direct Upload via Wrangler

1. **Install Wrangler** (if not already installed):
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Deploy your site**:
   ```bash
   npm run deploy
   ```

### Option 2: GitHub Integration (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/jackinthebox52/jaedawilson.net.git
   git push -u origin main
   ```

2. **Setup in Cloudflare Dashboard**:
   - Log in to the Cloudflare dashboard
   - Go to Pages > Create a project > Connect to Git
   - Select your repository
   - Configure your build settings:
     - Build command: `npm run build`
     - Build output directory: `public`
   - Click "Save and Deploy"

3. **Set up custom domain** (optional):
   - In the Cloudflare Pages project settings, go to "Custom domains"
   - Add your domain (e.g., blog.jmassey.net)
   - Follow the instructions to verify domain ownership

## Updating Content

To update your blog content:

1. Add or modify files in the `content/` directory
2. Run `npm run build` to regenerate the static site
3. Deploy the updated site:
   - If using GitHub: commit and push changes (Cloudflare will auto-deploy)
   - If using direct upload: run `npm run deploy`

## Notes on the Migration

- This static approach eliminates the need for server-side Node.js
- No database is required, everything is generated at build time
- The admin interface has been removed (content is updated via file editing)
- Page metrics are no longer tracked
- The site will be much faster and more secure

## Next Steps and Future Improvements

1. **Add a simple CMS** if needed:
   - Consider integrating with Netlify CMS or Forestry for content editing
   - These can be configured to commit changes to your GitHub repository

2. **Add Search functionality**:
   - Look into Cloudflare Workers for simple site search
   - Or client-side solutions like Lunr.js

3. **Add Comments**:
   - Consider third-party comment systems like Disqus or utterances (GitHub Issues)