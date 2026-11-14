import test from 'node:test';
import assert from 'node:assert/strict';
import {get} from 'node:http';
import {createHttpApp} from '../server.mjs';
test('HTTP rejects foreign origins, hosts, oversized bodies, invalid JSON and arbitrary tool input',async()=>{
  const server=createHttpApp('<p>Sample</p>',{port:8788}).listen(8788,'127.0.0.1');
  await new Promise(r=>server.once('listening',r));
  try {
    const base='http://127.0.0.1:8788';
    assert.equal((await fetch(base+'/health')).status,200);
    assert.equal((await fetch(base+'/health',{headers:{Origin:'https://evil.example'}})).status,403);
    const hostStatus=await new Promise((resolve,reject)=>get(base+'/health',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject));
    assert.equal(hostStatus,403);
    assert.equal((await fetch(base+'/demo/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
    assert.equal((await fetch(base+'/demo/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({long:'a'.repeat(26000)})})).status,413);
    assert.equal((await fetch(base+'/demo/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'read_real_calendar',arguments:{}})})).status,200);
    const result=await fetch(base+'/demo/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'start_sample_day',arguments:{realLocation:'secret'}})}).then(r=>r.json());assert.equal(result.isError,true);
    assert.equal((await fetch(base+'/mcp')).status,405);
  }finally{await new Promise(r=>server.close(r));}
});
