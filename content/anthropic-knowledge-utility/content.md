NOTE: Anthropic has created a Github integration that can serve a similar purpose to this tool. You may want to check that out first, as this isnt a polished tool.

## What's the Problem?

If you've spent any time using Claude's web interface, you've probably gone through this dance:

1. Need to reference some code or documentation
2. Click the upload button
3. Find the file in your file explorer
4. Drag and drop it
5. Repeat this every time you update that file

This is a small friction point that adds up when you're iterating quickly on a project. I don't know about you, but even using i3wm with the worlds fastest keybind, I hate context switching between my terminal and clicking around in a browser.

## Enter aku.sh

This little bash utility does one thing well: it lets you upload files to Claude projects directly from your command line.

For developers who keep documentation or codebase summaries that they frequently reference with Claude, this eliminates a ton of manual file handling.

## A Quick Demo

If I'm working on a project and I've just updated my API documentation. I want Claude to have the latest version for reference:

I create a config that contains the Claude project UUIDs and session key.

```json
{
  "ORG_ID": "your-organization-id",
  "PROJECTS": {
    "ProjectName1": "project-uuid-1"
  },
  "SESSION_KEY": "your-session-key"
}
```

Then simply run the tool, pointing at the files we want to upload.

```bash
# Upload the updated API docs to my ProjectA
./aku.sh -f ./docs/api-reference.md -p ProjectA -r
```

That's it. The script deletes the old version and uploads the new one to my Claude project. No browser tabs, no clicking around - just a quick command without breaking my workflow.

## Use Cases I've Found Helpful

I've been using this for a few specific scenarios:

1. **Code summaries**: I use [code2prompt](https://github.com/mufeedvh/code2prompt) to create condensed versions of my codebase, then upload those to Claude so it has context on my project structure.

2. **API documentation**: When working with external APIs, I keep a markdown file with key endpoints and examples, updating it as I learn more.

3. **Error logs**: When debugging with Claude's help, I can quickly update the error log file without manual copying/pasting.

When these files change (which they do frequently), I can update Claude's context with a simple terminal command.

## Setting It Up

The setup is pretty straightforward:

1. You'll need to extract a session key from the Claude dashboard (using browser dev tools)
2. Grab your organization ID and project UUIDs
3. Create a simple config file with these details
4. Make the script executable and you're good to go

While the session keys do expire, they typically last long enough to be practical for development sessions.

## Limitations

There are some limitations:
- Session keys eventually expire, so you'll need to update them
- It's not an official tool, so it could break if Anthropic changes their API
- Limited error handling for edge cases

## Ideas for Improvement

I may or may not update this weekend project in the future. Claude has added a GitHub integration that I find to be a useful alternative to project knowledge, albeit with some differences. That being said, here are some things that could improve.

 - Additional error handling

Create a daemon to act as a database and backend for aku.sh. This daemon would be able to manage session keys by ingesting them with a rest API. Then create a small browser extension that can extract session keys and project UUIDs, sending them to the daemon for centralized control and easy additions/modifications.