const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');

marked.setOptions({
    gfm: true,
    breaks: true,
});

// Paths
const contentDir = path.join(__dirname, '..', 'content');
const publicDir = path.join(__dirname, '..', 'public');
const templatesDir = path.join(__dirname, 'templates');

// Utility to ensure directory exists
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Function to convert 10-scale rating to CSS class
function getRatingClass(rating) {
    // Default to 0 if rating is undefined or invalid
    if (rating === undefined || rating === null || isNaN(rating)) {
      return 'stars-0';
    }
    
    // Ensure we have a number
    const numRating = parseFloat(rating);
    
    // Validate the range (1-10 scale)
    if (numRating < 0) return 'stars-0';
    if (numRating > 10) return 'stars-50';
    
    // Convert 10-scale to 50-scale for CSS classes
    // Formula: (rating / 10) * 50 = rating * 5
    const scaledRating = Math.round(numRating * 5);
    
    // Return the class name
    return `stars-${scaledRating}`;
  }

// Read a template file
async function readTemplate(name) {
    return await fs.readFile(path.join(templatesDir, `${name}.html`), 'utf-8');
}

// Apply a template with given data
function applyTemplate(template, data) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
        return data[key] !== undefined ? data[key] : match;
    });
}

async function generateAboutPage() {
    try {
        // Read about template
        const aboutTemplate = await readTemplate('about');

        // Apply template with current year
        const html = aboutTemplate.replace(
            /© 2025/g,
            `© ${new Date().getFullYear()}`
        );

        // Write output file
        const outputPath = path.join(publicDir, 'about.html');
        await fs.writeFile(outputPath, html);

        console.log(`Generated: ${outputPath}`);
    } catch (err) {
        console.error('Error generating about page:', err);
    }
}

// Generate all project pages
async function generateProjectPages() {
    // Read project template
    const projectTemplate = await readTemplate('project');

    // Ensure project directory exists
    await ensureDir(path.join(publicDir, 'project'));

    // Read all project directories
    const dirs = await fs.readdir(contentDir, { withFileTypes: true });
    const projectDirs = dirs.filter(dir => dir.isDirectory());

    // Generate a page for each project
    const projects = [];

    for (const dir of projectDirs) {
        try {
            const projectId = dir.name;
            console.log(`Processing project: ${projectId}`);

            // Read metadata and content
            const metadataPath = path.join(contentDir, projectId, 'metadata.json');
            const contentPath = path.join(contentDir, projectId, 'content.md');

            const [metadataContent, markdownContent] = await Promise.all([
                fs.readFile(metadataPath, 'utf-8'),
                fs.readFile(contentPath, 'utf-8')
            ]);

            // Parse metadata and convert markdown
            const metadata = JSON.parse(metadataContent);
            const htmlContent = marked(markdownContent);

            // Store project data for the index page
            projects.push({
                ...metadata,
                id: projectId,
                url: `/project/${projectId}.html`
            });

            // Format date
            const formattedDate = new Date(metadata.date).toLocaleDateString();

            // Format tags
            const tagsHtml = metadata.tags
                .map(tag => `<span class="tag"> | ${tag}</span>`)
                .join('');

            // Apply template
            const html = applyTemplate(projectTemplate, {
                title: metadata.title,
                description: metadata.description,
                date: formattedDate,
                tags: tagsHtml,
                content: htmlContent,
                author: metadata.author || 'Unknown Author'
            });

            // Write output file
            const outputPath = path.join(publicDir, 'project', `${projectId}.html`);
            await fs.writeFile(outputPath, html);

            console.log(`Generated: ${outputPath}`);
        } catch (err) {
            console.error(`Error processing project ${dir.name}:`, err);
        }
    }

    return projects;
}

