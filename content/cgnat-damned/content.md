## CGNAT be Damned

If you're running a homelab behind Carrier-Grade NAT (CGNAT), you've probably experimented with a plethora of options to publicly expose your services. No port forwarding, no direct access, no way to access your apps remotely without jumping through VPN hoops or relocating your services.

Every service you've carefully containerized and configured is stuck in your local network, including your media server and all of its accesories.

## The Solution: VPS + WireGuard + Nginx

My (and others') workaround is elegant: use a cheap VPS with a public IP as a gateway. WireGuard creates a secure tunnel between your home server and the VPS, while Nginx on the VPS proxies incoming requests through the tunnel to your local docker network and containers.

Now your homelab services are accessible via subdomains like `overseerr.jmassey.net`, all routing through your VPS to your home network.

## Architecture Overview

Here's what we're building:

```
Anywhere → DNS → VPS (Public IP) → Nginx → WireGuard Tunnel → Home Server → Docker Containers
```

Each service gets its own subdomain that points to your VPS. Nginx on the VPS routes requests based on the subdomain through the WireGuard tunnel to the appropriate container on your home server. You've likely played with Nginx reverse proxies before, so this should be familiar.

## Setting Up WireGuard

First, we establish the secure tunnel between your VPS and home server. We will use a class C subnet in this example, but that is obviously up to you.

### On the VPS

Install WireGuard and generate keys:

```bash
apt update && apt install wireguard
cd /etc/wireguard
umask 077
wg genkey | tee privatekey | wg pubkey > publickey
```

Create `/etc/wireguard/wg0.conf`:

```ini
[Interface]
PrivateKey = <VPS_PRIVATE_KEY>
Address = 10.0.0.1/24
ListenPort = 51820

[Peer]
PublicKey = <HOME_SERVER_PUBLIC_KEY>
AllowedIPs = 10.0.0.2/32
```

Enable and start WireGuard:

```bash
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0
```

### On Your Home Server

Insall WireGuard and generate keys the same way, then create `/etc/wireguard/wg0.conf`:

```ini
[Interface]
PrivateKey = <HOME_SERVER_PRIVATE_KEY>
Address = 10.0.0.2/24

[Peer]
PublicKey = <VPS_PUBLIC_KEY>
Endpoint = <VPS_PUBLIC_IP>:51820
AllowedIPs = 10.0.0.1/32
PersistentKeepalive = 25
```

`PersistentKeepalive` is critical.

Start WireGuard:

```bash
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0
```

Verify the tunnel. `ping 10.0.0.1` from your home server.

## Docker Network Setup

On your home server, create a dedicated bridge network for services that need public access:

```bash
docker network create public-services
```

This network makes it simple to add new services. Just attach containers to it and add an Nginx config on your VPS.

Example docker-compose.yml for a service:

```yaml
services:
  overseerr:
    image: lscr.io/linuxserver/overseerr:latest
    container_name: overseerr
    networks:
      - public-services
    ports:
      - "5055:5055"
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=America/Chicago
    volumes:
      - ./overseerr-config:/config
    restart: unless-stopped

networks:
  public-services:
    external: true
```

## Nginx Configuration on the VPS

Install Nginx on your VPS:

For debian-based systems:
```bash
apt install nginx certbot python3-certbot-nginx
```

Packages will vary but will certainly be available for other distros

If you're running Arch for your homelab... chaotic Chad.

Create a base configuration at `/etc/nginx/sites-available/homelab`:

```nginx
# Overseerr
server {
    listen 80;
    server_name overseerr.jmassey.net;

    location / {
        proxy_pass http://10.0.0.2:5055;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Radarr
server {
    listen 80;
    server_name radarr.jmassey.net;

    location / {
        proxy_pass http://10.0.0.2:7878;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Sonarr
server {
    listen 80;
    server_name sonarr.jmassey.net;

    location / {
        proxy_pass http://10.0.0.2:8989;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the configuration:

```bash
ln -s /etc/nginx/sites-available/homelab /etc/nginx/sites-enabled/
systemctl reload nginx
```

Check the syntax is you have issues:
```bash
nginx -t
```

## DNS Configuration

Point your subdomains to your VPS public IP. In your DNS provider (for jmassey.net):

```
A    overseerr    <VPS_PUBLIC_IP>
A    radarr       <VPS_PUBLIC_IP>
A    sonarr       <VPS_PUBLIC_IP>
```

Or use a wildcard:

```
A    *.jmassey.net    <VPS_PUBLIC_IP>
```

## SSL with Let's Encrypt

Secure your services with free SSL certificates:

```bash
certbot --nginx -d overseerr.jmassey.net
certbot --nginx -d radarr.jmassey.net
certbot --nginx -d sonarr.jmassey.net
```

Certbot will automatically modify your Nginx configs with HTTPS and handle cert renewal.

## Adding New Services

This stack is great because you don't have to do much to add new services, and you can keep everything containerized.

To add a new service:

1. **On your home server**: Add the container to the `public-services` network
2. **On your VPS**: Add a new Nginx server block pointing to `10.0.0.2:<port>`
3. **DNS**: Add an A record for the subdomain
4. **SSL**: Run certbot for the new subdomain

Example for adding Prowlarr:

```bash
# Home server - add to docker-compose.yml
prowlarr:
  image: lscr.io/linuxserver/prowlarr:latest
  networks:
    - public-services
  ports:
    - "9696:9696"

# VPS - add to /etc/nginx/sites-available/homelab
server {
    listen 80;
    server_name prowlarr.jmassey.net;
    location / {
        proxy_pass http://10.0.0.2:9696;
        # ... proxy headers
    }
}

# DNS
A    prowlarr    <VPS_PUBLIC_IP>

# SSL
certbot --nginx -d prowlarr.jmassey.net
```

## Cost and VPS Recommendations

You don't need much firepower for this. A basic VPS with:
- 1 CPU core
- 512MB-1GB RAM
- 10GB storage
- Unmetered bandwidth (or at least a few TB)

Providers like Vultr, Hetzner, or DigitalOcean offer instances for $3-6/month. The traffic mostly flows through the VPS, but the actual processing happens on your personal machine.

(Here is a list of cheap providers)[https://lowendbox.com/]

## Conclusion

The setup takes some effort initially, but once it's running, adding new services is a matter of minutes. Your media server, monitoring tools, and automation services can all be accessible from anywhere, with clean URLs and proper SSL certificates.

Unlock the beast within. Deploy your services to the world.

Be careful with this setup. This is a barebones configuration with zero security measures. You should always utilize a firewall when exposing an entire server to the internet via WireGuard.