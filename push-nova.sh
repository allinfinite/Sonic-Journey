#!/bin/bash
# Push only the nova folder to nova-test repository

set -e

echo "Pushing nova folder to nova-test..."

# Split the nova folder into a temporary branch
git subtree split --prefix=nova -b nova-only

# Push to nova-test
git push https://github.com/allinfinite/nova-test nova-only:main --force

# Clean up temporary branch
git branch -D nova-only

echo "Done! Only nova folder pushed to nova-test."
