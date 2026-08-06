import { Server } from 'socket.io';

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * Attach Socket.IO to an HTTP server.
 * @param {import('http').Server} httpServer
 * @param {string[]} origins
 */
export function initRealtime(httpServer, origins) {
  io = new Server(httpServer, {
    cors: {
      origin: origins,
      credentials: true,
    },
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    socket.emit('realtime:ready', { ok: true });
  });

  return io;
}

/**
 * Broadcast attendance change to all connected clients.
 * @param {{ sectionId: string, date: string, type: 'daily'|'periods' }} payload
 */
export function emitAttendanceUpdated(payload) {
  if (!io) return;
  io.emit('attendance:updated', payload);
}

export function getIO() {
  return io;
}
