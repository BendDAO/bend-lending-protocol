#!/bin/bash

# @dev
# This bash script setups the needed artifacts to use
# the @benddao/bend-deploy package as source of deployment
# scripts for testing or coverage purposes.
#
# A separate  artifacts directory was created 
# due at running tests all external artifacts
# located at /artifacts are deleted,  causing
# the deploy library to not find the external
# artifacts. 

echo "[BASH] Setting up testnet enviroment"

if [ ! "$COVERAGE" = true ]; then
    # remove hardhat and artifacts cache
    npm run ci:clean

    # compile @benddao/bend-protocol contracts
    npm run compile
else
    echo "[BASH] Skipping compilation to keep coverage artifacts"
fi

# Copy artifacts into separate directory to allow
# the hardhat-deploy library load all artifacts without duplicates 
mkdir -p temp-artifacts
cp -r artifacts/* temp-artifacts

# Import external @benddao/deploy artifacts
mkdir -p temp-artifacts/bend-deploy
cp -r node_modules/@benddao/bend-deploy/artifacts/contracts/* temp-artifacts/deploy

# Export MARKET_NAME variable to use Bend market as testnet deployment setup
export MARKET_NAME="Test"
export ENABLE_REWARDS="false"
echo "[BASH] Testnet enviroment ready"