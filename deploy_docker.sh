#!/bin/bash
set -eu

usage() {
  echo "Usage: $0 setup|start" >&2
  echo "  setup  Start MongoDB and run the one-time interactive server setup" >&2
  echo "  start  Start the already-configured Docker deployment" >&2
}

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

case "$(uname -m)" in
  arm64|aarch64)
    compose_file="docker-compose-arm64.yml"
    ;;
  *)
    compose_file="docker-compose.yml"
    ;;
esac

case "$1" in
  setup)
    docker compose -f "$compose_file" up -d database
    docker compose -f "$compose_file" build server
    docker compose -f "$compose_file" run --rm server setup
    ;;
  start)
    exec docker compose -f "$compose_file" up --build
    ;;
  *)
    usage
    exit 2
    ;;
esac