// Generate the home page
async function generateHomePage(projects) {
    // Sort projects by date (newest first)
    projects.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Read index template
    const indexTemplate = await readTemplate('index');

    // Generate project cards HTML
    let projectCardsHtml = '';
    let showMoreBtn = '';

    // If there are no projects, show an empty state card
    if (projects.length === 0) {
        projectCardsHtml = `
        <div class="project-card">
          <h3>Empty</h3>
          <p>I have not yet posted any book reviews. Check back soon!</p>
        </div>
      `;
    } else {
        // Generate cards for existing projects
        projectCardsHtml = projects.map((project, index) => {
            const isHidden = index >= 6 ? ' hidden' : '';
            
            const tagsHtml = project.tags
              .map(tag => `<span class="tag">${tag}</span>`)
              .join('');
            
            const formattedDate = new Date(project.date).toLocaleDateString();
            
            // Get star rating class from our helper function
            const starRatingClass = getRatingClass(project.rating);
            
            // Convert rating to 5-scale for display
            const displayRating = project.rating ? (project.rating / 2).toFixed(1) : '0.0';
            
            return `
              <div class="project-card${isHidden}" data-index="${index}">
                <a href="${project.url}" class="project-card-link" aria-label="View ${project.title}"></a>
                <h3>${project.title}</h3>
                <p>${project.description}</p>
                <div class="project-footer">
                  <div class="project-tags">
                    ${tagsHtml}
                  </div>
                  <div class="project-meta">
                    <div class="date-display">${formattedDate}</div>
                    <div class="star-rating" aria-label="Rating: ${displayRating} out of 5 stars">
                      <span class="stars ${starRatingClass}"></span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('');

        if (projects.length > 6) {
            showMoreBtn = `
          <div class="show-more-container">
            <a id="showMoreBtn" class="btn">Show More Reviews</a>
          </div>
        `;
        }
    }

    // Apply template
    const html = applyTemplate(indexTemplate, {
        projectCards: projectCardsHtml,
        showMoreBtn: showMoreBtn,
        currentYear: new Date().getFullYear()
    });

    // Write output file
    const outputPath = path.join(publicDir, 'index.html');
    await fs.writeFile(outputPath, html);

    console.log(`Generated: ${outputPath}`);
}


// Copy static assets
async function copyStaticAssets() {
    try {
        // Copy CSS files
        const cssSourceDir = path.join(__dirname, '..', 'src', 'styles');
        const cssDestDir = path.join(publicDir, 'styles');

        await ensureDir(cssDestDir);

        // List of CSS directories to copy
        const cssDirs = [
            'components'
            // 'prism-themes' removed since you don't need Prism
        ];

        // Copy each CSS directory
        for (const dir of cssDirs) {
            const sourceDir = path.join(cssSourceDir, dir);
            const destDir = path.join(cssDestDir, dir);

            await ensureDir(destDir);

            const files = await fs.readdir(sourceDir);
            for (const file of files) {
                if (file.endsWith('.css')) {
                    await fs.copyFile(
                        path.join(sourceDir, file),
                        path.join(destDir, file)
                    );
                }
            }
        }

        // Copy root CSS files
        const rootCssFiles = await fs.readdir(cssSourceDir);
        for (const file of rootCssFiles) {
            const filePath = path.join(cssSourceDir, file);
            const stat = await fs.stat(filePath);

            if (file.endsWith('.css') && !stat.isDirectory()) {
                await fs.copyFile(
                    filePath,
                    path.join(cssDestDir, file)
                );
            }
        }

        // Copy JavaScript files if needed
        const jsSourceDir = path.join(__dirname, '..', 'src', 'js');
        const jsDestDir = path.join(publicDir, 'js');

        try {
            await ensureDir(jsDestDir);

            const jsFiles = await fs.readdir(jsSourceDir);
            for (const file of jsFiles) {
                if (file.endsWith('.js')) {
                    await fs.copyFile(
                        path.join(jsSourceDir, file),
                        path.join(jsDestDir, file)
                    );
                }
            }
        } catch (err) {
            // It's okay if there are no JS files
            console.log('No JS files to copy or JS directory does not exist');
        }

        console.log('Copied static assets');
    } catch (err) {
        console.error('Error copying static assets:', err);
        throw err; // Re-throw to be caught by the main build function
    }
}

// Main build function
async function build() {
    try {
        console.log('Starting build process...');

        await ensureDir(publicDir);

        const projects = await generateProjectPages();

        await generateHomePage(projects);

        await generateAboutPage();

        // Copy static assets
        await copyStaticAssets();

        console.log('Build completed successfully!');
    } catch (err) {
        console.error('Build failed:', err);
        process.exit(1);
    }
}

build();