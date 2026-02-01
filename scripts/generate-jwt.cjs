const crypto = require('crypto');

const SECRET = '18a0jN01g9CvabmS6yw01bdNzIlW887WZ4g'; // ⚠️ REPLACE THIS!
const USER_ID = '4dc5b41f-c08e-46d1-8556-f7b6315a107f';

const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  sub: USER_ID,
  aud: ['fastapi-users:auth'],
  exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
};

const base64url = (str) => Buffer.from(str)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

const encodedHeader = base64url(JSON.stringify(header));
const encodedPayload = base64url(JSON.stringify(payload));
const signature = crypto
  .createHmac('sha256', SECRET)
  .update(`${encodedHeader}.${encodedPayload}`)
  .digest('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=/g, '');

const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

console.log('\n🔑 JWT Token Generated:\n');
console.log(jwt);
console.log('\n✅ Add to .env.local:\nSURFSENSE_JWT_TOKEN=' + jwt + '\n');
