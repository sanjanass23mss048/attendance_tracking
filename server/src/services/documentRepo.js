import { prisma } from '../lib/prisma.js';
import { newId, parseDateOnly, toDateString } from '../lib/ids.js';

export function serializeDocument(row) {
  return {
    id: row.Document_id,
    entityType: row.Entity_Type,
    entityId: row.Entity_Id,
    documentType: row.Document_Type,
    fileName: row.File_Name,
    mimeType: row.Mime_Type,
    fileSize: row.File_Size,
    uploadedBy: row.Uploaded_By,
    leaveFrom: toDateString(row.Leave_From),
    leaveTo: toDateString(row.Leave_To),
    reason: row.Reason ?? null,
    notes: row.Notes ?? null,
    status: row.Status || 'pending',
    createdAt: row.Created_On?.toISOString?.() ?? row.Created_On,
  };
}

export async function listDocuments(entityType, entityId) {
  const rows = await prisma.tblDocuments.findMany({
    where: {
      Entity_Type: entityType,
      Entity_Id: entityId,
      Int_Status: { not: 0 },
    },
    orderBy: { Created_On: 'desc' },
  });
  return rows.map(serializeDocument);
}

export async function findDocumentById(documentId) {
  return prisma.tblDocuments.findFirst({
    where: {
      Document_id: documentId,
      Int_Status: { not: 0 },
    },
  });
}

export async function createDocument({
  documentId,
  entityType,
  entityId,
  documentType,
  fileName,
  storageKey,
  mimeType,
  fileSize,
  uploadedBy,
  leaveFrom,
  leaveTo,
  reason,
  notes,
  status,
}) {
  const row = await prisma.tblDocuments.create({
    data: {
      Document_id: documentId || newId('DOC'),
      Entity_Type: entityType,
      Entity_Id: entityId,
      Document_Type: documentType || null,
      File_Name: fileName,
      Storage_Key: storageKey,
      Mime_Type: mimeType || null,
      File_Size: fileSize ?? null,
      Uploaded_By: uploadedBy || null,
      Leave_From: leaveFrom ?? null,
      Leave_To: leaveTo ?? null,
      Reason: reason || null,
      Notes: notes || null,
      Status: status || 'pending',
      Int_Status: 1,
    },
  });
  return serializeDocument(row);
}

export async function softDeleteDocument(documentId) {
  const row = await prisma.tblDocuments.update({
    where: { Document_id: documentId },
    data: { Int_Status: 0 },
  });
  return row;
}
