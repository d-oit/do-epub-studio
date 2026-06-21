---
description: Fetch and merge latest changes from origin/main
model: kilo/openrouter/free
agent: build
---

Switch to the main branch, fetch the latest changes from origin, and fast-forward merge:

!`git checkout main && git fetch origin main && git merge origin/main`

Report the result: which files changed, if any conflicts occurred, and the current commit SHA.
