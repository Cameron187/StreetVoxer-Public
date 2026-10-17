# Security policy

## Reporting a vulnerability

Please report security problems privately, not as public issues:

- **[Report a vulnerability](https://github.com/Cameron187/StreetVoxer-Public/security/advisories/new)** (GitHub private reporting), or
- email **StreetVoxer@gmail.com** if you do not have a GitHub account.

Include what you found, where (the page, endpoint or file), and steps to reproduce it.

## Scope

In scope:

- https://www.streetvoxer.net/ and the game running in the browser
- The endpoints under https://www.streetvoxer.net/api/, including the MCP server at `/api/mcp`
- The code in this repository
- Anything that exposes a visitor's data, for example their location through a link or the optional Nearby players feature

Out of scope:

- Wrong or missing map data (please open a normal issue, or fix it on [openstreetmap.org](https://www.openstreetmap.org/))
- Third-party services the game reads from, such as imagery, elevation and Wikipedia
- Denial-of-service and load testing
- Social engineering and physical attacks

## Supported versions

Only the live site and the latest `api-v*` release of this repository are supported. Fixes ship to the live site; there are no older versions to patch.

## What to expect

StreetVoxer is maintained by one person. You can expect an acknowledgement within a week and a fix as soon as practical, and you will be told when it ships. With your permission, you will be credited in the advisory.

Research done in good faith and within this scope will not be pursued.
