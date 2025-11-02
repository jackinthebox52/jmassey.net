## The Problem

If you've ever worked with HLS streams from various sources on the internet, you've probably run into some annoyances Streams change URLs unexpectedly. Connections drop. And you are inundated with ads that sometimes fight back against uBlock Origin.

I wanted a way to pull these streams through a local server with a click of a button, and to easily be able to play them throughout the house on various VLC players (Google TV, Firestick, Laptop, etc.)

## What bytestream Does

bytestream is a Docker container based on a server that restreams HLS content through a REST API. It comes with a Firefox extension that automatically detects M3U8 streams while you browse and lets you add them to your local restreaming server.

The flow:

1. Navigate to a page with HLS content
2. The extension detects M3U8 streams and captures the origin headers
3. Click "Add to Server" in the extension popup
4. Access your restream at `{SERVER_IP}:8080/stream/STREAM_NAME/index.m3u8`

FFmpeg handles the actual streaming with stream copying (no transcoding), which keeps CPU usage minimal.

## How Work? Easy.

The backend is a Python Flask server running in a Docker container. It exposes a few endpoints:

```bash
# Start a stream
curl -X POST http://{SERVER_IP}:8080/api/stream/start \
  -H "Content-Type: application/json" \
  -d '{"name":"stream1", "origin":"https://example.com", "url":"https://example.com/stream.m3u8"}'

# List active streams
curl http://{SERVER_IP}:8080/api/streams

# Stop a stream
curl -X POST http://{SERVER_IP}:8080/api/stream/stop/stream1
```

The Firefox extension uses the `webRequest` API to intercept M3U8 requests and capture the origin headers automatically. This is important because many streaming sources check the origin header to prevent hotlinking. The extension stores detected streams and provides a popup interface for managing them.

When you add a stream, the server spawns an FFmpeg process that pulls from the source URL with the correct headers and segments it into a local HLS stream. The segments get stored in `/var/www/streams/STREAM_NAME/` and are served through Flask.

I used to just pull the stream links manually and fire up an FFmpeg wrapper script, but this makes living room viewing a lot easier.

## Setup

Getting up and running is simple:

```bash
git clone https://github.com/jackinthebox52/bytestream
cd bytestream
docker-compose up -d
```

For the Firefox extension:

1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on"
3. Select any file in the `extension/` directory

The extension will start detecting M3U8 streams as you browse (you may have to click refresh in the popup). A badge on the toolbar icon shows how many streams it has found.

You can run the server on whatever machine you'd like, and specify the non-localhost IP address in the popup manager.

## Implementation Details

The server keeps track of active streams in memory and automatically cleans up streams older than 12 hours. Each stream gets its own FFmpeg process, and stopping a stream terminates the process and removes the stream files.

The extension popup has two tabs: one for detected browser streams and one for active streams on your server. You can add streams directly from the detected list, or manually input stream details if you have a URL from somewhere else.

One issue with restreaming in general: many streaming sources rotate their M3U8 URLs frequently or use short-lived tokens. This tool grabs the stream at a point in time, but if the source URL changes, you'll need to update the stream with a new URL.

## Work Needed

If I come back to this, some things that would be useful:

- Authentication for the API
- Better error handling when source streams fail
- Stream health monitoring
- Automatic stream restart on failure
- A simple web interface for management (currently it's just the Firefox extension)
- Support for other browsers (May work with chrome already, but I havent verified)

The code is on (GitHub)[https://github.com/jackinthebox52/bytestream] if you want to use it yourself. It does what I needed it to do, which is good enough for now.

I am not responsible for your use of this tool or any consequences that may arise from it. Distributing pirated content is illegal in the US, and using this tool for public-facing services would be a very poor idea. This tool is not intended to be used for commercial purposes or ANY illegal activity.