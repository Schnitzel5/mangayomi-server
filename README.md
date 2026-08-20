# mangayomi-server

A self-hosted server for Mangayomi.

## Setup for native release

MongoDB is required but is not included in the native release. Use an existing
MongoDB server or a hosted MongoDB provider and keep its connection URI handy.

1. Download the archive for your platform from the GitHub Releases page:
   - `mangayomi-server-linux-amd64.tar.gz`
   - `mangayomi-server-macos-amd64.tar.gz`
   - `mangayomi-server-windows-amd64.zip`
2. Extract the archive and open a terminal in the extracted directory. Keep this
   layout intact; the executable loads `resources/` and
   `frontend/dist/browser/` using relative paths:

   ```text
   mangayomi-server-<platform>-amd64/
   ├── mangayomi-server[.exe]
   ├── .env.dist
   ├── resources/
   └── frontend/dist/browser/
   ```

3. Run the interactive setup. Enter your MongoDB URI, choose the host and port,
   and create the first administrator account:

   ```sh
   # Linux or macOS
   ./mangayomi-server setup
   ```

   ```powershell
   # Windows PowerShell
   .\mangayomi-server.exe setup
   ```

   Setup checks MongoDB connectivity and writes the resulting configuration to
   `.env`. It never launches the server. Do not share or commit `.env`.

4. Start the server from the same extracted directory:

   ```sh
   # Linux or macOS
   ./mangayomi-server serve
   ```

   ```powershell
   # Windows PowerShell
   .\mangayomi-server.exe serve
   ```

   To use a different configuration file, keep the current directory as the
   extracted release directory and select the file explicitly:

   ```sh
   ./mangayomi-server serve --config /path/to/server.env
   ```

   By default, the server listens on `http://localhost:8080` unless you chose a
   different host or port during setup.

### Account security

After setup, registration is disabled by default (`ALLOW_REGISTRATION=false`).
Sign in as the administrator and use the authenticated `POST /admin/users`
endpoint to provision basic accounts. MongoDB remains an external service and
must be available whenever the server runs.

## Developer setup

This path is for contributors working from a clone. Install Rust and MongoDB,
then run setup and the server through Cargo:

```sh
git clone https://github.com/Schnitzel5/mangayomi-server.git
cd mangayomi-server
cargo run -- setup
cargo run -- serve
```

The same `serve --config /path/to/server.env` option is available through Cargo:

```sh
cargo run -- serve --config /path/to/server.env
```

## Docker Compose

This is a separate deployment path. Docker Compose runs MongoDB in its own
container, but it does not run setup or create an administrator automatically.
Install Docker Engine or Docker Desktop, then create the host configuration:

```sh
cp .env.dist .env
```

Edit `.env` before starting. Set `DATABASE_USER`, `DATABASE_PASSWORD`, and a
unique `SECRET_KEY`; adjust `HOST` and `PORT` if needed. Generate the session
secret with this supported command, then paste its output into `SECRET_KEY`:

```sh
openssl rand -hex 64
```

These are values you choose—the repository does not provide default credentials.
`DATABASE_DB`, `SESSION_TTL_DAYS`, and `ALLOW_REGISTRATION` are also passed to
the server. Compose supplies safe defaults for missing non-secret settings when
an older host `.env` does not contain them, but it never supplies a secret or
database credential.

Run the one-time bootstrap interactively. Start MongoDB first, build the server
image, then run setup from an attached terminal so you can enter the MongoDB
URI and administrator credentials:

```sh
docker compose up -d database
docker compose build server
docker compose run --rm server setup
```

After setup completes successfully, start the server:

```sh
docker compose up -d server
```

The setup container's generated `.env` is ephemeral and is removed with
`--rm`. Runtime settings and the secret come from the host `.env` through the
Compose environment; keep that host file private. If setup has already been
completed for the MongoDB volume, do not repeat it—start the server directly.

The image uses `/app/server` as its entrypoint and defaults to the `serve`
subcommand. Therefore `docker compose up` starts the server, while
`docker compose run --rm server setup` passes `setup` to that same executable.

For the Docker ARM64 compose file, use the same one-time sequence with `-f`:

```sh
docker compose -f docker-compose-arm64.yml up -d database
docker compose -f docker-compose-arm64.yml build server
docker compose -f docker-compose-arm64.yml run --rm server setup
docker compose -f docker-compose-arm64.yml up -d server
```

The architecture-selecting helper provides the same explicit modes:

```sh
./deploy_docker.sh setup
./deploy_docker.sh start
```

`setup` starts MongoDB, builds the image, and runs the interactive setup once;
`start` is for subsequent runs and never performs setup automatically. The
helper requires one of these modes so a fresh deployment is not launched
behind the bootstrap gate by accident.

Docker Compose manages its MongoDB container; native releases do not include a
MongoDB service.

## Hosted Servers

- [Dev Server](https://mangayomi.30062022.xyz)

## Requirements

- [MongoDB](https://www.mongodb.com/try/download/community)
- or [Docker Engine / Desktop](https://www.docker.com/)

## How to use it on the client
Go to Settings -> Sync:

1. Enable sync
2. Register an account on your Sync Servers website
3. Enter the IP + Port / Domain of your Sync Server, email address and a password with at least 8 characters.
4. Press 'Sync progress'!

## Star History

<a href="https://www.star-history.com/?type=date&repos=Schnitzel5%2Fmangayomi-server">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Schnitzel5/mangayomi-server&type=date&theme=dark&legend=top-left&sealed_token=2styYBs0WCBLpy-4NKEQMa6PztvvIp5OjKgkC7ihCCER2a3GMwpci3c2-3p2ds-AMGZXW2_UghajccQgycM__xQTFDDfrTurmn7BEszOXNbnKZUC5E3VJqGDeI-ate7Zmx5Ct7Phw_xGuKpZsVmWmO6G4V2tRMB4bTpvx6Tx_7XbyMiDHVaGJXVlPFBY" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Schnitzel5/mangayomi-server&type=date&legend=top-left&sealed_token=2styYBs0WCBLpy-4NKEQMa6PztvvIp5OjKgkC7ihCCER2a3GMwpci3c2-3p2ds-AMGZXW2_UghajccQgycM__xQTFDDfrTurmn7BEszOXNbnKZUC5E3VJqGDeI-ate7Zmx5Ct7Phw_xGuKpZsVmWmO6G4V2tRMB4bTpvx6Tx_7XbyMiDHVaGJXVlPFBY" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Schnitzel5/mangayomi-server&type=date&legend=top-left&sealed_token=2styYBs0WCBLpy-4NKEQMa6PztvvIp5OjKgkC7ihCCER2a3GMwpci3c2-3p2ds-AMGZXW2_UghajccQgycM__xQTFDDfrTurmn7BEszOXNbnKZUC5E3VJqGDeI-ate7Zmx5Ct7Phw_xGuKpZsVmWmO6G4V2tRMB4bTpvx6Tx_7XbyMiDHVaGJXVlPFBY" />
 </picture>
</a>
