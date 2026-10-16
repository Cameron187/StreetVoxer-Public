#!/usr/bin/env node
// StreetVoxer (https://www.streetvoxer.net/). MIT License, see LICENSE.

import { createInterface } from 'node:readline';
import { handleMcpPayload, MCP_SERVER_NAME, MCP_SERVER_VERSION } from './streetvoxerMcp.mjs';

const opts = { baseUrl: process.env.STREETVOXER_BASE_URL || undefined };
const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', function(line){
  if(!line.trim()) return;
  let payload;
  try { payload = JSON.parse(line); }
  catch(e){
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }) + '\n');
    return;
  }
  const res = handleMcpPayload(payload, opts);
  if(res) process.stdout.write(JSON.stringify(res) + '\n');
});
rl.on('close', function(){ process.exit(0); });
process.stderr.write(MCP_SERVER_NAME + ' MCP server ' + MCP_SERVER_VERSION + ' on stdio'
  + (opts.baseUrl ? ' (links to ' + opts.baseUrl + ')' : '') + '\n');
