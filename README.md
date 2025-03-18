# How to Add a New Book Review Post

This guide will walk you through adding a new book review to the website directly from GitHub's web interface. No coding experience or special software needed!

## Step 1: Go to the Content Directory

1. Ensure that you are logged into a GitHub account with access to modify the repository
2. Visit the repository at: [https://github.com/jackinthebox52/jaedawilson.net](https://github.com/jackinthebox52/jaedawilson.net) 
3. Click on the "content" folder to navigate into it

## Step 2: Create a New Folder for Your Book Review

1. Click the "Add file" button near the top right of the page
2. Select "Create new file" from the dropdown

![Add file button](https://i.imgur.com/KdqGYi1.png)

3. In the "Name your file..." field, type the folder name followed by a forward slash:
   - Example: `the-great-gatsby/` 
   - Use lowercase letters and hyphens instead of spaces (e.g., "the-great-gatsby" not "The Great Gatsby")
   - The name is not extremely important, but should closely match the book title for organization purposes. If the book has a name which could be duplicated by other books, consider adding the authors last name to the folder (e.g. wise-men-isaacson)

4. After typing the folder name with the slash, GitHub will update to show you're creating a file inside a new folder
5. Now add `metadata.json` to the field, so it shows something like: `the-great-gatsby/metadata.json`

## Step 3: Add the Metadata File

In the large text area, add the book review's metadata in JSON format. Ensure that commas, quotes, brackets etc. remain consistent. Groups of string surrounded by brackets such as the "tags" section may be of any length, as long as you add a command and hit enter for newline, you may add as many tags as youd like, or even delete them all. I beleive that each data point is requried. Ensure that the "Status" parameter is set to published. Below is an example metadata.json file, you can copy/paste the json below and edit it to match the new book:  

```json
{
    "title": "The Great Gatsby",
    "description": "A powerful exploration of the American Dream through the eyes of mysterious millionaire Jay Gatsby and his obsession with Daisy Buchanan.",
    "date": "2023-07-15",
    "tags": [
        "Fiction",
        "Classic",
        "American Literature"
    ],
    "author": "F. Scott Fitzgerald",
    "rating": 9,
    "status": "Published"
}
```

Customize the information for your book:
- `title`: The book's title
- `description`: A brief summary or your thoughts (1-2 sentences)
- `date`: Today's date in YYYY-MM-DD format
- `tags`: Categories for the book (Fiction, Non-fiction, Mystery, etc.)
- `author`: The book's author
- `rating`: Your rating out of 10 with a granularity of 0.1 (Will be displayed as stars out of 5)
- `status`: Keep this as "Published". If you want to do drafts before publishing, then set to "Hidden" and change the status to "Published" once you're ready.

## Step 4: Commit the Metadata File

1. Scroll down to the "Commit new file" section
2. In the first field, type a brief message like: "Add metadata for The Great Gatsby review" (This part is optional, write whatever you'd like.)
3. Leave the default "Commit directly to the main branch" option selected
4. Click the green "Commit new file" button

## Step 5: Add the Content File

1. Navigate back to your new folder by clicking on its name in the file path at the top
2. Click the "Add file" button again and select "Create new file"
3. Name this file `content.md`
4. In the text area, add your review in Markdown format

This is markdown. Markdown has serveral formatting options, two of which are used in the below template (Ignore the quotes):
"# TEXT HERE" or "## TEXT HERE" will create different sized headings, which are larger pieces of text for things like titles.
"> TEXT HERE" Italicizes the text and shows the carat symbol, which is useful for things like character quotes. See the [markdown guide](https://www.markdownguide.org/basic-syntax/) for more.

Here's a template to get you started:

```markdown
## Summary
The Great Gatsby tells the story of eccentric millionaire Jay Gatsby and his obsession with the beautiful Daisy Buchanan. Set in the Roaring Twenties, the novel explores themes of wealth, class, love, and the American Dream.

## My Thoughts
I found Fitzgerald's writing to be elegant and evocative, perfectly capturing the Jazz Age's extravagance and emptiness. Gatsby is a fascinating character whose tragic flaws make him both sympathetic and frustrating.

## What I Liked
- The vivid descriptions of lavish parties
- The complex, flawed characters
- The beautiful, poetic prose
- The exploration of the darker side of the American Dream

## What I Didn't Like
- Some secondary characters felt underdeveloped
- The pacing slowed in the middle sections

## Favorite Quotes
> "So we beat on, boats against the current, borne back ceaselessly into the past."

> "I hope she'll be a fool -- that's the best thing a girl can be in this world, a beautiful little fool."

```

Customize this template with your own review! You can learn more about Markdown formatting at [Markdown Guide](https://www.markdownguide.org/basic-syntax/). There are many cool features of markdown that will make your reviews look beautiful like yourself.

## Step 6: Commit the Content File

1. Scroll down to the "Commit new file" section
2. In the first field, type a message like: "Add content for The Great Gatsby review"
3. Leave the "Commit directly to the main branch" option selected
4. Click the green "Commit new file" button

## Step 7: Check Your Work

After committing both files:
1. Make sure your folder contains both `metadata.json` and `content.md`
2. The website will automatically update within a few minutes

## Example: Complete Book Review Folder Structure

When you're done, you should have a folder structure like this:

```
content/
└── the-great-gatsby/
    ├── metadata.json
    └── content.md
```

## Need Help?

If you run into any issues, you can:
1. Check the [Markdown Guide](https://www.markdownguide.org/cheat-sheet/) for formatting help
2. Contact Jaeda for assistance with GitHub

Happy reviewing!