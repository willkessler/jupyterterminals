#!/bin/bash

echo "(Re)Building docker image."
echo "If you see 'unable to prepare context' error make sure you are running this script from the top level directory (one level up from this scripts directory)"
docker build jupyterterminals -t jupyterterminals --no-cache

echo "Starting Jupyter Server container with JupyterTerminals Extension..."
# Note: optional shell arg tip from https://stackoverflow.com/questions/9332802/how-to-write-a-bash-script-that-takes-optional-input-arguments
docker run --rm -p ${1-8888}:8888 -v "$PWD":/home/jovyan/work jupyterterminals
