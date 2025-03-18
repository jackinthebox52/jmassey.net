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
const reviewsOutputDir = path.join(publicDir, 'review'); // Changed from 'project' to 'review'

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

// Function to check if a review should be published
function isPublished(metadata) {
    // Check if the status field exists and is set to "published" (case insensitive)
    if (!metadata.status) {
        // If status field is missing, treat as unpublished
        return false;
    }
    
    // Normalize the status and check if it equals "published"
    return metadata.status.toLowerCase() === 'published';
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

// Clean up old review files that are no longer in the content directory
async function cleanupOldReviews(currentReviewIds) {
    try {
        // Get list of all files in the reviews output directory
        const files = await fs.readdir(reviewsOutputDir);
        
        // For each file in the output directory
        for (const file of files) {
            // Only process HTML files
            if (file.endsWith('.html')) {
                const reviewId = file.replace('.html', '');
                
                // If the review is not in our current list, remove it
                if (!currentReviewIds.includes(reviewId)) {
                    await removeFile(path.join(reviewsOutputDir, file));
                }
            }
        }
    } catch (err) {
        // If directory doesn't exist yet, that's fine
        if (err.code !== 'ENOENT') {
            console.error('Error cleaning up old reviews:', err);
        }
    }
}

// Generate all review pages (formerly project pages)
async function generateReviewPages() {
    // Read project template
    const reviewTemplate = await readTemplate('project'); // Still using project.html template

    // Ensure review directory exists
    await ensureDir(reviewsOutputDir);

    // Read all content directories
    const dirs = await fs.readdir(contentDir, { withFileTypes: true });
    const contentDirs = dirs.filter(dir => dir.isDirectory());

    // Generate a page for each content directory
    const reviews = [];
    const reviewIds = [];

    for (const dir of contentDirs) {
        try {
            const reviewId = dir.name;
            reviewIds.push(reviewId); // Add to list of current IDs for cleanup later
            console.log(`Processing review: ${reviewId}`);

            // Read metadata and content
            const metadataPath = path.join(contentDir, reviewId, 'metadata.json');
            const contentPath = path.join(contentDir, reviewId, 'content.md');

            const [metadataContent, markdownContent] = await Promise.all([
                fs.readFile(metadataPath, 'utf-8'),
                fs.readFile(contentPath, 'utf-8')
            ]);

            // Parse metadata and convert markdown
            const metadata = JSON.parse(metadataContent);
            
            // Skip items that aren't published
            if (!isPublished(metadata)) {
                console.log(`Skipping ${reviewId} - status: ${metadata.status || 'undefined'}`);
                continue;
            }
            
            const htmlContent = marked(markdownContent);

            // Store review data for the index page
            reviews.push({
                ...metadata,
                id: reviewId,
                url: `/review/${reviewId}.html` // Updated path
            });

            // Format date
            const formattedDate = new Date(metadata.date).toLocaleDateString();

            // Format tags
            const tagsHtml = metadata.tags
                .map(tag => `<span class="tag"> | ${tag}</span>`)
                .join('');

            // Apply template
            const html = applyTemplate(reviewTemplate, {
                title: metadata.title,
                description: metadata.description,
                date: formattedDate,
                tags: tagsHtml,
                content: htmlContent,
                author: metadata.author || 'Unknown Author'
            });

            // Write output file
            const outputPath = path.join(reviewsOutputDir, `${reviewId}.html`);
            await fs.writeFile(outputPath, html);

            console.log(`Generated: ${outputPath}`);
        } catch (err) {
            console.error(`Error processing review ${dir.name}:`, err);
        }
    }

    // Clean up old review files
    await cleanupOldReviews(reviewIds);

    return reviews;
}

// Update the generateHomePage function in build.js to add sorting
// Here's the modified function:

async function generateHomePage(reviews) {
    // Sort reviews by date (newest first)
    reviews.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Read index template
    const indexTemplate = await readTemplate('index');

    // Generate review cards HTML
    let reviewCardsHtml = '';
    let showMoreBtn = '';
    
    // Add sorting controls HTML
    const sortingControlsHtml = `
    <div class="sorting-controls">
      <div class="sort-options">
        <button class="sort-btn active" data-sort="date">Newest First</button>
        <button class="sort-btn" data-sort="rating">Highest Rating</button>
      </div>
    </div>
    `;

    // If there are no reviews, show an empty state card
    if (reviews.length === 0) {
        reviewCardsHtml = `
        <div class="project-card">
          <h3>Empty</h3>
          <p>I have not yet posted any book reviews. Check back soon!</p>
        </div>
      `;
    } else {
        // Generate cards for existing reviews
        reviewCardsHtml = reviews.map((review, index) => {
            const isHidden = index >= 6 ? ' hidden' : '';
            
            const tagsHtml = review.tags
              .map(tag => `<span class="tag">${tag}</span>`)
              .join('');
            
            const formattedDate = new Date(review.date).toLocaleDateString();
            
            // Get star rating class from our helper function
            const starRatingClass = getRatingClass(review.rating);
            
            // Convert rating to 5-scale for display
            const displayRating = review.rating ? (review.rating / 2).toFixed(1) : '0.0';
            
            // Add data attributes for sorting
            return `
              <div class="project-card${isHidden}" data-index="${index}" data-date="${review.date}" data-rating="${review.rating}">
                <a href="${review.url}" class="project-card-link" aria-label="View ${review.title}"></a>
                <h3>${review.title}</h3>
                <p>${review.description}</p>
                <div class="project-footer">
                  <div class="project-tags">
                    ${tagsHtml}
                  </div>
                  <div class="card-meta">
                    <div class="date-display">${formattedDate}</div>
                    <div class="star-rating" aria-label="Rating: ${displayRating} out of 5 stars">
                      <span class="stars ${starRatingClass}"></span>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('');

        if (reviews.length > 6) {
            showMoreBtn = `
          <div class="show-more-container">
            <a id="showMoreBtn" class="btn">Show More Reviews</a>
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
        } else if (sortBy === 'rating') {
          // Sort by rating (highest first)
          sortedCards = [...projectCards].sort((a, b) => {
            const aRating = parseFloat(a.dataset.rating);
            const bRating = parseFloat(b.dataset.rating);
            return bRating - aRating;
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
        projectCards: reviewCardsHtml,
        showMoreBtn: showMoreBtn,
        currentYear: new Date().getFullYear()
    });
    
    // Insert sorting controls before the projects-grid div
    html = html.replace('<h2 class="section-title">Book Reviews</h2>', 
        `<div class="section-header">
          <h2 class="section-title">Book Reviews</h2>
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

        const reviews = await generateReviewPages();

        await generateHomePage(reviews);

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