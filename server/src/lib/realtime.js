import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getRequestTenant } from './tenantContext.js';
import { APEX_TENANT, resolveRequestTenantSlug } from './tenantHost.js';

/** @type {import('socket.io').Server | null} */
let io = null;

function handshakeReq(socket) {
  return {
    headers: {
      ...socket.handshake.headers,
      'x-tenant': socket.handshake.auth?.tenant || socket.handshake.headers['x-tenant'],
    },
  };
}

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
    const tenant = resolveRequestTenantSlug(handshakeReq(socket)) || APEX_TENANT;
    socket.data.tenant = tenant;
    socket.join(`tenant:${tenant}`);
    socket.emit('realtime:ready', { ok: true, tenant });

    socket.on('auth:join', (payload = {}) => {
      try {
        const token = payload.token || payload.Authorization?.replace?.(/^Bearer\s+/i, '');
        if (!token || !process.env.JWT_SECRET) return;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.sub || decoded.id;
        const tokenTenant = decoded.tenant || APEX_TENANT;
        if (userId) {
          socket.join(`user:${tokenTenant}:${userId}`);
          socket.data.userId = userId;
          socket.emit('auth:joined', { userId, tenant: tokenTenant });
        }
      } catch {
        socket.emit('auth:error', { error: 'Invalid token' });
      }
    });
  });

  return io;
}

/**
 * Broadcast attendance change to clients on the same school.
 * @param {{ sectionId: string, date: string, type: 'daily'|'periods' }} payload
 */
export function emitAttendanceUpdated(payload) {
  if (!io) return;
  const tenant = getRequestTenant() || APEX_TENANT;
  io.to(`tenant:${tenant}`).emit('attendance:updated', payload);
}

export function getIO() {
  return io;
}
