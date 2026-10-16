# StreetVoxer

[StreetVoxer](https://www.streetvoxer.net/) is a free browser game that renders the real world as 3D voxels, from OpenStreetMap, elevation data and aerial imagery. You can walk, drive and fly through real places. It needs a WebGPU browser (current Chrome or Edge on desktop).

This repository is the project's public home: **issues and feedback for the whole site**, and the **agent kit** — what an AI agent or a developer needs to send people into the game. The game engine itself is not here.

## Report a problem or suggest something

[Open an issue](https://github.com/Cameron187/StreetVoxer-Public/issues). The most useful reports include:

- **The link.** The address bar always holds the current place and view, so copying it gives an exact reproduction.
- **The OSM element**, for a building or map feature that looks wrong (`way/123456`, or its openstreetmap.org URL).
- **The build string** from the footer (`v0.5.<n> build <number>`) and your browser and device.
- A screenshot.

Many map problems are tagging errors in OpenStreetMap itself; fixing the tag on [openstreetmap.org](https://www.openstreetmap.org/) improves the map for everyone, and StreetVoxer picks it up with its next map update.

## Agent kit

| | |
|---|---|
| [`agent/llms.txt`](agent/llms.txt) | How an agent uses the site — also served at https://www.streetvoxer.net/llms.txt |
| [`agent/agent-api.json`](agent/agent-api.json) | The documented in-page API (`window.debug`) and the scenario-link format |
| [`agent/scenarios/`](agent/scenarios/) | Example scenarios: a spawn point plus a quest |
| [`mcp/`](mcp/) | The MCP server |
| [`tools/scenario-link.mjs`](tools/scenario-link.mjs) | Builds a scenario link from a scenario file, offline |

### MCP server

Hosted, no install: `https://www.streetvoxer.net/api/mcp` (Streamable HTTP, stateless, no auth).

Or run it locally over stdio (Node 18+):

```
git clone https://github.com/Cameron187/StreetVoxer-Public.git
claude mcp add streetvoxer -- node StreetVoxer-Public/mcp/stdio.mjs
```

Tools: `coverage` (does a point have map data), `make_spawn_link` (a URL that opens a place), `make_scenario_link` (a URL that opens a place and starts a quest) and `read_scenario_link` (what a link does, and whether the game accepts it). Every tool returns a link or an answer; nothing runs on the server. `STREETVOXER_BASE_URL` points the links at another host.

### Scenario links

A scenario link is a spawn URL with a quest in its fragment. Build one from an example:

```
node tools/scenario-link.mjs agent/scenarios/salt-flats-survey-run.json
```

The format is in [`agent/agent-api.json`](agent/agent-api.json) under `scenarioLinks`. The game checks the quest when the link is opened and shows the reason on screen if it refuses it.

## Versions

Releases are tagged `api-v<agentApiVersion>`, matching `agentApiVersion` in the manifest and in the live page. The files here are published from the game's source when the site is deployed; please send changes as issues rather than pull requests against these files.

## License

[MIT](LICENSE).
