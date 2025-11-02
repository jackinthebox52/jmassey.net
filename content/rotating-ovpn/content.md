## The Problem with Rotating Proxies

If you've ever needed to scrape data or do anything that benefits from rotating IP addresses, you've probably looked into proxy services. They work great, but they're expensive.Often $50-$100+ per month for decent rotating proxies.

Meanwhile, you're probably already paying $10/month or less for a VPN service like Surfshark that gives you access to hundreds of servers around the world.

Some VPN providers support more servers than others. Mulvad for instance has over 700 servers which is plenty for some use cases. Some providers also have a free tier, trials, dedicated IP services, and more, which allows you to craft your VPN pool to your needs.

## Why Not Just Use Your VPN?

You absolutely can. The problem is that switching VPN connections manually is tedious:

1. Disconnect from current server
2. Browse through a list of servers
3. Pick a new one
4. Wait for connection
5. Repeat this process every time you need a fresh IP

This gets old fast when you're running scripts that need to rotate connections frequently.

## Quick Example

If I'm running a web scraper and want to rotate my connection between US servers every few requests:

```bash
# Initial setup - configure your VPN credentials
sudo rotating-ovpn setup --username your_username --password your_password

# Copy your .ovpn files (I use Surfshark's)
sudo cp ~/surfshark_configs/*.ovpn /var/lib/rotating-ovpn/profiles/

# Rotate to a random US server
sudo rotating-ovpn rotate -f us

# Check connection status
sudo rotating-ovpn status
```

That's it. Your connection rotates to a new US server. Run it again, get a different server.

## How I've Used It

A few scenarios where this has been useful:

1. **Web scraping**: Rotate IPs between batches to avoid rate limits without paying for proxy services.

2. **Geolocation testing**: Quickly switch between different countries to test how your app behaves in different regions.

3. **Privacy-focused browsing**: Change your exit point periodically without manual configuration.

I'd imagine you could get much more creative or nefarious with this tool. As with any software, use it responsibly.

## Configuration

After setup, you get a simple config file at `/var/lib/rotating-ovpn/config.json`:

```json
{
  "filter_prefixes": ["us", "uk", "ca", "fr", "de", "jp"],
  "username": "your_username",
  "password": "your_password"
}
```

The `filter_prefixes` let you control which servers are in the rotation pool. If you only want US and UK servers, just use `["us", "uk"]`.

## What It Does Behind the Scenes

When you run `rotate`, the tool:
- Kills any existing OpenVPN connection
- Filters available `.ovpn` profiles based on your prefixes
- Picks a new random server
- Starts OpenVPN daemon
- Tracks the connection state for the next rotation

The OpenVPN process runs independently, so you can close your terminal and stay connected.

## Limitations

This is designed for Linux systems and requires:
- Root access
- OpenVPN installed
- `.ovpn` profile files from your VPN provider

I've only tested it with Surfshark, but it should work with any provider that gives you standard OpenVPN configs.

This isn't meant to replace professional proxy services for production use cases - it's more for personal projects, testing, and development work.

## Installation

The install script handles the setup:

```bash
git clone https://github.com/jackinthebox52/rotating-ovpn.git
cd rotating-ovpn
sudo ./install.sh
```

Then configure your credentials and drop your `.ovpn` files in the profiles directory.

## Why Build This?

Honestly? I was tired of paying for rotating proxies when I already had a VPN subscription. This scratches that itch for personal projects where I need IP rotation but don't need the reliability and scale of a professional proxy service.

If you're in a similar boat, already paying for a VPN with lots of servers, need occasional IP rotation, comfortable with the command line, this might save you some money.

I'll probably polish this up substantially and add wireguard support in the near future.

## Git Repository

The code is on GitHub at [https://github.com/jackinthebox52/rotating-ovpn](https://github.com/jackinthebox52/rotating-ovpn).