import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * Attach Socket.IO to an HTTP server.
 * @param {import('http').Server} httpServer
 * @param {string[]|boolean} origins
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

    // Parents (and staff) can join a private room with their JWT
    socket.on('auth:join', (payload = {}) => {
      try {
        const token = payload.token || payload.Authorization?.replace?.(/^Bearer\s+/i, '');
        if (!token || !process.env.JWT_SECRET) return;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.sub || decoded.id;
        if (userId) {
          socket.join(`user:${userId}`);
          socket.data.userId = userId;
          socket.emit('auth:joined', { userId });
        }
      } catch {
        socket.emit('auth:error', { error: 'Invalid token' });
      }
    });
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
