Static site generators have surged in popularity over the past few years, offering security, performance, and simplicity advantages over traditional dynamic content management systems. This post outlines my approach to building a lightweight, file-based CMS using Markdown, Node.js, and a few JavaScript libraries.

## The Concept

Our static site generator converts content written in Markdown into HTML pages at build time. This approach offers several key advantages:

- **Security**: No database or server-side processing means fewer attack vectors
- **Performance**: Pre-rendered HTML serves lightning-fast with minimal server requirements
- **Simplicity**: Content is stored as plain text files in a standard format
- **Version Control**: Markdown files can be easily tracked in Git
- **Easily Deployed**: The static nature of this site makes it easy to re-deploy upon each Git push using a CI/CD pipeline (Cloudflare Worker)

## How It Works

Our system follows a straightforward process:

1. Content authors write articles in Markdown with a JSON metadata header
2. The build script processes these files and renders them to HTML
3. Templates are applied to create complete, styled pages
4. The result is a folder of static files ready for deployment

The entire build process happens locally or in a CI/CD pipeline, with the resulting static files deployed to any web hosting service.

## Implementation Details

### Content Structure

Each piece of content is stored as a directory with two key files:

```
content/
  └── my-article/
      ├── metadata.json
      └── content.md
```

The `metadata.json` contains information about the content:

```json
{
  "title": "Building a Static Markdown-based CMS",
  "description": "Learn how to build a simple yet powerful static site generator",
  "date": "2025-03-20",
  "tags": ["JavaScript", "Node.js", "Markdown", "Static Site"],
  "status": "published"
}
```

The `content.md` file contains the actual content in Markdown format.

### Markdown Processing

We use [Marked](https://marked.js.org/) to transform Markdown into HTML. Here's how we configure it to work with code syntax highlighting:

```javascript
const { marked } = require('marked');

marked.setOptions({
    highlight: function(code, lang) {
      return code; // Just return the code as is, let PrismJS handle it
    },
    langPrefix: 'language-', // Adds the language- prefix to the class for PrismJS
    gfm: true,
    breaks: true
});
```

### Code Syntax Highlighting

For beautiful code syntax highlighting, we integrate [PrismJS](https://prismjs.com/). This allows content authors to simply write code in markdown with language specifiers:

````markdown
```javascript
// This code will be syntax highlighted
const project = {
  name: "Static Markdown CMS",
  features: ["Fast", "Secure", "Simple"],
  isAwesome: true
};

console.log(`${project.name} is awesome: ${project.isAwesome}`);
```
````

### Template System

We use a lightweight templating approach, with HTML templates containing placeholders:

```html
<div class="project-content">
  {{content}}
</div>
```

Our build script replaces these placeholders with actual content during the build process.
There are many libraries that will do this, with far more features than I've implemented here.

## Example Content

Here's a sample of Markdown content that works well with our system:

````markdown
# Getting Started with JavaScript

JavaScript is a versatile language powering much of the modern web.

## Core Concepts

JavaScript has several fundamental concepts:

- **Variables**: Store data values
- **Functions**: Reusable blocks of code
- **Objects**: Collections of related data

## Example Code

```javascript
// Function declaration
function greet(name) {
  return `Hello, ${name}!`;
}

// Using the function
const message = greet('World');
console.log(message); // Outputs: Hello, World!
```

## Working with DOM

```javascript
document.addEventListener('DOMContentLoaded', () => {
  const button = document.querySelector('#myButton');
  button.addEventListener('click', () => {
    alert('Button clicked!');
  });
});
```
````

## Benefits of Our Approach

This static site generation approach offers several advantages:

1. **Content as Code**: Treat content with the same workflows as code (reviews, versioning)
2. **Simplified Authoring**: My non-techincal girlfriend writes her book reviews in Markdown in the GitHub browser interface and publishes with a single click.
3. **Customizable**: All custom = All extensible
4. **Free Hosting Options**: Deploy to GitHub Pages, Netlify, Vercel, etc.

## Self-Dogfooding

This very website is built using the system described in this post. The entire "posts" section, including this article, is generated from Markdown files and templates at build time.

## Conclusion

Our Markdown-based static CMS provides simplicity and felxibility. It provides a powerful platform for content publishing without the complexity, security concerns, or bloat of traditional CMS platforms.