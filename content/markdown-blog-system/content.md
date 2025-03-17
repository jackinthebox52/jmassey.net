# Building a Markdown Based Content Management System
When designing my developer portfolio, I searched for a lightweight, up-to-date CMS system to host my project write-ups. As I enjoy recreating the wheel, and despise platforms like wordpress, I decided to make my own. How hard could it be? Turns out, It's very simple. Thanks to a library called [marked](https://github.com/markedjs/marked), I can write my posts in Markdown and have them rendered as custom styled HTML on the fly, allowing me to quickly write new posts and update old ones. Although I came up with this idea myself on the toilet, there are plenty of projects out there using the same concept (See [tina.io](https://tina.io/) for example).

## The Core Concept

The idea is simple: each project/blog post consists of two files:
- A JSON file containing metadata (title, date, tags, etc.)
- A Markdown file containing the actual content

```
pages/
├── project1.json
├── project1.md
├── project2.json
└── project2.md
```

This structure provides several advantages:
- Version control friendly
- Can write and edit posts casually
- No database required
- Clear separation of content and metadata

## Technical Implementation

The system is built on Node.js with Express, using the `marked` package for Markdown rendering. Here's how it works:

### 1. Project Index Generation

The homepage dynamically loads project cards from the JSON files:

```javascript
async function getProjectsData() {
    const pagesDir = path.join(__dirname, 'pages');
    const files = await fs.readdir(pagesDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));
    
    const projectsData = await Promise.all(jsonFiles.map(async jsonFile => {
        const jsonContent = await fs.readFile(
            path.join(pagesDir, jsonFile), 
            'utf-8'
        );
        return {
            ...JSON.parse(jsonContent),
            id: jsonFile.replace('.json', ''),
            url: `/project/${jsonFile.replace('.json', '')}`
        };
    }));

    return projectsData.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );
}
```

### 2. Dynamic Page Generation

When a visitor clicks on a project, the server:
1. Loads the JSON metadata
2. Loads and converts the Markdown content
3. Injects both into an HTML template

```javascript
app.get('/project/:id', async (req, res) => {
    const projectId = req.params.id;
    const [jsonContent, markdownContent] = await Promise.all([
        fs.readFile(`pages/${projectId}.json`, 'utf-8'),
        fs.readFile(`pages/${projectId}.md`, 'utf-8')
    ]);

    const projectData = JSON.parse(jsonContent);
    const htmlContent = marked.parse(markdownContent);

    // Inject into HTML template...
});
```

## Styling and Layout

I maintained consistency across the site using CSS variables:

```css
:root {
    --primary-dark: #6b9080;
    --secondary-dark: #a4c3b2;
    --mint-green: #cce3de;
    --primary-background: #eaf4f4;
    --primary-background: #f6fff8;
}
```

Project pages follow a standard layout:
1. Navigation header
2. Project metadata section (title, date, tags)
3. Markdown content
4. Footer

## Progressive Enhancement

I added some quality-of-life features:
- Show/hide functionality for project cards (showing only 5 initially)
- Automatic sorting by date
- Responsive design
- Syntax highlighting for code blocks

```javascript
const showMoreButton = projects.length > 5 ? `
    <div class="show-more-container">
        <button id="showMoreBtn" class="btn">
            Show More Projects
        </button>
    </div>
` : '';
```

## Challenges and Solutions

### Markdown Parsing Issues

Initially, I ran into issues with the `marked` package's new module format. The solution was to update the import statement:

```javascript
// Old way (didn't work)
const marked = require('marked');

// New way (works)
const { marked } = require('marked');
```

### File Organization

I debated between two structures:
1. Flat structure (all files in `pages/`)
2. Nested structure (each project in its own directory)

I chose the flat structure for simplicity, but the code could easily be modified to support nested directories if needed.

## Future Improvements

I'm considering several enhancements:
1. Image optimization pipeline
2. RSS feed generation
3. Tag-based filtering
4. Search functionality
5. Comment system (possibly using GitHub Issues)

## Conclusion

This system provides exactly what I needed: a simple, maintainable way to manage project posts without the overhead of a CMS or database. The combination of JSON for metadata and Markdown for content strikes a perfect balance between flexibility and simplicity.

The entire system is open source and available on my GitHub. Feel free to use it as inspiration for your own projects!

Pro tip: When writing posts, I use VS Code with the Markdown Preview extension, which makes it easy to see how the post will look while writing it.