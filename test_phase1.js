// Phase 1 — Auth Backend Tests
const http = require('http');

const AUTH = 'http://localhost:3210';
const HOME = 'http://localhost:5001';

let userA = { token: null, refresh: null, userId: null };
let userB = { token: null, refresh: null, userId: null };
let results = { passed: [], failed: [], security: [], warnings: [] };

function req(method, url, body, headers = {}) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method, headers: { 'Content-Type': 'application/json', ...headers }
    };
    const r = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    r.on('error', () => resolve({ status: 0, body: 'CONNECTION_ERROR' }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function pass(name) { results.passed.push(name); console.log('✅ PASS:', name); }
function fail(name, expected, actual, severity = 'Medium') {
  results.failed.push({ name, expected, actual, severity });
  console.log(`❌ FAIL [${severity}]: ${name} | Expected: ${expected} | Got: ${actual}`);
}
function sec(type, endpoint, detail) {
  results.security.push({ type, endpoint, detail });
  console.log(`🔴 SECURITY [${type}]: ${endpoint} — ${detail}`);
}
function warn(msg) { results.warnings.push(msg); console.log('🟡 WARN:', msg); }

async function run() {
  console.log('\n====== PHASE 1 — AUTH BACKEND (localhost:3210) ======\n');

  // --- 1. Health check ---
  const health = await req('GET', `${AUTH}/`);
  health.status === 200 ? pass('GET / health check') : fail('GET / health check', 200, health.status);

  // --- 2. Signup User A ---
  const tsA = Date.now();
  const signupA = await req('POST', `${AUTH}/api/auth/signup`, {
    username: `UserA_${tsA}`, email: `usera_${tsA}@test.com`,
    password: 'TestPass123', confirmPassword: 'TestPass123', phone: `+2012${tsA.toString().slice(-8)}`
  });
  if (signupA.status === 201 && signupA.body.accessToken) {
    pass('POST /api/auth/signup — valid data (User A)');
    userA.token = signupA.body.accessToken;
    userA.refresh = signupA.body.refreshToken;
    userA.userId = signupA.body.user?.id;
    userA.email = `usera_${tsA}@test.com`;
  } else {
    fail('POST /api/auth/signup — valid data', '201 + accessToken', `${signupA.status} ${JSON.stringify(signupA.body)}`, 'High');
  }

  // --- 3. Signup User B ---
  const tsB = Date.now() + 1;
  const signupB = await req('POST', `${AUTH}/api/auth/signup`, {
    username: `UserB_${tsB}`, email: `userb_${tsB}@test.com`,
    password: 'TestPass123', confirmPassword: 'TestPass123', phone: `+2010${tsB.toString().slice(-8)}`
  });
  if (signupB.status === 201 && signupB.body.accessToken) {
    pass('POST /api/auth/signup — valid data (User B)');
    userB.token = signupB.body.accessToken;
    userB.refresh = signupB.body.refreshToken;
    userB.userId = signupB.body.user?.id;
    userB.email = `userb_${tsB}@test.com`;
  } else {
    fail('POST /api/auth/signup — valid data (User B)', '201', `${signupB.status}`, 'High');
  }

  // --- 4. Signup validation ---
  const dupEmail = await req('POST', `${AUTH}/api/auth/signup`, {
    username: 'Dup', email: userA.email, password: 'TestPass123', confirmPassword: 'TestPass123'
  });
  dupEmail.status === 409 ? pass('Signup duplicate email → 409') : fail('Signup duplicate email', 409, dupEmail.status);

  const mismatch = await req('POST', `${AUTH}/api/auth/signup`, {
    username: 'MM', email: `mm_${tsA}@test.com`, password: 'TestPass123', confirmPassword: 'WRONG'
  });
  mismatch.status === 400 ? pass('Signup mismatched passwords → 400') : fail('Signup mismatched passwords', 400, mismatch.status);

  const shortPwd = await req('POST', `${AUTH}/api/auth/signup`, {
    username: 'Short', email: `short_${tsA}@test.com`, password: '123', confirmPassword: '123'
  });
  shortPwd.status === 400 ? pass('Signup short password → 400') : fail('Signup short password (<6)', 400, shortPwd.status, 'Medium');

  const missingFields = await req('POST', `${AUTH}/api/auth/signup`, { email: `miss_${tsA}@test.com` });
  missingFields.status === 400 ? pass('Signup missing fields → 400') : fail('Signup missing fields', 400, missingFields.status);

  // --- 5. Login ---
  const loginEmail = await req('POST', `${AUTH}/api/auth/login`, {
    email: userA.email, password: 'TestPass123'
  });
  if (loginEmail.status === 200 && loginEmail.body.accessToken) {
    pass('POST /api/auth/login — by email');
    userA.token = loginEmail.body.accessToken;
    userA.refresh = loginEmail.body.refreshToken;
  } else {
    fail('POST /api/auth/login — by email', '200 + token', `${loginEmail.status}`, 'High');
  }

  const loginIdentifier = await req('POST', `${AUTH}/api/auth/login`, {
    identifier: userA.email, password: 'TestPass123'
  });
  loginIdentifier.status === 200 ? pass('Login by identifier field') : warn(`Login by identifier: ${loginIdentifier.status}`);

  const loginWrongPwd = await req('POST', `${AUTH}/api/auth/login`, {
    email: userA.email, password: 'WrongPassword'
  });
  loginWrongPwd.status === 401 ? pass('Login wrong password → 401') : fail('Login wrong password', 401, loginWrongPwd.status);

  const loginNoUser = await req('POST', `${AUTH}/api/auth/login`, {
    email: 'nonexistent@test.com', password: 'TestPass123'
  });
  loginNoUser.status === 404 || loginNoUser.status === 401 ? pass('Login non-existent user → 404/401') : fail('Login non-existent user', '404 or 401', loginNoUser.status);

  // --- 6. GET /api/auth/me ---
  const meValid = await req('GET', `${AUTH}/api/auth/me`, null, { Authorization: `Bearer ${userA.token}` });
  meValid.status === 200 ? pass('GET /api/auth/me — valid token') : fail('GET /api/auth/me valid token', 200, meValid.status, 'High');

  const meNoToken = await req('GET', `${AUTH}/api/auth/me`);
  meNoToken.status === 401 ? pass('GET /api/auth/me — no token → 401') : fail('GET /api/auth/me no token', 401, meNoToken.status);

  const meMalformed = await req('GET', `${AUTH}/api/auth/me`, null, { Authorization: 'Bearer INVALID_TOKEN_XYZ' });
  meMalformed.status === 401 ? pass('GET /api/auth/me — malformed token → 401') : fail('GET /api/auth/me malformed', 401, meMalformed.status);

  // --- 7. Forgot Password (user enumeration check) ---
  const fpExist = await req('POST', `${AUTH}/api/auth/forgot-password`, { email: userA.email });
  const fpMissing = await req('POST', `${AUTH}/api/auth/forgot-password`, { email: 'definitelynotexist@test.com' });
  if (fpExist.status === fpMissing.status && JSON.stringify(fpExist.body) === JSON.stringify(fpMissing.body)) {
    pass('Forgot-password: identical response for existing vs non-existing (no user enumeration)');
  } else {
    sec('User Enumeration', 'POST /api/auth/forgot-password',
      `Different responses: existing=${fpExist.status}:${JSON.stringify(fpExist.body)} | missing=${fpMissing.status}:${JSON.stringify(fpMissing.body)}`);
  }

  // --- 8. Refresh Token ---
  const refreshValid = await req('POST', `${AUTH}/api/auth/refresh-token`, { refreshToken: userA.refresh });
  if (refreshValid.status === 200 && refreshValid.body.accessToken) {
    pass('POST /api/auth/refresh-token — valid');
    userA.token = refreshValid.body.accessToken;
    const oldRefresh = userA.refresh;
    userA.refresh = refreshValid.body.refreshToken;

    // Token replay: reuse old refresh token
    const replay = await req('POST', `${AUTH}/api/auth/refresh-token`, { refreshToken: oldRefresh });
    replay.status === 401 || replay.status === 403 ?
      pass('Token replay: old refreshToken rejected after rotation') :
      sec('Token Replay', 'POST /api/auth/refresh-token', `Old refresh token still accepted after rotation. Status: ${replay.status}`);
  } else {
    fail('POST /api/auth/refresh-token valid', '200 + accessToken', `${refreshValid.status}`, 'High');
  }

  // --- 9. Logout + replay ---
  const logout = await req('POST', `${AUTH}/api/auth/logout`, { refreshToken: userA.refresh });
  logout.status === 200 ? pass('POST /api/auth/logout — valid') : fail('Logout valid', 200, logout.status);

  const relogin = await req('POST', `${AUTH}/api/auth/login`, { email: userA.email, password: 'TestPass123' });
  if (relogin.status === 200) {
    userA.token = relogin.body.accessToken;
    userA.refresh = relogin.body.refreshToken;
  }

  // --- 10. Google Sign-In with fake token ---
  const googleFake = await req('POST', `${AUTH}/api/auth/google-signin`, { idToken: 'fake.google.token.xyz' });
  googleFake.status >= 400 && googleFake.status < 500 ?
    pass('Google signin fake token → graceful 4xx') :
    fail('Google signin fake token', '4xx error', googleFake.status, 'Medium');
  if (googleFake.status === 500) warn('Google signin fake token returned 500 — should return 400/401');

  // --- 11. SECURITY: JWT Tampering ---
  if (userA.token) {
    const parts = userA.token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    payload.userId = userB.userId || 'tampered_id_000000000001';
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
    const tampered = await req('GET', `${AUTH}/api/auth/me`, null, { Authorization: `Bearer ${tamperedToken}` });
    tampered.status === 401 ? pass('SECURITY: JWT payload tampering → 401') :
      sec('JWT Tampering', 'GET /api/auth/me', `Tampered JWT accepted! Status: ${tampered.status}, body: ${JSON.stringify(tampered.body)}`);
  }

  // --- 12. SECURITY: JWT none algorithm ---
  const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const nonePayload = Buffer.from(JSON.stringify({ userId: userA.userId, iat: Math.floor(Date.now()/1000) })).toString('base64url');
  const noneToken = `${noneHeader}.${nonePayload}.`;
  const noneAlg = await req('GET', `${AUTH}/api/auth/me`, null, { Authorization: `Bearer ${noneToken}` });
  noneAlg.status === 401 ? pass('SECURITY: JWT none algorithm rejected → 401') :
    sec('JWT None Algorithm', 'GET /api/auth/me', `None-alg JWT accepted! Status: ${noneAlg.status}`);

  // --- 13. SECURITY: Brute force login (10 rapid attempts) ---
  console.log('\n  [Testing brute force — 10 rapid wrong password attempts]');
  let bruteForce429 = false;
  for (let i = 0; i < 10; i++) {
    const bf = await req('POST', `${AUTH}/api/auth/login`, { email: userA.email, password: `Wrong${i}` });
    if (bf.status === 429) { bruteForce429 = true; break; }
  }
  bruteForce429 ? pass('SECURITY: Brute force login → 429 triggered') :
    sec('Missing Rate Limit', 'POST /api/auth/login', '10 rapid wrong-password attempts did not trigger 429');

  // --- 14. Security: Change Password ---
  if (userA.token) {
    const chgWrong = await req('POST', `${AUTH}/api/security/change-password`, {
      currentPassword: 'WrongCurrentPwd', newPassword: 'NewPass456'
    }, { Authorization: `Bearer ${userA.token}` });
    chgWrong.status === 400 ? pass('Change-password wrong current → 400') : fail('Change-password wrong current', 400, chgWrong.status);

    const chgShort = await req('POST', `${AUTH}/api/security/change-password`, {
      currentPassword: 'TestPass123', newPassword: '123'
    }, { Authorization: `Bearer ${userA.token}` });
    chgShort.status === 400 ? pass('Change-password short new pwd → 400') : fail('Change-password short pwd', 400, chgShort.status, 'Medium');
  }

  // --- 15. 2FA ---
  if (userA.token) {
    const setup2fa = await req('POST', `${AUTH}/api/security/2fa/setup`, null, { Authorization: `Bearer ${userA.token}` });
    setup2fa.status === 200 && setup2fa.body.qrCode ?
      pass('POST /api/security/2fa/setup → qrCode returned') :
      fail('2FA setup', '200 + qrCode', `${setup2fa.status}`, 'Medium');

    const status2fa = await req('GET', `${AUTH}/api/security/2fa/status`, null, { Authorization: `Bearer ${userA.token}` });
    status2fa.status === 200 ? pass('GET /api/security/2fa/status → 200') : fail('2FA status', 200, status2fa.status);

    const invalidTOTP = await req('POST', `${AUTH}/api/security/2fa/verify`, { token: '000000' }, { Authorization: `Bearer ${userA.token}` });
    invalidTOTP.status === 400 || invalidTOTP.status === 401 ?
      pass('2FA verify invalid TOTP → 4xx') :
      fail('2FA verify invalid TOTP', '400 or 401', invalidTOTP.status, 'High');
  }

  // --- 16. Device Management + IDOR ---
  if (userA.token && userB.token) {
    const devicesA = await req('GET', `${AUTH}/api/security/devices`, null, { Authorization: `Bearer ${userA.token}` });
    devicesA.status === 200 ? pass('GET /api/security/devices → 200') : fail('List devices', 200, devicesA.status);

    const devicesB = await req('GET', `${AUTH}/api/security/devices`, null, { Authorization: `Bearer ${userB.token}` });
    const bDeviceId = devicesB.body?.devices?.[0]?._id || devicesB.body?.devices?.[0]?.deviceId;
    if (bDeviceId) {
      const idorDelete = await req('DELETE', `${AUTH}/api/security/devices/${bDeviceId}`, null, { Authorization: `Bearer ${userA.token}` });
      idorDelete.status === 403 || idorDelete.status === 404 ?
        pass(`SECURITY IDOR: User A cannot delete User B's device → ${idorDelete.status}`) :
        sec('IDOR', `DELETE /api/security/devices/${bDeviceId}`,
          `User A deleted User B's device! Status: ${idorDelete.status} — CRITICAL DATA ACCESS`);
    } else {
      warn('Could not get User B deviceId for IDOR test');
    }
  }

  // --- 17. SECURITY: NoSQL Injection on Login ---
  const nosqlLogin1 = await req('POST', `${AUTH}/api/auth/login`, {
    email: { '$gt': '' }, password: { '$gt': '' }
  });
  nosqlLogin1.status !== 200 ? pass(`SECURITY: NoSQL injection $gt login → ${nosqlLogin1.status} (not 200)`) :
    sec('NoSQL Injection', 'POST /api/auth/login', 'Login succeeded with {$gt: ""} payload — CRITICAL');

  const nosqlLogin2 = await req('POST', `${AUTH}/api/auth/login`, {
    email: { '$ne': null }, password: { '$ne': null }
  });
  nosqlLogin2.status !== 200 ? pass(`SECURITY: NoSQL injection $ne login → ${nosqlLogin2.status}`) :
    sec('NoSQL Injection', 'POST /api/auth/login', 'Login succeeded with {$ne: null} payload — CRITICAL');

  const nosqlLogin3 = await req('POST', `${AUTH}/api/auth/login`, {
    identifier: { '$regex': '.*' }, password: 'anything'
  });
  nosqlLogin3.status !== 200 ? pass(`SECURITY: NoSQL $regex login → ${nosqlLogin3.status}`) :
    sec('NoSQL Injection', 'POST /api/auth/login', 'Login succeeded with {$regex: ".*"} payload — CRITICAL');

  // ===== PRINT AUTH RESULTS =====
  console.log('\n====== AUTH PHASE 1 COMPLETE ======');
  console.log(`✅ Passed: ${results.passed.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`🔴 Security: ${results.security.length}`);
  console.log(`🟡 Warnings: ${results.warnings.length}`);

  if (results.failed.length) {
    console.log('\n--- FAILURES ---');
    results.failed.forEach(f => console.log(`  [${f.severity}] ${f.name}: expected ${f.expected}, got ${f.actual}`));
  }
  if (results.security.length) {
    console.log('\n--- SECURITY ISSUES ---');
    results.security.forEach(s => console.log(`  [${s.type}] ${s.endpoint}: ${s.detail}`));
  }

  // Export tokens for phase 2
  const fs = require('fs');
  fs.writeFileSync('test_tokens.json', JSON.stringify({ userA, userB }, null, 2));
  console.log('\n📁 Tokens saved to test_tokens.json for Phase 2\n');
}

run().catch(console.error);
