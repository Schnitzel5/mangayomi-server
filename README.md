# mangayomi-server

A self-hosted server for Mangayomi.

## Hosted Servers

- [Dev Server](https://mangayomi.30062022.xyz)

## Requirements

- [Rust](https://www.rust-lang.org/tools/install) and [MongoDB](https://www.mongodb.com/try/download/community)
- or [Docker Engine / Desktop](https://www.docker.com/)

## IDE
- [VSC](https://code.visualstudio.com/download) or [RustRover](https://www.jetbrains.com/rust/) recommended

## Setup - Local

1. Install [Rust](https://www.rust-lang.org/tools/install)
2. Setup a MongoDB Server by either using a hosting platform or on your on machine / server. \
   If you need a free MongoDB server that runs 24/7: [MongoDB Atlas](https://www.mongodb.com/resources/basics/databases/cloud-databases/free-cloud-database) \
   If you want to install your own server locally: [MongoDB Community](https://www.mongodb.com/try/download/community)
3. Now you can clone the GitHub repository to your machine / server: ```git clone https://github.com/mangayomi/mangayomi-sync.git```
4. Go to the cloned repository and copy the .env.dist file to a new .env file in the same directory
5. Open .env and add a secret key for the field "SECRET_KEY": [just auto generate it there - 64 instead of 16 bytes long](https://generate.plus/en/base64)
6. Open .env and adjust the values as needed
7. Now run ```cargo run``` to run the server.
8. Connect to the sync server using the host and port set in `.env`.  
   By default, the server will be reachable at `http://localhost:8080`

## Setup - Docker Compose
1. Install [Docker Engine / Desktop](https://www.docker.com/).  
   Most installations will come with Compose included, but it can also be [installed manually](https://docs.docker.com/compose/install/).
2. Make a copy of the `.env.dist` file by running `cat .env.dist >> .env`.  
   Changing the default passwords is strongly recommended, even when running locally.
3. Add a secret key for the field "SECRET_KEY": [just auto generate it there - 64 instead of 16 bytes long](https://generate.plus/en/base64)
4. If you're running the server on an ARM64 CPU, replace Dockerfile with Dockerfile.arm64
5. Run the project with `docker compose up -d`
6. Connect to the sync server using the host and port set in `.env`.  
   By default, the server will be reachable at `http://localhost:8080`

## How to use it on the client
Go to Settings -> Sync:

1. Enable sync
2. Register an account on your Sync Servers website
3. Enter the IP + Port / Domain of your Sync Server, email address and a password with at least 8 characters.
4. Press 'Sync progress'!

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Schnitzel5/mangayomi-server&type=Date)](https://www.star-history.com/#Schnitzel5/mangayomi-server&Date)
