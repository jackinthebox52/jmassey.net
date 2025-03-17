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
                .map(tag => `<span class="tag">${tag}</span>`)
                .join('');

            // Apply template
            const html = applyTemplate(projectTemplate, {
                title: metadata.title,
                description: metadata.description,
                date: formattedDate,
                tags: tagsHtml,
                content: htmlContent
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
    const projectCardsHtml = projects.map((project, index) => {
        const isHidden = index >= 5 ? ' hidden' : '';

        const tagsHtml = project.tags
            .map(tag => `<span class="tag">${tag}</span>`)
            .join('');

        const formattedDate = new Date(project.date).toLocaleDateString();

        return `
      <div class="project-card${isHidden}" data-index="${index}">
        <h3>${project.title}</h3>
        <p>${project.description}</p>
        <div class="project-tags">
          ${tagsHtml}
        </div>
        <div class="project-meta">
          <span>${formattedDate}</span>
          <a href="${project.url}" class="btn">Learn More</a>
        </div>
      </div>
    `;
    }).join('');

    // Generate show more button if needed
    const showMoreBtn = projects.length > 5 ? `
    <div class="show-more-container">
      <button id="showMoreBtn" class="btn">Show More Projects</button>
    </div>
  ` : '';

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