# Static Blog Deployment Guide for Cloudflare Pages

This guide walks through converting your current Node.js blog into a static site and deploying it to Cloudflare Pages.

## Project Structure

```
blog-jmasseynet-cf/
├── content/                    # Your Markdown and JSON content
│   ├── mail-detector/          
│   │   ├── metadata.json
│   │   └── content.md
│   └── markdown-blog-system/
│       ├── metadata.json
│       └── content.md
├── public/                     # Built static site (generated)
├── src/
│   ├── build.js                # Static site generator script
│   ├── styles/                 # CSS files (copy from your current views/styles)
│   │   ├── components/
│   │   │   ├── header.css
│   │   │   ├── project-card.css
│   │   │   └── ...
│   │   ├── shared.css
│   │   └── ...
│   ├── js/                     # JavaScript files
│   │   └── prism.js            # Copy from node_modules/prismjs
│   └── templates/              # HTML templates
│       ├── index.html          # Home page template
│       ├── project.html        # Project page template
│       └── about.html          # About page template
├── package.json
└── README.md
```

## Setup Steps

1. **Create the project structure**:
   ```bash
   mkdir -p blog-jmasseynet-cf/{content,public,src/{styles,js,templates}}
   ```

2. **Copy your existing content**:
   ```bash
   # Copy your existing content
   cp -r /path/to/blog-jmasseynet/data/pages/* blog-jmasseynet-cf/content/
   
   # Copy CSS files
   cp -r /path/to/blog-jmasseynet/views/styles/* blog-jmasseynet-cf/src/styles/
   ```

3. **Create the necessary files**:
   - Create `src/build.js` (as provided in this guide)
   - Create template files in `src/templates/`
   - Create `package.json`

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Build the site**:
   ```bash
   npm run build
   ```

6. **Test locally**:
   ```bash
   npm run dev
   ```

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
   git remote add origin https://github.com/yourusername/blog-jmasseynet.git
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