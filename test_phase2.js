const http = require('http');
const HOME = 'http://localhost:5001';
let tok = null, userAId = null, userBTok = null;
let P = [], F = [], S = [], W = [];

function req(method, url, body, headers={}) {
  return new Promise(resolve => {
    const u = new URL(url);
    const o = { hostname:u.hostname, port:u.port, path:u.pathname+u.search, method,
      headers:{'Content-Type':'application/json',...headers} };
    const r = http.request(o, res => {
      let d=''; res.on('data',c=>d+=c);
      res.on('end',()=>{ try{resolve({s:res.statusCode,b:JSON.parse(d)})}catch{resolve({s:res.statusCode,b:d})} });
    });
    r.on('error',()=>resolve({s:0,b:'ERR'}));
    if(body) r.write(JSON.stringify(body));
    r.end();
  });
}
const pass=(n)=>{P.push(n);console.log('✅',n)};
const fail=(n,e,a,sev='Med')=>{F.push({n,e,a,sev});console.log(`❌[${sev}] ${n} | exp:${e} got:${a}`)};
const sec=(t,ep,d)=>{S.push({t,ep,d});console.log(`🔴[${t}] ${ep}: ${d}`)};
const warn=(m)=>{W.push(m);console.log('🟡',m)};
const auth=(t)=>({Authorization:`Bearer ${t}`});

