import { prisma } from './src/lib/prisma.js';
import { listNoticesForParentScope, listNotices } from './src/services/noticeRepo.js';
import { parentAudienceScope } from './src/services/schoolRepo.js';

const parent = await prisma.tblUsers.findFirst({
  where: { email: 'parent@brightfuture.edu.in' },
});
if (!parent) {
  console.log('parent user missing');
  process.exit(1);
}
const scope = await parentAudienceScope(parent.user_id);
console.log('scope', scope);
const notices = await listNoticesForParentScope({
  classSectionIds: scope.classSectionIds,
  studentClassIds: scope.studentClassIds,
  limit: 10,
});
console.log(
  'parent_notices',
  notices.map((n) => ({ id: n.id, title: n.title, audienceType: n.audienceType, createdOn: n.createdOn }))
);
await prisma.$disconnect();
