import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from '../server.mjs';

const valid={name:'Jamie',email:'jamie@example.com',business:'Little Studio',channel:'Etsy',shopUrl:'https://example.com/shop',service:'Listing refresh',challenge:'Help improve my listings.',consent:true};
async function runServer(options,fn) {
  const server=createServer(options);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {return await fn(`http://127.0.0.1:${server.address().port}`);} finally {await new Promise(resolve=>server.close(resolve));}
}
const post=(base,body,headers={})=>fetch(`${base}/api/leads`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});

test('inquiries persist and a new server can retrieve them',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'growth-leads-'));
  try {
    let id;
    await runServer({leadDirectory:directory},async base=>{
      assert.deepEqual(await (await fetch(`${base}/api/leads`)).json(),[]);
      const response=await post(base,valid);
      assert.equal(response.status,201);
      const result=await response.json();id=result.id;
      assert.deepEqual(Object.keys(result),['id']);
      assert.equal(JSON.parse((await readFile(join(directory,'leads.jsonl'),'utf8')).trim()).email,valid.email);
    });
    await runServer({leadDirectory:directory},async base=>{
      const records=await (await fetch(`${base}/api/leads`)).json();
      assert.equal(records.length,1);assert.equal(records[0].id,id);assert.equal(records[0].consent,true);
    });
  } finally {await rm(directory,{recursive:true,force:true});}
});

test('invalid input, content type, body limits and origin never save',async()=>{
  let saves=0;
  await runServer({leadStore:{save:async()=>{saves++;},list:async()=>[]}},async base=>{
    for(const patch of [{email:'bad'},{consent:false},{name:' '},{name:'x'.repeat(101)},{challenge:'x'.repeat(3001)},{shopUrl:'https://example.com/'+ 'x'.repeat(2000)},{shopUrl:'javascript:alert(1)'},{shopUrl:'https://user:pass@example.com'},{service:''},{channel:123}]) assert.equal((await post(base,{...valid,...patch})).status,400);
    assert.equal((await post(base,valid,{Origin:'https://unrelated.example'})).status,403);
    assert.equal((await fetch(`${base}/api/leads`,{headers:{Origin:'https://unrelated.example'}})).status,403);
    assert.equal((await post(base,valid,{'Content-Type':'text/plain'})).status,415);
    assert.equal((await post(base,{...valid,challenge:'x'.repeat(51000)})).status,413);
    assert.equal((await fetch(`${base}/api/leads`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
    assert.equal(saves,0);
  });
});

test('optional notes and shop link can be omitted or left empty',async()=>{
  const saved=[];
  await runServer({leadStore:{save:async lead=>{saved.push(lead);return {id:'test-id'};},list:async()=>saved}},async base=>{
    const {challenge,shopUrl,...required}=valid;
    assert.equal((await post(base,required)).status,201);
    assert.equal((await post(base,{...required,challenge:'',shopUrl:''})).status,201);
    assert.equal(saved.length,2);
    for(const lead of saved) {assert.equal(lead.challenge,'');assert.equal(lead.shopUrl,'');}
  });
});

test('storage errors return safe failures and never acknowledge a save',async()=>{
  const fail=async()=>{throw new Error('Private disk path C:/private/leads.jsonl');};
  await runServer({leadStore:{save:fail,list:fail}},async base=>{
    const response=await post(base,valid);assert.equal(response.status,500);assert.doesNotMatch(await response.text(),/private|"id"/);
    const read=await fetch(`${base}/api/leads`);assert.equal(read.status,500);assert.doesNotMatch(await read.text(),/private/);
  });
});

test('malformed saved records are rejected instead of returned',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'growth-leads-'));
  try {
    await writeFile(join(directory,'leads.jsonl'),JSON.stringify({...valid,id:'bad',createdAt:'bad'})+'\n');
    await runServer({leadDirectory:directory},async base=>assert.equal((await fetch(`${base}/api/leads`)).status,500));
  } finally {await rm(directory,{recursive:true,force:true});}
});