async function run(){
  console.log('\n=== PHASE 2 — HOME BACKEND (5001) ===\n');

  // Health
  const h=await req('GET',`${HOME}/health`);
  h.s===200 ? pass('GET /health → 200') : fail('GET /health',200,h.s,'High');

  // Need login via auth (skip if offline, use manual token)
  // Try signup directly through home's JWT (won't work - home has no signup)
  // Test no-token first
  const noTok=await req('GET',`${HOME}/api/dashboard`);
  noTok.s===401 ? pass('No token → 401') : fail('No-token check',401,noTok.s,'High');

  const badTok=await req('GET',`${HOME}/api/dashboard`,null,auth('BADTOKEN'));
  badTok.s===401 ? pass('Malformed token → 401') : fail('Malformed token',401,badTok.s,'High');

  // Try to get a token — need auth backend online
  const ts = Date.now();
  const login=await req('POST','http://localhost:3210/api/auth/signup',{username:`user_${ts}`,email:`user_${ts}@test.com`,password:'Password123!',confirmPassword:'Password123!',phone:`+2011${ts.toString().slice(-8)}`});
  if(login.s===201 && login.b?.accessToken){
    tok=login.b.accessToken; userAId=login.b.user?.id;
    pass('Login → got token');
  } else {
    fail('Auth login (needed for home tests)','201+token',`${login.s} - AUTH OFFLINE`,'Critical');
    console.log('\n⚠️  Auth backend is offline — home-backend tests requiring auth cannot run.');
    console.log('   CAUSE: MongoDB Atlas IP not whitelisted. Fix → whitelist this machine IP in Atlas Network Access.\n');
    // Run only unauthenticated security tests
    await runNoAuthTests();
    return printReport();
  }

  // Dashboard
  const dash=await req('GET',`${HOME}/api/dashboard`,null,auth(tok));
  if(dash.s===200 && dash.b?.balance!==undefined) pass('GET /api/dashboard → 200 + balance');
  else fail('GET /api/dashboard','200+balance',`${dash.s} ${JSON.stringify(dash.b).slice(0,60)}`,'High');

  // Profile
  const prof=await req('GET',`${HOME}/api/profile`,null,auth(tok));
  prof.s===200 ? pass('GET /api/profile → 200') : fail('GET /api/profile',200,prof.s);
  if(prof.s===200 && prof.b?.userId && prof.b.userId!==userAId) warn('Profile userId may not match token userId');

  const profUp=await req('PUT',`${HOME}/api/profile`,{displayName:'Test QA User',currency:'EGP'},auth(tok));
  profUp.s===200 ? pass('PUT /api/profile valid → 200') : fail('PUT /api/profile',200,profUp.s);
  const badCur=await req('PUT',`${HOME}/api/profile`,{currency:'XYZ'},auth(tok));
  badCur.s===400 ? pass('PUT /api/profile invalid currency → 400') : warn(`Invalid currency returned ${badCur.s} not 400`);

  // Transactions
  const tx1=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:150.5,category:'Groceries',description:'QA test expense'},auth(tok));
  let txId=null;
  if(tx1.s===201 && tx1.b?.transaction?._id){ pass('POST /api/transactions expense → 201'); txId=tx1.b.transaction._id; }
  else fail('POST transaction expense','201',`${tx1.s}`,'High');

  const tx2=await req('POST',`${HOME}/api/transactions`,{type:'income',amount:5000,category:'Salary'},auth(tok));
  tx2.s===201 ? pass('POST /api/transactions income → 201') : fail('POST transaction income','201',`${tx2.s}`);

  const txMin=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:10,category:'Food'},auth(tok));
  txMin.s===201 ? pass('POST transaction minimum fields → 201') : fail('POST transaction min fields','201',`${txMin.s}`);

  // Boundary: amount=0
  const tx0=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:0,category:'Test'},auth(tok));
  tx0.s===400 ? pass('Transaction amount=0 → 400') : fail('Transaction amount=0','400',`${tx0.s}`,'Medium');

  // Boundary: negative
  const txNeg=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:-50,category:'Test'},auth(tok));
  txNeg.s===400 ? pass('Transaction amount=-50 → 400') : fail('Transaction negative amount','400',`${txNeg.s}`,'Medium');

  // Missing required fields
  const txMiss=await req('POST',`${HOME}/api/transactions`,{description:'no type or amount'},auth(tok));
  txMiss.s===400 ? pass('Transaction missing type/amount → 400') : fail('Transaction missing fields','400',`${txMiss.s}`);

  // Large expense notification trigger
  const txLarge=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:750,category:'Electronics',description:'QA large expense'},auth(tok));
  if(txLarge.s===201) pass('POST transaction ≥500 (FCM trigger) → 201 (notification async)');
  else fail('POST transaction ≥500','201',`${txLarge.s}`);

  // Get transactions
  const txList=await req('GET',`${HOME}/api/transactions`,null,auth(tok));
  txList.s===200 && txList.b?.transactions ? pass('GET /api/transactions list → 200') : fail('GET transactions list','200',`${txList.s}`);

  const txFilter=await req('GET',`${HOME}/api/transactions?type=expense&limit=5&page=1`,null,auth(tok));
  txFilter.s===200 ? pass('GET /api/transactions with filters → 200') : fail('GET transactions filtered','200',`${txFilter.s}`);

  // Invalid ObjectId
  const txBadId=await req('GET',`${HOME}/api/transactions/NOT_A_VALID_ID`,null,auth(tok));
  txBadId.s===400||txBadId.s===404 ? pass(`GET /api/transactions/INVALID_ID → ${txBadId.s} (not 500)`) :
    fail('Invalid ObjectId','400 or 404',txBadId.s,'Medium');
  if(txBadId.s===500) sec('Unhandled Error','GET /api/transactions/INVALID_ID','Malformed ObjectId causes 500 — leaks stack trace');

  // Valid-but-nonexistent ObjectId
  const txNotExist=await req('GET',`${HOME}/api/transactions/000000000000000000000001`,null,auth(tok));
  txNotExist.s===404 ? pass('GET nonexistent txId → 404') : fail('GET nonexistent txId','404',txNotExist.s);

  // Update + balance recalc
  if(txId){
    const txUp=await req('PUT',`${HOME}/api/transactions/${txId}`,{amount:200,description:'Updated QA'},auth(tok));
    txUp.s===200 ? pass('PUT /api/transactions/:id → 200') : fail('PUT transaction','200',`${txUp.s}`);
    const txDel=await req('DELETE',`${HOME}/api/transactions/${txId}`,null,auth(tok));
    txDel.s===200 ? pass('DELETE /api/transactions/:id → 200') : fail('DELETE transaction','200',`${txDel.s}`);
    const txDelAgain=await req('DELETE',`${HOME}/api/transactions/${txId}`,null,auth(tok));
    txDelAgain.s===404 ? pass('DELETE same id again → 404') : warn(`DELETE again returned ${txDelAgain.s} not 404`);
  }

  // Mass assignment / field injection
  const massAssign=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:1,category:'Test',
    userId:'hacked_user_id',_id:'injected_id',__v:99,createdAt:'2000-01-01'},auth(tok));
  if(massAssign.s===201){
    const createdTx=massAssign.b?.transaction;
    if(createdTx?._id==='injected_id'||createdTx?.userId==='hacked_user_id')
      sec('Mass Assignment','POST /api/transactions','Injected _id or userId was accepted and persisted!');
    else pass('Mass assignment fields ignored (userId/_id not overwritten)');
  }

  // Type coercion: string amount
  const strAmt=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:'150',category:'Test'},auth(tok));
  if(strAmt.s===201) warn('String amount "150" was accepted — server auto-casts string to number');
  else if(strAmt.s===400) pass('String amount rejected → 400');

  // Large payload injection
  const bigNotes=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:1,category:'Test',notes:'X'.repeat(100000)},auth(tok));
  bigNotes.s!==500 ? pass(`Large notes payload → ${bigNotes.s} (not 500)`) :
    sec('Large Payload','POST /api/transactions','100k char notes causes 500');

  // NoSQL date injection
  const nosqlDate=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:1,category:'Test',date:{'$gt':'2000-01-01'}},auth(tok));
  nosqlDate.s===400||nosqlDate.s===201 ? pass(`NoSQL date injection → ${nosqlDate.s} (handled)`) :
    sec('NoSQL Injection','POST /api/transactions','MongoDB operator in date field may be executed');

  // NoSQL query param injection
  const nosqlQ=await req('GET',`${HOME}/api/transactions?category[$ne]=x`,null,auth(tok));
  nosqlQ.s!==500 ? pass(`NoSQL query param $ne → ${nosqlQ.s} (not 500)`) :
    sec('NoSQL Injection','GET /api/transactions?category[$ne]=x','Operator in query param causes 500');

  // Budgets
  const bud=await req('POST',`${HOME}/api/budgets`,{name:'QA Budget',category:'Food',limitAmount:1000,alertThreshold:80},auth(tok));
  let budId=null;
  if(bud.s===201){pass('POST /api/budgets → 201'); budId=bud.b?.budget?._id;}
  else fail('POST /api/budgets','201',`${bud.s}`);

  const budList=await req('GET',`${HOME}/api/budgets`,null,auth(tok));
  budList.s===200 ? pass('GET /api/budgets → 200') : fail('GET budgets','200',`${budList.s}`);

  if(budId){
    const budUp=await req('PUT',`${HOME}/api/budgets/${budId}`,{limitAmount:1500},auth(tok));
    budUp.s===200 ? pass('PUT /api/budgets/:id → 200') : fail('PUT budget','200',`${budUp.s}`);
    const budDel=await req('DELETE',`${HOME}/api/budgets/${budId}`,null,auth(tok));
    budDel.s===200 ? pass('DELETE /api/budgets/:id → 200') : fail('DELETE budget','200',`${budDel.s}`);
  }

  // Savings
  const sav=await req('POST',`${HOME}/api/savings`,{name:'QA Goal',targetAmount:1000,priority:'high'},auth(tok));
  let savId=null;
  if(sav.s===201){pass('POST /api/savings → 201'); savId=sav.b?.savingsGoal?._id;}
  else fail('POST /api/savings','201',`${sav.s}`);

  if(savId){
    const contrib=await req('POST',`${HOME}/api/savings/${savId}/contribute`,{amount:250},auth(tok));
    if(contrib.s===200) pass('POST /api/savings/:id/contribute (25%) → 200');
    else fail('Contribute to savings','200',`${contrib.s}`);
    const contrib2=await req('POST',`${HOME}/api/savings/${savId}/contribute`,{amount:750},auth(tok));
    contrib2.s===200 ? pass('Contribute to 100% (goal complete) → 200') : fail('Contribute 100%','200',`${contrib2.s}`);
    const savDel=await req('DELETE',`${HOME}/api/savings/${savId}`,null,auth(tok));
    savDel.s===200 ? pass('DELETE /api/savings/:id → 200') : fail('DELETE savings','200',`${savDel.s}`);
  }

  // Debts
  const debt=await req('POST',`${HOME}/api/debts`,{creditorName:'QA Bank',totalAmount:5000,interestRate:5},auth(tok));
  let debtId=null;
  if(debt.s===201){pass('POST /api/debts → 201'); debtId=debt.b?.debt?._id;}
  else fail('POST /api/debts','201',`${debt.s}`);
  if(debtId){
    const debtPay=await req('POST',`${HOME}/api/debts/${debtId}/payment`,{amount:500,notes:'QA payment'},auth(tok));
    debtPay.s===200 ? pass('POST /api/debts/:id/payment → 200') : fail('Debt payment','200',`${debtPay.s}`);
    const debtDel=await req('DELETE',`${HOME}/api/debts/${debtId}`,null,auth(tok));
    debtDel.s===200 ? pass('DELETE /api/debts/:id → 200') : fail('DELETE debt','200',`${debtDel.s}`);
  }

  // Analytics
  ['weekly','monthly','yearly'].forEach(async p=>{
    const an=await req('GET',`${HOME}/api/analytics/overview?period=${p}`,null,auth(tok));
    an.s===200 ? pass(`GET /api/analytics/overview?period=${p} → 200`) : fail(`Analytics ${p}`,200,an.s);
  });

  // Offers
  const off=await req('GET',`${HOME}/api/offers`,null,auth(tok));
  off.s===200 ? pass('GET /api/offers → 200') : fail('GET offers','200',`${off.s}`);

  // Settings
  const set=await req('GET',`${HOME}/api/settings`,null,auth(tok));
  set.s===200 ? pass('GET /api/settings → 200') : fail('GET settings','200',`${set.s}`);
  const setTheme=await req('PUT',`${HOME}/api/settings/theme`,{theme:'dark'},auth(tok));
  setTheme.s===200 ? pass('PUT /api/settings/theme → 200') : fail('PUT settings/theme','200',`${setTheme.s}`);

  // Categories
  const cats=await req('GET',`${HOME}/api/categories`,null,auth(tok));
  if(cats.s===200 && cats.b?.categories?.length>0) pass('GET /api/categories → 200 with system categories');
  else fail('GET /api/categories','200+data',`${cats.s}`);

  const sysId=cats.b?.categories?.find(c=>c.isSystem)?._id;
  if(sysId){
    const editSys=await req('PUT',`${HOME}/api/categories/${sysId}`,{name:'Hacked'},auth(tok));
    editSys.s===403||editSys.s===404 ? pass(`Edit system category → ${editSys.s} (blocked)`) :
      sec('Unauthorized Write','PUT /api/categories/:systemId',`System category editable! Status: ${editSys.s}`);
    const delSys=await req('DELETE',`${HOME}/api/categories/${sysId}`,null,auth(tok));
    delSys.s===403||delSys.s===404 ? pass(`Delete system category → ${delSys.s} (blocked)`) :
      sec('Unauthorized Delete','DELETE /api/categories/:systemId',`System category deletable! Status: ${delSys.s}`);
  }

  const newCat=await req('POST',`${HOME}/api/categories`,{name:'QA_Custom_Cat',type:'expense',icon:'🧪'},auth(tok));
  let catId=null;
  if(newCat.s===201){pass('POST /api/categories custom → 201'); catId=newCat.b?.category?._id;}
  else fail('POST custom category','201',`${newCat.s}`);
  const dupCat=await req('POST',`${HOME}/api/categories`,{name:'QA_Custom_Cat',type:'expense'},auth(tok));
  dupCat.s===409 ? pass('Duplicate category name → 409') : fail('Duplicate category','409',`${dupCat.s}`);
  if(catId){
    const delCat=await req('DELETE',`${HOME}/api/categories/${catId}`,null,auth(tok));
    delCat.s===200 ? pass('DELETE custom category → 200') : fail('DELETE custom cat','200',`${delCat.s}`);
  }

  // FCM
  const fcmReg=await req('POST',`${HOME}/api/notifications/register-token`,{fcmToken:'QA_test_token_12345',deviceType:'android',deviceName:'QA Device'},auth(tok));
  fcmReg.s===200 ? pass('POST /api/notifications/register-token → 200') : fail('FCM register','200',`${fcmReg.s}`);
  const fcmTest=await req('POST',`${HOME}/api/notifications/test`,null,auth(tok));
  fcmTest.s===200 ? pass('POST /api/notifications/test → 200') : fail('FCM test','200',`${fcmTest.s}`);
  const fcmUnreg=await req('DELETE',`${HOME}/api/notifications/unregister-token`,{fcmToken:'QA_test_token_12345'},auth(tok));
  fcmUnreg.s===200 ? pass('DELETE /api/notifications/unregister-token → 200') : fail('FCM unregister','200',`${fcmUnreg.s}`);

  // AI Chat
  const aiChat=await req('POST',`${HOME}/api/ai/chat`,{message:'How is my spending?'},auth(tok));
  aiChat.s===200||aiChat.s===503||aiChat.s===504 ? pass(`POST /api/ai/chat → ${aiChat.s}`) : fail('AI chat','200/503/504',`${aiChat.s}`);
  const aiEmpty=await req('POST',`${HOME}/api/ai/chat`,{message:''},auth(tok));
  aiEmpty.s===400 ? pass('AI chat empty message → 400') : fail('AI chat empty','400',`${aiEmpty.s}`);

  // AI Categorize
  const aiCat=await req('POST',`${HOME}/api/ai/categorize`,{text:'Uber ride 85 EGP'},auth(tok));
  aiCat.s===200||aiCat.s===503 ? pass(`POST /api/ai/categorize EN → ${aiCat.s}`) : fail('AI categorize EN','200/503',`${aiCat.s}`);
  const aiCatAr=await req('POST',`${HOME}/api/ai/categorize`,{text:'فاتورة كهرباء 320 جنيه'},auth(tok));
  aiCatAr.s===200||aiCatAr.s===503 ? pass(`POST /api/ai/categorize AR → ${aiCatAr.s}`) : fail('AI categorize AR','200/503',`${aiCatAr.s}`);
  const aiCatEmpty=await req('POST',`${HOME}/api/ai/categorize`,{text:''},auth(tok));
  aiCatEmpty.s===400||aiCatEmpty.s===200 ? pass(`AI categorize empty → ${aiCatEmpty.s}`) : warn(`AI categorize empty text: ${aiCatEmpty.s}`);

  // IDOR check: create a transaction as userA, try to access as userB
  const txA=await req('POST',`${HOME}/api/transactions`,{type:'expense',amount:1,category:'IDOR Test'},auth(tok));
  if(txA.s===201 && txA.b?.transaction?._id && userBTok){
    const txAId=txA.b.transaction._id;
    const idorGet=await req('GET',`${HOME}/api/transactions/${txAId}`,null,auth(userBTok));
    idorGet.s===403||idorGet.s===404 ? pass(`IDOR: User B cannot GET User A's transaction → ${idorGet.s}`) :
      sec('IDOR','GET /api/transactions/:id',`User B accessed User A's transaction! Status: ${idorGet.s}`);
    const idorDel=await req('DELETE',`${HOME}/api/transactions/${txAId}`,null,auth(userBTok));
    idorDel.s===403||idorDel.s===404 ? pass(`IDOR: User B cannot DELETE User A's transaction → ${idorDel.s}`) :
      sec('IDOR','DELETE /api/transactions/:id',`User B deleted User A's transaction! Status: ${idorDel.s}`);
    // cleanup
    await req('DELETE',`${HOME}/api/transactions/${txAId}`,null,auth(tok));
  } else warn('IDOR test skipped — no User B token or txA creation failed');

  printReport();
}

