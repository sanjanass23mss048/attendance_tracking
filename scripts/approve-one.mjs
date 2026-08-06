#!/usr/bin/env node
import { approveEditRequest } from './src/services/editRequestRepo.js';

const id = process.argv[2] || 'AERd8074b6c16f12fb9b5b41141';
const result = await approveEditRequest(id, { actorId: 'USR-INCHARGE' });
console.log(JSON.stringify({ id: result.id, status: result.status, editExpiresAt: result.editExpiresAt }, null, 2));
