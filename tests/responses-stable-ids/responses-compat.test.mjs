import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bodyWithStableIds} from '../../src/lib/responses/responses-compat.mjs';
const fixture=fs.readFileSync(new URL('./fixtures/astra.sse', import.meta.url),'utf8');
function upstream(type='text/event-stream',status=200){return new Response(fixture,{status,headers:{'content-type':type}});}
const request=JSON.stringify({model:'gpt-6-astra',stream:true});
test('real broken GPT6 SSE is normalized when explicitly in scope',async()=>{
 const r=upstream();const body=bodyWithStableIds(r,request,true);
 const raw=await new Response(body).text();
 const events=raw.split('\n').filter(x=>x.startsWith('data: ')).map(x=>JSON.parse(x.slice(6)));
 const responseIds=new Set(events.filter(e=>e.response).map(e=>e.response.id));
 assert.equal(responseIds.size,1);
});
for(const [label,payload,type,status,enabled] of [
 ['other model',{model:'gpt-5.5',stream:true},'text/event-stream',200,true],
 ['nonstream',{model:'gpt-6-astra',stream:false},'text/event-stream',200,true],
 ['JSON response',{model:'gpt-6-astra',stream:true},'application/json',200,true],
 ['HTTP error',{model:'gpt-6-astra',stream:true},'text/event-stream',429,true],
 ['kill switch',{model:'gpt-6-astra',stream:true},'text/event-stream',200,false],
 ['stream missing',{model:'gpt-6-astra'},'text/event-stream',200,true]
])test(label+' is exact same body object',()=>{const r=upstream(type,status);assert.equal(bodyWithStableIds(r,JSON.stringify(payload),enabled),r.body);});
test('malformed request bypasses normalizer without hiding upstream response',()=>{const r=upstream();assert.equal(bodyWithStableIds(r,'{broken'),r.body);});