async function runNoAuthTests(){
  console.log('\n--- Running unauthenticated security tests only ---\n');
  const noTok=await req('GET',`${HOME}/api/dashboard`);
  noTok.s===401 ? pass('No token → 401') : fail('No-token check',401,noTok.s,'High');
  const bad=await req('GET',`${HOME}/api/profile`,null,{Authorization:'Bearer FAKEJWT'});
  bad.s===401 ? pass('Bad token → 401') : fail('Bad token check',401,bad.s,'High');
  const h=await req('GET',`${HOME}/health`);
  h.s===200 ? pass('Home /health → 200') : fail('Home /health',200,h.s,'High');
}

function printReport(){
  console.log('\n\n======================================');
  console.log('     FULL QA + SECURITY REPORT');
  console.log('======================================');
  console.log(`\n✅ PASSED (${P.length}):`);
  P.forEach(p=>console.log(`   • ${p}`));
  console.log(`\n❌ FAILED (${F.length}):`);
  F.forEach(f=>console.log(`   [${f.sev}] ${f.n}: expected ${f.e} → got ${f.a}`));
  console.log(`\n🔴 SECURITY ISSUES (${S.length}):`);
  S.forEach(s=>console.log(`   [${s.t}] ${s.ep}: ${s.d}`));
  console.log(`\n🟡 WARNINGS (${W.length}):`);
  W.forEach(w=>console.log(`   • ${w}`));
  const total=P.length+F.length;
  const rate=total>0?Math.round((P.length/total)*100):0;
  console.log('\n📊 SUMMARY');
  console.log(`   Total tests run : ${total}`);
  console.log(`   Pass rate       : ${rate}%`);
  console.log(`   Security issues : ${S.length}`);
  console.log(`   Critical failures: ${F.filter(f=>f.sev==='High'||f.sev==='Critical').length}`);
  console.log('\n======================================\n');
  const fs=require('fs');
  fs.writeFileSync('qa_report.json',JSON.stringify({passed:P,failed:F,security:S,warnings:W},null,2));
  console.log('📁 Full report saved → qa_report.json\n');
}

run().catch(console.error);
