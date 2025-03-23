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
const ProjectsOutputDir = path.join(publicDir, 'Project');

// Utility to ensure directory exists
async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Utility function to remove files
async function removeFile(filePath) {
    try {
        await fs.unlink(filePath);
        console.log(`Removed: ${filePath}`);
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error(`Error removing file ${filePath}:`, err);
        }
    }
}

// Function to check if a Project should be published
function isPublished(metadata) {
    // Check if the status field exists and is set to "published" (case insensitive)
    if (!metadata.status) {
        // If status field is missing, treat as unpublished
        return false;
    }
    
    // Normalize the status and check if it equals "published"
    return metadata.status.toLowerCase() === 'published';
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

// Clean up old Project files that are no longer in the content directory
async function cleanupOldProjects(currentProjectIds) {
    try {
        // Get list of all files in the Projects output directory
        const files = await fs.readdir(ProjectsOutputDir);
        
        // For each file in the output directory
        for (const file of files) {
            // Only process HTML files
            if (file.endsWith('.html')) {
                const ProjectId = file.replace('.html', '');
                
                // If the Project is not in our current list, remove it
                if (!currentProjectIds.includes(ProjectId)) {
                    await removeFile(path.join(ProjectsOutputDir, file));
                }
            }
        }
    } catch (err) {
        // If directory doesn't exist yet, that's fine
        if (err.code !== 'ENOENT') {
            console.error('Error cleaning up old posts:', err);
        }
    }
}

// Generate all Project pages (formerly project pages)
async function generateProjectPages() {
    // Read project template
    const ProjectTemplate = await readTemplate('project'); // Still using project.html template

    // Ensure Project directory exists
    await ensureDir(ProjectsOutputDir);

    // Read all content directories
    const dirs = await fs.readdir(contentDir, { withFileTypes: true });
    const contentDirs = dirs.filter(dir => dir.isDirectory());

    // Generate a page for each content directory
    const Projects = [];
    const ProjectIds = [];

    for (const dir of contentDirs) {
        try {
            const ProjectId = dir.name;
            ProjectIds.push(ProjectId); // Add to list of current IDs for cleanup later
            console.log(`Processing Project: ${ProjectId}`);

            // Read metadata and content
            const metadataPath = path.join(contentDir, ProjectId, 'metadata.json');
            const contentPath = path.join(contentDir, ProjectId, 'content.md');

            const [metadataContent, markdownContent] = await Promise.all([
                fs.readFile(metadataPath, 'utf-8'),
                fs.readFile(contentPath, 'utf-8')
            ]);

            // Parse metadata and convert markdown
            const metadata = JSON.parse(metadataContent);
            
            // Skip items that aren't published
            if (!isPublished(metadata)) {
                console.log(`Skipping ${ProjectId} - status: ${metadata.status || 'undefined'}`);
                continue;
            }
            
            const htmlContent = marked(markdownContent);

            // Store Project data for the index page
            Projects.push({
                ...metadata,
                id: ProjectId,
                url: `/Project/${ProjectId}.html` // Updated path
            });

            // Format date
            const formattedDate = new Date(metadata.date).toLocaleDateString();

            // Format tags
            const tagsHtml = metadata.tags
                .map(tag => `<span class="tag"> | ${tag}</span>`)
                .join('');

            // Apply template
            const html = applyTemplate(ProjectTemplate, {
                title: metadata.title,
                description: metadata.description,
                date: formattedDate,
                tags: tagsHtml,
                content: htmlContent,
            });

            // Write output file
            const outputPath = path.join(ProjectsOutputDir, `${ProjectId}.html`);
            await fs.writeFile(outputPath, html);

            console.log(`Generated: ${outputPath}`);
        } catch (err) {
            console.error(`Error processing Project ${dir.name}:`, err);
        }
    }

    // Clean up old Project files
    await cleanupOldProjects(ProjectIds);

    return Projects;
}

// Update the generateHomePage function in build.js to add sorting
// Here's the modified function:

async function generateHomePage(Projects) {
    // Sort Projects by date (newest first)
    Projects.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Read index template
    const indexTemplate = await readTemplate('index');

    // Generate Project cards HTML
    let ProjectCardsHtml = '';
    let showMoreBtn = '';
    
    // Add sorting controls HTML
    const sortingControlsHtml = `
    <div class="sorting-controls">
      <div class="sort-options">
        <button class="sort-btn active" data-sort="date">Newest First</button>
      </div>
    </div>
    `;

    // If there are no Projects, show an empty state card
    if (Projects.length === 0) {
        ProjectCardsHtml = `
        <div class="project-card">
          <h3>Empty</h3>
          <p>No posts yet. Check back soon.</p>
        </div>
      `;
    } else {
        // Generate cards for existing Projects
        ProjectCardsHtml = Projects.map((Project, index) => {
            const isHidden = index >= 6 ? ' hidden' : '';
            
            const tagsHtml = Project.tags
              .map(tag => `<span class="tag">${tag}</span>`)
              .join('');
            
            const formattedDate = new Date(Project.date).toLocaleDateString();
            
            // Add data attributes for sorting
            return `
              <div class="project-card${isHidden}" data-index="${index}" data-date="${Project.date}">
                <a href="${Project.url}" class="project-card-link" aria-label="View ${Project.title}"></a>
                <h3>${Project.title}</h3>
                <p>${Project.description}</p>
                <div class="project-footer">
                  <div class="project-tags">
                    ${tagsHtml}
                  </div>
                  <div class="card-meta">
                    <div class="date-display">${formattedDate}</div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('');

        if (Projects.length > 6) {
            showMoreBtn = `
          <div class="show-more-container">
            <a id="showMoreBtn" class="btn">Show More Projects</a>
          </div>
        `;
        }
    }

    // Add JavaScript for sorting
    const sortingScript = `
    <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Get references to sorting elements
      const sortButtons = document.querySelectorAll('.sort-btn');
      const projectsGrid = document.querySelector('.projects-grid');
      const projectCards = Array.from(document.querySelectorAll('.project-card'));
      
      // Store original order for reference
      const originalOrder = [...projectCards];
      
      // Function to sort cards
      function sortCards(sortBy) {
        // Remove all cards from grid
        projectCards.forEach(card => card.remove());
        
        // Sort cards based on criteria
        let sortedCards = [];
        
        if (sortBy === 'date') {
          // Sort by date (newest first)
          sortedCards = [...projectCards].sort((a, b) => {
            const aDate = new Date(a.dataset.date);
            const bDate = new Date(b.dataset.date);
            return bDate - aDate;
          });
        }
        
        // Re-append cards in new order
        sortedCards.forEach((card, index) => {
          projectsGrid.appendChild(card);
          
          // Keep the first 6 visible, hide the rest
          if (index >= 6) {
            card.classList.add('hidden');
          } else {
            card.classList.remove('hidden');
          }
        });
        
        // Reset the "Show More" button if it exists
        const showMoreBtn = document.getElementById('showMoreBtn');
        if (showMoreBtn) {
          showMoreBtn.style.display = '';
        }
      }
      
      // Add click handlers to sort buttons
      sortButtons.forEach(button => {
        button.addEventListener('click', function() {
          // Update active state on buttons
          sortButtons.forEach(btn => btn.classList.remove('active'));
          this.classList.add('active');
          
          // Sort the cards
          sortCards(this.dataset.sort);
        });
      });
      
      // Initialize with original order
      // The initial HTML is already sorted by date
      
      // Keep the original showMoreBtn functionality
      const showMoreBtn = document.getElementById('showMoreBtn');
      if (showMoreBtn) {
        showMoreBtn.addEventListener('click', function() {
          const hiddenCards = document.querySelectorAll('.project-card.hidden');
          hiddenCards.forEach(card => card.classList.remove('hidden'));
          showMoreBtn.style.display = 'none';
        });
      }
    });
    </script>
    `;

    // Apply template
    let html = applyTemplate(indexTemplate, {
        projectCards: ProjectCardsHtml,
        showMoreBtn: showMoreBtn,
        currentYear: new Date().getFullYear()
    });
    
    // Insert sorting controls before the projects-grid div
    html = html.replace('<h2 class="section-title">Posts</h2>', 
        `<div class="section-header">
          <h2 class="section-title">Posts</h2>
          ${sortingControlsHtml}
        </div>`
      );
    
    // Add the sorting script before the closing </body> tag
    html = html.replace('</body>', `${sortingScript}\n</body>`);

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
            for (const file of files) {
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

        const Projects = await generateProjectPages();

        await generateHomePage(Projects);

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