'use strict';

const http = require('http');
const httpProxy = require('http-proxy');

const EVENT_BRIDGE = 'http://j3-event-bridge:3001';

const proxy = httpProxy.createProxyServer({
  target: EVENT_BRIDGE,
  ws: true,
  changeOrigin: true,
});

proxy.on('error', (err, _req, res) => {
  console.error('[socket-proxy] error:', err.message);
  if (res && !res.headersSent) {
    res.writeHead(502);
    res.end('Bad Gateway');
  }
});

// Patch http.createServer before Next.js loads so every server it creates
// has the /socket.io intercept baked in.
const _createServer = http.createServer.bind(http);
http.createServer = (optsOrHandler, maybeHandler) => {
  let opts, nextHandler;
  if (typeof optsOrHandler === 'function') {
    opts = undefined;
    nextHandler = optsOrHandler;
  } else {
    opts = optsOrHandler;
    nextHandler = maybeHandler;
  }

  const wrapped = (req, res) => {
    if (req.url && req.url.startsWith('/socket.io')) {
      proxy.web(req, res);
    } else {
      nextHandler(req, res);
    }
  };

  const server = opts ? _createServer(opts, wrapped) : _createServer(wrapped);

  // WebSocket upgrade — Socket.IO switches from polling to ws after handshake
  server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/socket.io')) {
      proxy.ws(req, socket, head);
    }
  });

  return server;
};

// Load the Next.js standalone server — it calls our patched http.createServer
require('./server.js');
