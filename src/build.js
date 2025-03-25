const fs = require('fs').promises;
const path = require('path');
const { marked } = require('marked');


marked.setOptions({
  highlight: function (code, lang) {
    return code; // Just return the code as is, let PrismJS handle it
  },
  langPrefix: 'language-', // Adds the language- prefix to the class for PrismJS
  gfm: true,
  breaks: true
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

// Function to get header HTML with active page highlighting
async function getHeaderHTML(activePage) {
  const headerTemplate = await readTemplate('header');

  let homeActive = '';
  let aboutActive = '';

  // Set active class based on the current page
  if (activePage === 'home') {
    homeActive = 'class="active"';
  } else if (activePage === 'about') {
    aboutActive = 'class="active"';
  } else if (activePage === 'project') {
    // Projects don't have active nav, but you could add a Projects nav item if desired
  }

  return headerTemplate
    .replace('{{homeActive}}', homeActive)
    .replace('{{aboutActive}}', aboutActive);
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

    // Get header with about page active
    const headerHTML = await getHeaderHTML('about');

    // Apply template with current year and header
    const html = aboutTemplate
      .replace(/© 2025/g, `© ${new Date().getFullYear()}`)
      .replace('{{header}}', headerHTML);

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
  const ProjectTemplate = await readTemplate('project');

  const headerHTML = await getHeaderHTML('project');

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
        url: `/Project/${ProjectId}.html`
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
        header: headerHTML
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

  const indexTemplate = await readTemplate('index');

  const headerHTML = await getHeaderHTML('home');

  // Generate Project cards HTML
  let ProjectCardsHtml = '';
  let showMoreBtn = '';

  const sortingControlsHtml = `
  <div class="sorting-controls">
    <button id="sortToggleBtn" class="sort-btn" data-sort="newest">
      Newest <span class="sort-arrow">↓</span>
    </button>
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

  // Replace the sorting script section in the generateHomePage function
  const sortingScript = `
<script>
document.addEventListener('DOMContentLoaded', function() {
  // Get references to sorting elements
  const sortToggleBtn = document.getElementById('sortToggleBtn');
  const projectsGrid = document.querySelector('.projects-grid');
  const projectCards = Array.from(document.querySelectorAll('.project-card'));
  
  // Function to sort cards
  function sortCards(sortBy) {
    // Remove all cards from grid
    projectCards.forEach(card => card.remove());
    
    // Sort cards based on criteria
    let sortedCards = [];
    
    if (sortBy === 'newest') {
      // Sort by date (newest first)
      sortedCards = [...projectCards].sort((a, b) => {
        const aDate = new Date(a.dataset.date);
        const bDate = new Date(b.dataset.date);
        return bDate - aDate;
      });
      
      // Update button text and arrow
      sortToggleBtn.innerHTML = 'Newest <span class="sort-arrow">↓</span>';
      sortToggleBtn.dataset.sort = 'newest';
    } else {
      // Sort by date (oldest first)
      sortedCards = [...projectCards].sort((a, b) => {
        const aDate = new Date(a.dataset.date);
        const bDate = new Date(b.dataset.date);
        return aDate - bDate;
      });
      
      // Update button text and arrow
      sortToggleBtn.innerHTML = 'Oldest <span class="sort-arrow">↑</span>';
      sortToggleBtn.dataset.sort = 'oldest';
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
  
  // Add click handler to toggle button
  sortToggleBtn.addEventListener('click', function() {
    // Toggle between newest and oldest
    const currentSort = this.dataset.sort;
    const newSort = currentSort === 'newest' ? 'oldest' : 'newest';
    
    // Sort the cards
    sortCards(newSort);
  });
  
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

  // Further down in the function, add this to your template application:
  let html = applyTemplate(indexTemplate, {
    projectCards: ProjectCardsHtml,
    showMoreBtn: showMoreBtn,
    currentYear: new Date().getFullYear(),
    header: headerHTML
  });

  // Insert sorting controls before the projects-grid div
  html = html.replace('<h2 class="section-title"></h2>',
    `<div class="section-header">
          <h2 class="section-title"></h2>
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

async function copyStaticAssets() {
  try {
    // Copy CSS files
    const cssSourceDir = path.join(__dirname, '..', 'src', 'styles');
    const cssDestDir = path.join(publicDir, 'styles');

    await ensureDir(cssDestDir);

    // List of CSS directories to copy
    const cssDirs = [
      'components',
      'prism-themes' // Added prism-themes directory
    ];

    // Copy each CSS directory
    for (const dir of cssDirs) {
      const sourceDir = path.join(cssSourceDir, dir);
      const destDir = path.join(cssDestDir, dir);

      await ensureDir(destDir);

      try {
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
          if (file.endsWith('.css')) {
            await fs.copyFile(
              path.join(sourceDir, file),
              path.join(destDir, file)
            );
          }
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`Error reading directory ${sourceDir}:`, err);
        } else {
          console.log(`Directory ${dir} doesn't exist, skipping`);
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

    // Copy JavaScript files
    const jsSourceDir = path.join(__dirname, '..', 'src', 'js');
    const jsDestDir = path.join(publicDir, 'js');

    try {
      await ensureDir(jsDestDir);

      const jsFiles = await fs.readdir(jsSourceDir);
      for (const file of jsFiles) { // Fixed variable name from 'files' to 'jsFiles'
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