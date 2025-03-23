# jmassey.net Static Site Generator

A lightweight markdown-based static site generator built with Node.js.

## Structure

```
src/
  ├── templates/         # HTML templates
  ├── styles/            # CSS files
  │   ├── components/    # Component-specific styles
  │   └── prism-themes/  # Syntax highlighting themes
  ├── js/                # JavaScript files
  │   └── prism.js       # Syntax highlighting
  └── build.js           # Build script
content/
  └── [project-id]/      # One directory per project/post
      ├── metadata.json  # Post metadata
      └── content.md     # Markdown content
public/                  # Generated output (gitignored)
```

## Content Structure

### metadata.json

```json
{
  "title": "Post Title",
  "description": "Brief description",
  "date": "2025-03-23",
  "tags": ["Tag1", "Tag2"],
  "status": "published"  // "published" or "draft"
}
```

### content.md

Standard markdown with code blocks supported:

````markdown
# Heading

Content with **bold** and *italic* text.

## Subheading

```javascript
// Code with syntax highlighting
function example() {
  return "Hello world";
}
```

- List item 1
- List item 2
````

## Commands

```bash
# Build the site
npm run build

# Run the site locally
npm run dev
```

## PrismJS Support

Code blocks are automatically highlighted using PrismJS. Specify the language after the opening backticks:

````
```javascript
// JS code
```

```python
# Python code
```

```html
<!-- HTML code -->
```
````

Available languages: All prismjs supported languages
