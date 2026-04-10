const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

console.log('Properties containing "subscription":');
console.log(Object.keys(p).filter(k => k.toLowerCase().includes('subscription')));

console.log('\nAll properties:');
console.log(Object.keys(p).sort().join(', '));

// Check if subscriptions exists
console.log('\nHas "subscriptions"?', 'subscriptions' in p);
console.log('Has "subscription"?', 'subscription' in p);

// Check user model fields
console.log('\nUser model fields (sample):');
try {
  const sample = await p.user.findFirst();
  console.log(sample ? Object.keys(sample).sort().join(', ') : 'No users');
} catch(e) {
  console.log('Error:', e.message);
}

p.$disconnect();