#!/bin/bash
# Preview the site locally at http://localhost:4000
# Requires Docker — no Ruby install needed.
docker run --rm \
  --platform linux/amd64 \
  -v "$PWD:/srv/jekyll" \
  -p 4000:4000 \
  jekyll/jekyll \
  sh -c "bundle install --quiet && jekyll serve --livereload"
