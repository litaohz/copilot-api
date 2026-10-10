#!/usr/bin/env node
import{defineCommand as e,runMain as t}from"citty";import n from"consola";import r,{copyFile as i,mkdir as a,readFile as o,writeFile as s}from"node:fs/promises";import c,{homedir as l}from"node:os";import u,{join as d}from"node:path";import{randomUUID as f,timingSafeEqual as p}from"node:crypto";import{serve as ee}from"srvx";import{getProxyForUrl as te}from"proxy-from-env";import{Agent as ne,ProxyAgent as re,setGlobalDispatcher as ie}from"undici";import{Hono as m}from"hono";import{cors as ae}from"hono/cors";import{streamSSE as h}from"hono/streaming";import{events as oe}from"fetch-event-stream";var g={name:`xc-copilot-api`,version:`1.2.6`,description:`Turn GitHub Copilot into OpenAI/Anthropic API compatible server. Usable with Claude Code and Codex`,keywords:[`proxy`,`github-copilot`,`openai-compatible`],homepage:`https://github.com/litaohz/copilot-api`,bugs:`https://github.com/litaohz/copilot-api/issues`,repository:{type:`git`,url:`git+https://github.com/litaohz/copilot-api.git`},author:`Xiaochen <wxc9312@gmail.com>`,type:`module`,bin:{"xc-copilot-api":`./dist/main.js`},files:[`dist`],scripts:{build:`bun run scripts/generate-page.ts && tsdown`,dev:`bun run scripts/generate-page.ts && bun run --watch ./src/main.ts start`,knip:`knip-bun`,lint:`eslint --cache`,"lint:all":`eslint --cache .`,prepack:`bun run build`,release:`bumpp && bun publish --access public`,start:`NODE_ENV=production bun run ./src/main.ts start`,typecheck:`tsc`},dependencies:{citty:`^0.1.6`,consola:`^3.4.2`,"fetch-event-stream":`^0.1.5`,"gpt-tokenizer":`^3.0.1`,hono:`^4.9.9`,"proxy-from-env":`^1.1.0`,srvx:`^0.8.9`,undici:`^7.16.0`},devDependencies:{"@echristian/eslint-config":`^0.0.54`,"@types/bun":`^1.2.23`,"@types/proxy-from-env":`^1.0.4`,bumpp:`^10.2.3`,eslint:`^9.37.0`,knip:`^5.64.1`,"prettier-plugin-packagejson":`^3.0.2`,tsdown:`^0.15.6`,typescript:`^5.9.3`}};const _=u.join(c.homedir(),`.local`,`share`,`copilot-api`),se=u.join(_,`github_token`),v={APP_DIR:_,GITHUB_TOKEN_PATH:se};async function y(){await r.mkdir(v.APP_DIR,{recursive:!0}),await ce(v.GITHUB_TOKEN_PATH)}async function ce(e){try{await r.access(e,r.constants.W_OK)}catch{await r.writeFile(e,``),await r.chmod(e,384)}}const b={accountType:`individual`,manualApprove:!1,rateLimitWait:!1,showToken:!1,paused:!1},x=()=>({"content-type":`application/json`,accept:`application/json`}),le=`0.26.7`,S=`copilot-chat/${le}`,ue=`GitHubCopilotChat/${le}`,de=`2025-04-01`,C=e=>e.accountType===`individual`?`https://api.githubcopilot.com`:`https://api.${e.accountType}.githubcopilot.com`,w=(e,t=!1)=>{let n={Authorization:`Bearer ${e.copilotToken}`,"content-type":x()[`content-type`],"copilot-integration-id":`vscode-chat`,"editor-version":`vscode/${e.vsCodeVersion}`,"editor-plugin-version":S,"user-agent":ue,"openai-intent":`conversation-panel`,"x-github-api-version":de,"x-request-id":f(),"x-vscode-user-agent-library-version":`electron-fetch`};return t&&(n[`copilot-vision-request`]=`true`),n},T=`https://api.github.com`,E=e=>({...x(),authorization:`token ${e.githubToken}`,"editor-version":`vscode/${e.vsCodeVersion}`,"editor-plugin-version":S,"user-agent":ue,"x-github-api-version":de,"x-vscode-user-agent-library-version":`electron-fetch`}),D=`https://github.com`,O=`Iv1.b507a08c87ecfe98`,fe=[`read:user`].join(` `);var k=class extends Error{response;constructor(e,t){super(e),this.response=t}};async function A(e,t){if(n.error(`Error occurred:`,t),t instanceof k){let r=await t.response.text(),i;try{i=JSON.parse(r)}catch{i=r}n.error(`HTTP error:`,i);let a=typeof i==`object`&&!!i&&`error`in i&&typeof i.error==`object`&&i.error!==null,o=t.response.headers.get(`x-request-id`);return o&&e.header(`x-request-id`,o),e.json(a?i:{error:{message:r,type:`error`}},t.response.status)}return e.json({error:{message:t.message,type:`error`}},500)}const j=async()=>{let e=await fetch(`${T}/copilot_internal/v2/token`,{headers:E(b)});if(!e.ok)throw new k(`Failed to get Copilot token`,e);return await e.json()};async function pe(){let e=await fetch(`${D}/login/device/code`,{method:`POST`,headers:x(),body:JSON.stringify({client_id:O,scope:fe})});if(!e.ok)throw new k(`Failed to get device code`,e);return await e.json()}async function me(){let e=await fetch(`${T}/user`,{headers:{authorization:`token ${b.githubToken}`,...x()}});if(!e.ok)throw new k(`Failed to get GitHub user`,e);return await e.json()}const he=async()=>{let e=await fetch(`${C(b)}/models`,{headers:w(b)});if(!e.ok)throw new k(`Failed to get models`,e);return await e.json()},ge=`1.104.3`;async function _e(){let e=new AbortController,t=setTimeout(()=>{e.abort()},5e3);try{let t=(await(await fetch(`https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=visual-studio-code-bin`,{signal:e.signal})).text()).match(/pkgver=([0-9.]+)/);return t?t[1]:ge}catch{return ge}finally{clearTimeout(t)}}await _e();const M=e=>new Promise(t=>{setTimeout(t,e)}),ve=e=>e==null;async function ye(){b.models=await he()}const be=async()=>{let e=await _e();b.vsCodeVersion=e,n.info(`Using VSCode version: ${e}`)};async function xe(e){let t=(e.interval+1)*1e3;for(n.debug(`Polling access token with interval of ${t}ms`);;){let r=await fetch(`${D}/login/oauth/access_token`,{method:`POST`,headers:x(),body:JSON.stringify({client_id:O,device_code:e.device_code,grant_type:`urn:ietf:params:oauth:grant-type:device_code`})});if(!r.ok){await M(t),n.error(`Failed to poll access token:`,await r.text());continue}let i=await r.json();n.debug(`Polling access token response:`,i);let{access_token:a}=i;if(a)return a;await M(t)}}const Se=()=>r.readFile(v.GITHUB_TOKEN_PATH,`utf8`),Ce=e=>r.writeFile(v.GITHUB_TOKEN_PATH,e),we=e=>new Promise(t=>{setTimeout(t,e)}),Te=async(e=3,t=1e3)=>{let r=null;for(let i=0;i<e;i++)try{return await j()}catch(a){r=a;let o=t*2**i;n.warn(`Token refresh attempt ${i+1}/${e} failed, retrying in ${o}ms:`,r.message),i<e-1&&await we(o)}throw r||Error(`Failed to refresh Copilot token`)},Ee=async()=>{try{n.debug(`Force refreshing Copilot token due to 401 response`);let{token:e}=await Te();b.copilotToken=e,n.debug(`Copilot token force refreshed successfully`)}catch(e){n.error(`Failed to force refresh Copilot token:`,e)}},De=async()=>{let{token:e,refresh_in:t}=await j();b.copilotToken=e,n.debug(`GitHub Copilot Token fetched successfully!`),b.showToken&&n.info(`Copilot token:`,e);let r=(t-60)*1e3;setInterval(async()=>{try{n.debug(`Refreshing Copilot token`);let{token:e}=await Te();b.copilotToken=e,n.debug(`Copilot token refreshed successfully`),b.showToken&&n.info(`Refreshed Copilot token:`,e)}catch(e){n.error(`Failed to refresh Copilot token, will retry on next interval:`,e)}},r)};async function N(e){try{let t=await Se();if(t&&!e?.force){b.githubToken=t,b.showToken&&n.info(`GitHub token:`,t),await Oe();return}n.info(`Not logged in, getting new access token`);let r=await pe();n.debug(`Device code response:`,r),n.info(`Please enter the code "${r.user_code}" in ${r.verification_uri}`);let i=await xe(r);await Ce(i),b.githubToken=i,b.showToken&&n.info(`GitHub token:`,i),await Oe()}catch(e){throw e instanceof k?(n.error(`Failed to get GitHub token:`,await e.response.json()),e):(n.error(`Failed to get GitHub token:`,e),e)}}async function Oe(){let e=await me();b.githubLogin=e.login,n.info(`Logged in as ${e.login}`)}async function ke(e){e.verbose&&(n.level=5,n.info(`Verbose logging enabled`)),b.showToken=e.showToken,await y(),await N({force:!0}),n.success(`GitHub token written to`,v.GITHUB_TOKEN_PATH)}const Ae=e({meta:{name:`auth`,description:`Run GitHub auth flow without running the server`},args:{verbose:{alias:`v`,type:`boolean`,default:!1,description:`Enable verbose logging`},"show-token":{type:`boolean`,default:!1,description:`Show GitHub token on auth`}},run({args:e}){return ke({verbose:e.verbose,showToken:e[`show-token`]})}}),je=async()=>{let e=await fetch(`${T}/copilot_internal/user`,{headers:E(b)});if(!e.ok)throw new k(`Failed to get Copilot usage`,e);return await e.json()},Me=e({meta:{name:`check-usage`,description:`Show current GitHub Copilot usage/quota information`},async run(){await y(),await N();try{let e=await je(),t=e.quota_snapshots.premium_interactions,r=t.entitlement,i=r-t.remaining,a=r>0?i/r*100:0,o=t.percent_remaining;function s(e,t){if(!t)return`${e}: N/A`;let n=t.entitlement,r=n-t.remaining,i=n>0?r/n*100:0,a=t.percent_remaining;return`${e}: ${r}/${n} used (${i.toFixed(1)}% used, ${a.toFixed(1)}% remaining)`}let c=`Premium: ${i}/${r} used (${a.toFixed(1)}% used, ${o.toFixed(1)}% remaining)`,l=s(`Chat`,e.quota_snapshots.chat),u=s(`Completions`,e.quota_snapshots.completions);n.box(`Copilot Usage (plan: ${e.copilot_plan})\nQuota resets: ${e.quota_reset_date}\n\nQuotas:\n  ${c}\n  ${l}\n  ${u}`)}catch(e){n.error(`Failed to fetch Copilot usage:`,e),process.exit(1)}}});async function Ne(e){try{let t=`${e}.bak`;await i(e,t),n.info(`Backup saved: ${t}`)}catch{}}const P={"4.8":`claude-opus-4.8`,"4.7":`claude-opus-4.7-1m-internal`,"4.6":`claude-opus-4.6-1m`};async function Pe(e,t){let r=P[t];r||(n.error(`Unknown Claude model version: ${t}. Supported: ${Object.keys(P).join(`, `)}`),process.exit(1));let i=d(l(),`.claude`),c=d(i,`settings.json`);await a(i,{recursive:!0});let u={};try{let e=await o(c,`utf8`);u=JSON.parse(e)}catch(e){e.code!==`ENOENT`&&(n.error(`Failed to parse ${c}. Please fix it manually.`),process.exit(1))}let f=typeof u.env==`object`&&u.env!==null?u.env:{},p={...u,env:{...f,ANTHROPIC_BASE_URL:`http://localhost:${e}`,ANTHROPIC_AUTH_TOKEN:`Powered by xc copilot`,ANTHROPIC_DEFAULT_OPUS_MODEL:r,CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS:`1`},model:`opus[1m]`};await Ne(c),await s(c,JSON.stringify(p,null,2)+`
`,`utf8`),n.success(`Claude Code configured: ${c}`)}function F(e,t,n){let r=RegExp(`^${t}\\s*=.*$`,`m`),i=`${t} = ${JSON.stringify(n)}`;if(r.test(e))return e.replace(r,i);let a=e.match(/^\[/m);return a?.index===void 0?e.trimEnd()+`
`+i+`
`:e.slice(0,a.index)+i+`
`+e.slice(a.index)}function Fe(e,t,n){let r=t.replaceAll(/[.*+?^${}()|[\]\\]/g,String.raw`\$&`),i=RegExp(`^\\[${r}\\]\\n[^[]*`,`m`),a=`[${t}]\n${n}\n\n`;return i.test(e)?e.replace(i,a):e.trimEnd()+`

`+a}async function Ie(e){let t=d(l(),`.codex`),r=d(t,`config.toml`);await a(t,{recursive:!0});let i=``;try{i=await o(r,`utf8`)}catch(e){e.code!==`ENOENT`&&(n.error(`Failed to read ${r}. Please fix it manually.`),process.exit(1))}i=F(i,`model`,`gpt-5.5`),i=F(i,`model_provider`,`copilot-api`),i=Fe(i,`model_providers.copilot-api`,`name = "copilot-api"\nbase_url = "http://localhost:${e}/v1"\nwire_api = "responses"`),await Ne(r),await s(r,i,`utf8`),n.success(`Codex CLI configured: ${r}`)}const Le=e({meta:{name:`config`,description:`Configure external AI tools (Claude Code, Codex CLI) to use Copilot API. Configures both by default; use --claude or --codex to target one.`},args:{claude:{alias:`c`,type:`boolean`,default:!1,description:`Configure Claude Code (~/.claude/settings.json)`},codex:{alias:`x`,type:`boolean`,default:!1,description:`Configure Codex CLI (~/.codex/config.toml)`},"claude-model":{alias:`m`,type:`string`,default:`4.8`,description:`Claude Opus model version (4.8, 4.7, or 4.6)`},port:{alias:`p`,type:`string`,default:`4141`,description:`Port the Copilot API server listens on`}},async run({args:e}){let t=Number.parseInt(e.port,10),n=!e.claude&&!e.codex;(n||e.claude)&&await Pe(t,e[`claude-model`]),(n||e.codex)&&await Ie(t)}});async function Re(){try{let e=new URL(`../package.json`,import.meta.url).pathname;return JSON.parse(await r.readFile(e)).version}catch{return`unknown`}}function ze(){let e=typeof Bun<`u`;return{name:e?`bun`:`node`,version:e?Bun.version:process.version.slice(1),platform:c.platform(),arch:c.arch()}}async function Be(){try{return(await r.stat(v.GITHUB_TOKEN_PATH)).isFile()?(await r.readFile(v.GITHUB_TOKEN_PATH,`utf8`)).trim().length>0:!1}catch{return!1}}async function Ve(){let[e,t]=await Promise.all([Re(),Be()]);return{version:e,runtime:ze(),paths:{APP_DIR:v.APP_DIR,GITHUB_TOKEN_PATH:v.GITHUB_TOKEN_PATH},tokenExists:t}}function He(e){n.info(`xc-copilot-api debug

Version: ${e.version}
Runtime: ${e.runtime.name} ${e.runtime.version} (${e.runtime.platform} ${e.runtime.arch})

Paths:
- APP_DIR: ${e.paths.APP_DIR}
- GITHUB_TOKEN_PATH: ${e.paths.GITHUB_TOKEN_PATH}

Token exists: ${e.tokenExists?`Yes`:`No`}`)}function Ue(e){console.log(JSON.stringify(e,null,2))}async function We(e){let t=await Ve();e.json?Ue(t):He(t)}const Ge=e({meta:{name:`debug`,description:`Print debug information about the application`},args:{json:{type:`boolean`,default:!1,description:`Output debug information as JSON`}},run({args:e}){return We({json:e.json})}});function Ke(){if(!(typeof Bun<`u`))try{let e=new ne,t=new Map;ie({dispatch(r,i){try{let a=typeof r.origin==`string`?new URL(r.origin):r.origin,o=te(a.toString()),s=o&&o.length>0?o:void 0;if(!s)return n.debug(`HTTP proxy bypass: ${a.hostname}`),e.dispatch(r,i);let c=t.get(s);c||(c=new re(s),t.set(s,c));let l=s;try{let e=new URL(s);l=`${e.protocol}//${e.host}`}catch{}return n.debug(`HTTP proxy route: ${a.hostname} via ${l}`),c.dispatch(r,i)}catch{return e.dispatch(r,i)}},close(){return e.close()},destroy(){return e.destroy()}}),n.debug(`HTTP proxy configured from environment (per-URL)`)}catch(e){n.debug(`Proxy setup skipped:`,e)}}function I(e){return e instanceof Set?e:new Set(Array.isArray(e)?e:[])}const L=u.join(v.APP_DIR,`stats.json`),qe=new Set([`/`,`/chat/completions`,`/models`,`/embeddings`,`/responses`,`/usage`,`/token`]);function Je(e){return qe.has(e)?!0:e.startsWith(`/v1/`)||e.startsWith(`/admin/`)}const R=new class{startedAt=Date.now();totalRequests=0;droppedNoise=0;tokens={prompt:0,completion:0,total:0};byModel=new Map;byIp=new Map;byStatus=new Map;byKey=new Map;recent=[];noteDropped(){this.droppedNoise+=1}record(e){this.totalRequests+=1,this.byStatus.set(e.status,(this.byStatus.get(e.status)??0)+1);let t=e.keyId||(e.status===401?`__unauth__`:`__unknown__`),n=this.byKey.get(t)??{count:0,tokens:0,lastSeen:0,ips:new Set,models:new Set};n.count+=1,n.lastSeen=e.time,e.ip&&n.ips.add(e.ip),e.model&&n.models.add(e.model),this.byKey.set(t,n);let r=this.byIp.get(e.ip)??{count:0,authorized:0,unauthorized:0,tokens:0,lastSeen:0,models:new Set,keys:new Set};if(r.count+=1,r.lastSeen=e.time,e.status===401?r.unauthorized+=1:e.status<400&&(r.authorized+=1),e.model&&r.models.add(e.model),r.keys=I(r.keys),e.keyId&&r.keys.add(e.keyId),this.byIp.set(e.ip,r),e.model){let t=this.byModel.get(e.model)??{count:0,prompt:0,completion:0,total:0};t.count+=1,this.byModel.set(e.model,t)}this.recent.push(e),this.recent.length>200&&this.recent.splice(0,this.recent.length-200)}addTokens(e,t){if(this.tokens.prompt+=t.prompt,this.tokens.completion+=t.completion,this.tokens.total+=t.total,e.keyId){let n=this.byKey.get(e.keyId);n&&(n.tokens+=t.total)}let n=this.byIp.get(e.ip);if(n&&(n.tokens+=t.total),e.model){let n=this.byModel.get(e.model)??{count:0,prompt:0,completion:0,total:0};n.prompt+=t.prompt,n.completion+=t.completion,n.total+=t.total,this.byModel.set(e.model,n)}}snapshot(e){let t=Date.now();return{startedAt:new Date(this.startedAt).toISOString(),uptimeSeconds:Math.floor((t-this.startedAt)/1e3),paused:e,totalRequests:this.totalRequests,droppedNoise:this.droppedNoise,tokens:this.tokens,models:[...this.byModel.entries()].map(([e,t])=>({model:e,...t})).sort((e,t)=>t.count-e.count),ips:[...this.byIp.entries()].map(([e,t])=>({ip:e,count:t.count,authorized:t.authorized,unauthorized:t.unauthorized,tokens:t.tokens,lastSeen:new Date(t.lastSeen).toISOString(),models:[...t.models],keys:[...I(t.keys)]})).sort((e,t)=>t.count-e.count),keys:[...this.byKey.entries()].map(([e,t])=>({key:e,count:t.count,tokens:t.tokens,lastSeen:new Date(t.lastSeen).toISOString(),ips:[...t.ips],ipCount:t.ips.size,models:[...t.models]})).sort((e,t)=>t.count-e.count),statuses:Object.fromEntries([...this.byStatus.entries()].sort((e,t)=>e[0]-t[0])),recent:[...this.recent].reverse()}}serialize(){return JSON.stringify({startedAt:this.startedAt,totalRequests:this.totalRequests,droppedNoise:this.droppedNoise,tokens:this.tokens,byModel:[...this.byModel.entries()],byIp:[...this.byIp.entries()].map(([e,t])=>[e,{...t,models:[...t.models],keys:[...I(t.keys)]}]),byStatus:[...this.byStatus.entries()],recent:this.recent})}async save(){try{let e=`${L}.tmp`;await r.writeFile(e,this.serialize()),await r.rename(e,L)}catch{}}async load(){try{let e=await r.readFile(L,`utf8`),t=JSON.parse(e);this.startedAt=t.startedAt??this.startedAt,this.totalRequests=t.totalRequests??0,this.droppedNoise=t.droppedNoise??0,this.tokens=t.tokens??{prompt:0,completion:0,total:0},this.byModel=new Map(t.byModel??[]),this.byIp=new Map((t.byIp??[]).map(([e,t])=>[e,{...t,models:new Set(t.models),keys:I(t.keys)}])),this.byStatus=new Map(t.byStatus??[]),this.recent=t.recent??[]}catch{}}};function Ye(e){let t=e.req.header(`x-real-ip`);if(t)return t.trim();let n=e.req.header(`x-forwarded-for`);if(n){let e=n.split(`,`)[0]?.trim();if(e)return e}return e.req.raw.ip??`unknown`}function Xe(e){let t=t=>{let n;for(let r of e.matchAll(t))n=Number.parseInt(r[1],10);return n},n=t(/"(?:prompt_tokens|input_tokens)"\s*:\s*(\d+)/g),r=t(/"(?:completion_tokens|output_tokens)"\s*:\s*(\d+)/g),i=t(/"total_tokens"\s*:\s*(\d+)/g);if(!(n===void 0&&r===void 0&&i===void 0))return i===void 0&&(i=(n??0)+(r??0)),{prompt:n??0,completion:r??0,total:i}}function Ze(e,t){let n=Buffer.from(e),r=t.split(`,`).map(e=>e.trim()).filter(Boolean),i=(process.env.COPILOT_API_KEY_NAMES??``).split(`,`).map(e=>e.trim());for(let[e,t]of r.entries()){let r=Buffer.from(t);if(n.length===r.length&&p(n,r))return i[e]||`key${e+1}`}return!1}function Qe(e){let t=e.req.header(`authorization`);if(t){let e=/^Bearer\s+(.+)$/i.exec(t);if(e)return e[1].trim()}let n=e.req.header(`x-api-key`);if(n)return n.trim()}function $e(){return async function(e,t){let{apiKey:n}=b;if(!n){await t();return}if(e.req.method===`OPTIONS`){await t();return}let r=Qe(e),i=r?Ze(r,n):!1;if(!r||!i)return e.json({error:{message:`Unauthorized: invalid or missing API key`,type:`authentication_error`}},401);e.set(`keyId`,i),await t()}}function z(){return new Date().toISOString()}function et(){return async function(e,t){let n=performance.now();await t();let r=(performance.now()-n).toFixed(1),i=e.req.method,a=e.req.path,o=e.res.status;console.log(`[${z()}] ${i} ${a} ${o} ${r}ms`)}}function B(e,t){console.error(`[${z()}] ${e}`,t)}const tt=[`/chat/completions`,`/responses`,`/messages`,`/embeddings`];function nt(e){return tt.some(t=>e===t||e.endsWith(t))}async function rt(e){if(e.req.method===`POST`)try{let t=await e.req.raw.clone().text();return/"model"\s*:\s*"([^"]+)"/.exec(t)?.[1]}catch{return}}async function it(e,t){try{let n=e.getReader(),r=new TextDecoder,i=``,a=4e6;for(;;){let{done:e,value:t}=await n.read();if(e)break;i+=r.decode(t,{stream:!0}),i.length>a&&(i=i.slice(-a))}let o=Xe(i);o&&(t.promptTokens=o.prompt,t.completionTokens=o.completion,t.totalTokens=o.total,R.addTokens(t,o))}catch{}}function at(){return async function(e,t){if(!Je(e.req.path))return R.noteDropped(),e.json({error:{message:`Not found`,type:`not_found`}},404);await t()}}function ot(){return async function(e,t){let n=performance.now(),r=Ye(e),i=await rt(e);await t();let a={time:Date.now(),ip:r,method:e.req.method,path:e.req.path,model:i,status:e.res.status,keyId:e.get(`keyId`)||null,durationMs:Number((performance.now()-n).toFixed(1))};if(R.record(a),e.res.body&&nt(e.req.path))try{let[t,n]=e.res.body.tee();e.res=new Response(t,{status:e.res.status,headers:e.res.headers}),it(n,a)}catch{}}}const V=new m;V.get(`/stats`,e=>e.json(R.snapshot(b.paused))),V.post(`/pause`,e=>(b.paused=!0,n.warn(`Service PAUSED via /admin/pause — proxy endpoints return 503`),e.json({paused:!0}))),V.post(`/resume`,e=>(b.paused=!1,n.info(`Service RESUMED via /admin/resume`),e.json({paused:!1}))),V.post(`/shutdown`,e=>(n.warn(`Shutdown requested via /admin/shutdown — exiting process`),setTimeout(()=>{R.save().finally(()=>process.exit(0))},100),e.json({shuttingDown:!0})));const H=async()=>{if(!await n.prompt(`Accept incoming request?`,{type:`confirm`}))throw new k(`Request rejected`,Response.json({message:`Request rejected`},{status:403}))};async function U(e){if(e.rateLimitSeconds===void 0)return;let t=Date.now();if(!e.lastRequestTimestamp){e.lastRequestTimestamp=t;return}let r=(t-e.lastRequestTimestamp)/1e3;if(r>e.rateLimitSeconds){e.lastRequestTimestamp=t;return}let i=Math.ceil(e.rateLimitSeconds-r);if(!e.rateLimitWait)throw n.warn(`Rate limit exceeded. Need to wait ${i} more seconds.`),new k(`Rate limit exceeded`,Response.json({message:`Rate limit exceeded`},{status:429}));let a=i*1e3;n.warn(`Rate limit reached. Waiting ${i} seconds before proceeding...`),await M(a),e.lastRequestTimestamp=t,n.info(`Rate limit wait completed, proceeding with request`)}const W={o200k_base:()=>import(`gpt-tokenizer/encoding/o200k_base`),cl100k_base:()=>import(`gpt-tokenizer/encoding/cl100k_base`),p50k_base:()=>import(`gpt-tokenizer/encoding/p50k_base`),p50k_edit:()=>import(`gpt-tokenizer/encoding/p50k_edit`),r50k_base:()=>import(`gpt-tokenizer/encoding/r50k_base`)},G=new Map,st=(e,t,n)=>{let r=0;for(let i of e)r+=n.funcInit,r+=t.encode(JSON.stringify(i)).length;return r+=n.funcEnd,r},ct=(e,t)=>{let n=0;for(let r of e)r.type===`image_url`?n+=t.encode(r.image_url.url).length+85:r.text&&(n+=t.encode(r.text).length);return n},lt=(e,t,n)=>{let r=3;for(let[i,a]of Object.entries(e))typeof a==`string`&&(r+=t.encode(a).length),i===`name`&&(r+=1),i===`tool_calls`&&(r+=st(a,t,n)),i===`content`&&Array.isArray(a)&&(r+=ct(a,t));return r},ut=(e,t,n)=>{if(e.length===0)return 0;let r=0;for(let i of e)r+=lt(i,t,n);return r+=3,r},dt=async e=>{if(G.has(e)){let t=G.get(e);if(t)return t}let t=e;if(!(t in W)){let t=await W.o200k_base();return G.set(e,t),t}let n=await W[t]();return G.set(e,n),n},ft=e=>e.capabilities.tokenizer||`o200k_base`,pt=e=>e.id===`gpt-3.5-turbo`||e.id===`gpt-4`?{funcInit:10,propInit:3,propKey:3,enumInit:-3,enumItem:3,funcEnd:12}:{funcInit:7,propInit:3,propKey:3,enumInit:-3,enumItem:3,funcEnd:12},mt=(e,t,n)=>{let{encoder:r,constants:i}=n,a=i.propKey;if(typeof t!=`object`||!t)return a;let o=t,s=e,c=o.type||`string`,l=o.description||``;if(o.enum&&Array.isArray(o.enum)){a+=i.enumInit;for(let e of o.enum)a+=i.enumItem,a+=r.encode(String(e)).length}l.endsWith(`.`)&&(l=l.slice(0,-1));let u=`${s}:${c}:${l}`;a+=r.encode(u).length;let d=new Set([`type`,`description`,`enum`]);for(let e of Object.keys(o))if(!d.has(e)){let t=o[e],n=typeof t==`string`?t:JSON.stringify(t);a+=r.encode(`${e}:${n}`).length}return a},ht=(e,t,n)=>{if(!e||typeof e!=`object`)return 0;let r=e,i=0;for(let[e,a]of Object.entries(r))if(e===`properties`){let e=a;if(Object.keys(e).length>0){i+=n.propInit;for(let r of Object.keys(e))i+=mt(r,e[r],{encoder:t,constants:n})}}else{let n=typeof a==`string`?a:JSON.stringify(a);i+=t.encode(`${e}:${n}`).length}return i},gt=(e,t,n)=>{let r=n.funcInit,i=e.function,a=i.name,o=i.description||``;o.endsWith(`.`)&&(o=o.slice(0,-1));let s=a+`:`+o;return r+=t.encode(s).length,typeof i.parameters==`object`&&i.parameters!==null&&(r+=ht(i.parameters,t,n)),r},_t=(e,t,n)=>{let r=0;for(let i of e)r+=gt(i,t,n);return r+=n.funcEnd,r},vt=async(e,t)=>{let n=ft(t),r=await dt(n),i=e.messages,a=i.filter(e=>e.role!==`assistant`),o=i.filter(e=>e.role===`assistant`),s=pt(t),c=ut(a,r,s);e.tools&&e.tools.length>0&&(c+=_t(e.tools,r,s));let l=ut(o,r,s);return{input:c,output:l}},yt=async e=>{if(!b.copilotToken)throw Error(`Copilot token not found`);let t=e.messages.some(e=>typeof e.content!=`string`&&e.content?.some(e=>e.type===`image_url`)),r=e.messages.some(e=>[`assistant`,`tool`].includes(e.role)),i=()=>({...w(b,t),"X-Initiator":r?`agent`:`user`}),a=await fetch(`${C(b)}/chat/completions`,{method:`POST`,headers:i(),body:JSON.stringify(e)});if(a.status===401&&(n.warn(`Received 401, attempting to refresh token and retry`),await Ee(),a=await fetch(`${C(b)}/chat/completions`,{method:`POST`,headers:i(),body:JSON.stringify(e)})),!a.ok)throw n.error(`Failed to create chat completions`,a),new k(`Failed to create chat completions`,a);return e.stream?oe(a):await a.json()};async function bt(e){await U(b);let t=await e.req.json();n.debug(`Request payload:`,JSON.stringify(t).slice(-400));let r=b.models?.data.find(e=>e.id===t.model);try{if(r){let e=await vt(t,r);n.info(`Current token count:`,e)}else n.warn(`No model selected, skipping token count calculation`)}catch(e){n.warn(`Failed to calculate token count:`,e)}b.manualApprove&&await H(),ve(t.max_tokens)&&(t={...t,max_tokens:r?.capabilities.limits.max_output_tokens},n.debug(`Set max_tokens to:`,JSON.stringify(t.max_tokens)));let i=await yt(t);return xt(i)?(n.debug(`Non-streaming response:`,JSON.stringify(i)),e.json(i)):(n.debug(`Streaming response`),h(e,async e=>{for await(let t of i)n.debug(`Streaming chunk:`,JSON.stringify(t)),await e.writeSSE(t)}))}const xt=e=>Object.hasOwn(e,`choices`),K=new m;K.post(`/`,async e=>{try{return await bt(e)}catch(t){return await A(e,t)}});const St=async e=>{if(!b.copilotToken)throw Error(`Copilot token not found`);let t=await fetch(`${C(b)}/embeddings`,{method:`POST`,headers:w(b),body:JSON.stringify(e)});if(!t.ok)throw new k(`Failed to create embeddings`,t);return await t.json()},q=new m;q.post(`/`,async e=>{try{let t=await e.req.json(),n=await St(t);return e.json(n)}catch(t){return await A(e,t)}});const Ct=e=>`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Copilot API Dashboard</title>

    <script>
      (function() {
        const saved = localStorage.getItem("theme");
        if (saved === "dark" || saved === "light") {
          document.documentElement.setAttribute("data-theme", saved);
        }
      })();
    <\/script>

    <script src="https://cdn.tailwindcss.com"><\/script>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />

    <style>
      :root {
        --bg: #ffffff;
        --bg-elevated: #fafafa;
        --bg-hover: #f4f4f5;
        --border: #e4e4e7;
        --border-strong: #d4d4d8;
        --fg: #09090b;
        --fg-muted: #52525b;
        --fg-subtle: #a1a1aa;
        --accent: #2563eb;
        --accent-hover: #3b82f6;
        --success: #059669;
        --warning: #d97706;
        --danger: #dc2626;
        --purple: #9333ea;
      }

      @media (prefers-color-scheme: dark) {
        :root:not([data-theme="light"]) {
          --bg: #0a0a0a;
          --bg-elevated: #111111;
          --bg-hover: #1a1a1a;
          --border: #1f1f1f;
          --border-strong: #2a2a2a;
          --fg: #fafafa;
          --fg-muted: #a1a1aa;
          --fg-subtle: #71717a;
          --accent: #3b82f6;
          --accent-hover: #60a5fa;
          --success: #10b981;
          --warning: #f59e0b;
          --danger: #ef4444;
          --purple: #a855f7;
        }
      }

      :root[data-theme="dark"] {
        --bg: #0a0a0a;
        --bg-elevated: #111111;
        --bg-hover: #1a1a1a;
        --border: #1f1f1f;
        --border-strong: #2a2a2a;
        --fg: #fafafa;
        --fg-muted: #a1a1aa;
        --fg-subtle: #71717a;
        --accent: #3b82f6;
        --accent-hover: #60a5fa;
        --success: #10b981;
        --warning: #f59e0b;
        --danger: #ef4444;
        --purple: #a855f7;
      }

      * { box-sizing: border-box; }

      html, body {
        background: var(--bg);
        color: var(--fg);
        font-family: "Inter", system-ui, sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      .font-mono { font-family: "JetBrains Mono", ui-monospace, monospace; }

      .card {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 12px;
      }

      .input {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 8px;
        color: var(--fg);
        padding: 0.5rem 0.875rem;
        font-size: 0.875rem;
        outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px rgb(59 130 246 / 0.15);
      }

      .btn {
        background: var(--fg);
        color: var(--bg);
        border-radius: 8px;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        transition: opacity 0.15s, transform 0.05s;
        border: 0;
        cursor: pointer;
      }
      .btn:hover { opacity: 0.9; }
      .btn:active { transform: scale(0.98); }

      .btn-ghost {
        background: transparent;
        color: var(--fg-muted);
        border: 1px solid var(--border-strong);
        border-radius: 6px;
        padding: 0.25rem 0.625rem;
        font-size: 0.75rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s, color 0.15s;
      }
      .btn-ghost:hover {
        background: var(--bg-hover);
        color: var(--fg);
      }

      .tab {
        padding: 0.625rem 0;
        margin-right: 1.5rem;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--fg-subtle);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        margin-bottom: -1px;
        transition: color 0.15s, border-color 0.15s;
      }
      .tab:hover { color: var(--fg-muted); }
      .tab.active {
        color: var(--fg);
        border-bottom-color: var(--fg);
      }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.125rem 0.5rem;
        border-radius: 9999px;
        font-size: 0.6875rem;
        font-weight: 500;
        font-family: "JetBrains Mono", monospace;
        background: var(--bg-hover);
        color: var(--fg-muted);
        border: 1px solid var(--border);
      }

      .progress-track {
        background: var(--border);
        border-radius: 9999px;
        height: 6px;
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 9999px;
        transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      }

      pre, code { font-family: "JetBrains Mono", ui-monospace, monospace; }

      .code-block {
        background: var(--bg);
        border-radius: 0 0 12px 12px;
      }

      ::-webkit-scrollbar { width: 8px; height: 8px; }
      ::-webkit-scrollbar-track { background: var(--bg); }
      ::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
      ::-webkit-scrollbar-thumb:hover { background: var(--fg-subtle); }

      .spinner {
        width: 32px;
        height: 32px;
        border: 2px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      .fade-in { animation: fadeIn 0.3s ease-out; }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      details[open] > summary .chevron { transform: rotate(90deg); }
      summary::-webkit-details-marker { display: none; }
    </style>
  </head>
  <body>
    <div class="min-h-screen">
      <div class="max-w-6xl mx-auto px-6 py-10">
        <!-- Header -->
        <header class="mb-10 flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: linear-gradient(135deg, var(--accent), var(--purple))">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h1 class="text-xl font-semibold tracking-tight">Copilot API</h1>
              <span id="version-slot">${e}</span>
            </div>
            <p class="text-sm" style="color: var(--fg-subtle)">Monitor usage, browse models, and configure clients</p>
          </div>
          <button id="theme-toggle" class="btn-ghost flex items-center justify-center" style="width: 36px; height: 36px; padding: 0" aria-label="Toggle theme">
            <svg id="theme-icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
            <svg id="theme-icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
        </header>

        <!-- Server Connection -->
        <div class="card p-4 mb-8">
          <div class="flex items-center gap-3">
            <div class="flex-1 flex items-center gap-2">
              <div id="status-dot" class="w-2 h-2 rounded-full" style="background: var(--fg-subtle)"></div>
              <input
                type="text"
                id="base-url"
                class="input flex-1 font-mono"
                placeholder="http://localhost:4141"
              />
            </div>
            <button id="connect-btn" class="btn">Connect</button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b mb-6" style="border-color: var(--border)">
          <button class="tab active" data-tab="usage">Usage</button>
          <button class="tab" data-tab="models">Models</button>
          <button class="tab" data-tab="config">Config</button>
        </div>

        <!-- Content -->
        <main id="content-area" class="fade-in"></main>
      </div>

      <footer class="text-center py-6 text-xs" style="color: var(--fg-subtle)">
        <a href="https://github.com/billxc/copilot-api" target="_blank" rel="noopener noreferrer"
          class="hover:underline" style="color: var(--fg-muted)">github.com/billxc/copilot-api</a>
      </footer>
    </div>

    <script>
      function copyToClipboard(btn) {
        const code = btn.getAttribute("data-code");
        navigator.clipboard.writeText(code).then(() => {
          const orig = btn.textContent;
          btn.textContent = "Copied";
          btn.style.color = "var(--success)";
          setTimeout(() => { btn.textContent = orig; btn.style.color = ""; }, 1500);
        });
      }

      document.addEventListener("DOMContentLoaded", () => {
        // Theme toggle
        const themeToggle = document.getElementById("theme-toggle");
        const sunIcon = document.getElementById("theme-icon-sun");
        const moonIcon = document.getElementById("theme-icon-moon");

        function currentTheme() {
          const set = document.documentElement.getAttribute("data-theme");
          if (set) return set;
          return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        function updateThemeIcon() {
          const isDark = currentTheme() === "dark";
          sunIcon.style.display = isDark ? "block" : "none";
          moonIcon.style.display = isDark ? "none" : "block";
        }
        themeToggle.addEventListener("click", () => {
          const next = currentTheme() === "dark" ? "light" : "dark";
          document.documentElement.setAttribute("data-theme", next);
          localStorage.setItem("theme", next);
          updateThemeIcon();
        });
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
          if (!document.documentElement.getAttribute("data-theme")) updateThemeIcon();
        });
        updateThemeIcon();

        const baseUrlInput = document.getElementById("base-url");
        const connectBtn = document.getElementById("connect-btn");
        const statusDot = document.getElementById("status-dot");
        const contentArea = document.getElementById("content-area");
        const tabBtns = document.querySelectorAll(".tab");

        const DEFAULT_BASE = "http://localhost:4141";
        let activeTab = "usage";
        let usageData = null;
        let modelsData = null;
        let isLoading = false;
        let error = null;

        tabBtns.forEach(btn => {
          btn.addEventListener("click", () => {
            activeTab = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            render();
          });
        });

        connectBtn.addEventListener("click", () => connect());
        baseUrlInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") connect();
        });

        function connect() {
          const base = baseUrlInput.value.trim().replace(/\\/+$/, "");
          try {
            const u = new URL(window.location);
            u.searchParams.set("endpoint", base);
            window.history.pushState({}, "", u);
          } catch (e) {}
          fetchAll(base);
        }

        async function fetchAll(base) {
          isLoading = true;
          error = null;
          statusDot.style.background = "var(--warning)";
          render();
          try {
            const [usageRes, modelsRes] = await Promise.all([
              fetch(base + "/usage"),
              fetch(base + "/models"),
            ]);
            if (!usageRes.ok) throw new Error("Usage: " + usageRes.status);
            if (!modelsRes.ok) throw new Error("Models: " + modelsRes.status);
            usageData = await usageRes.json();
            modelsData = await modelsRes.json();
            // Populate version badge if it wasn't server-rendered.
            const slot = document.getElementById("version-slot");
            if (slot && !slot.firstElementChild) {
              try {
                const r = await fetch(base + "/?format=json");
                if (r.ok) {
                  const info = await r.json();
                  if (info && info.version) {
                    slot.innerHTML = \`<span class="text-xs px-2 py-0.5 rounded-full font-mono" style="background: var(--bg-hover); color: var(--fg-muted)">v\${info.version}</span>\`;
                  }
                }
              } catch {}
            }
            statusDot.style.background = "var(--success)";
          } catch (e) {
            error = e.message;
            usageData = null;
            modelsData = null;
            statusDot.style.background = "var(--danger)";
          } finally {
            isLoading = false;
            render();
          }
        }

        function render() {
          contentArea.classList.remove("fade-in");
          void contentArea.offsetWidth;
          contentArea.classList.add("fade-in");

          if (isLoading && activeTab !== "config") {
            contentArea.innerHTML = renderSpinner();
            return;
          }
          if (error && activeTab !== "config") {
            contentArea.innerHTML = renderError(error);
            return;
          }
          if (activeTab === "usage") {
            contentArea.innerHTML = usageData ? renderUsage(usageData) : renderEmpty("Connect to view usage data");
          } else if (activeTab === "models") {
            contentArea.innerHTML = modelsData ? renderModels(modelsData) : renderEmpty("Connect to view available models");
          } else if (activeTab === "config") {
            contentArea.innerHTML = renderConfig();
          }
        }

        // === Usage Tab ===
        function renderUsage(data) {
          const quotas = data.quota_snapshots ? renderQuotas(data.quota_snapshots) : "";
          const details = renderRawData(data);
          return quotas + details;
        }

        function renderQuotas(snapshots) {
          const cards = Object.entries(snapshots).map(([k, v]) => renderQuotaCard(k, v)).join("");
          return \`
            <section class="mb-8">
              <h2 class="text-xs uppercase tracking-wider mb-4 font-medium" style="color: var(--fg-subtle)">Quotas</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">\${cards}</div>
            </section>\`;
        }

        function renderQuotaCard(title, d) {
          const pctUsed = d.unlimited ? 0 : 100 - d.percent_remaining;
          const used = d.unlimited ? "—" : (d.entitlement - d.remaining).toLocaleString();
          let barColor = "var(--success)";
          if (pctUsed > 75) barColor = "var(--warning)";
          if (pctUsed > 90) barColor = "var(--danger)";
          if (d.unlimited) barColor = "var(--accent)";

          return \`
            <div class="card p-5">
              <div class="flex justify-between items-start mb-4">
                <h3 class="text-sm font-semibold capitalize">\${title.replace(/_/g, " ")}</h3>
                \${d.unlimited
                  ? \`<span class="badge" style="color: var(--accent); border-color: var(--accent)">Unlimited</span>\`
                  : \`<span class="text-xs font-mono" style="color: var(--fg-muted)">\${pctUsed.toFixed(1)}%</span>\`
                }
              </div>
              <div class="progress-track mb-3">
                <div class="progress-fill" style="width: \${d.unlimited ? 100 : pctUsed}%; background: \${barColor}"></div>
              </div>
              <div class="flex justify-between text-xs font-mono" style="color: var(--fg-subtle)">
                <span>\${used} / \${d.unlimited ? "∞" : d.entitlement.toLocaleString()}</span>
                <span>\${d.unlimited ? "∞" : d.remaining.toLocaleString()} left</span>
              </div>
            </div>\`;
        }

        function renderRawData(data) {
          return \`
            <details>
              <summary class="flex items-center justify-between mb-4 cursor-pointer list-none">
                <h2 class="text-xs uppercase tracking-wider font-medium flex items-center gap-2" style="color: var(--fg-subtle)">
                  <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.15s">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                  Raw Response
                </h2>
                <button class="btn-ghost" onclick='event.preventDefault(); copyToClipboard(this)' data-code='\${escapeAttr(JSON.stringify(data, null, 2))}'>Copy</button>
              </summary>
              <div class="card overflow-hidden">
                <pre class="p-5 text-xs overflow-auto" style="color: var(--fg-muted); max-height: 480px">\${escapeHtml(JSON.stringify(data, null, 2))}</pre>
              </div>
            </details>\`;
        }

        // === Models Tab ===
        function renderModels(data) {
          const models = data.data || [];
          if (models.length === 0) return renderEmpty("No models available");

          const vendorColors = {
            azure: "var(--accent)",
            anthropic: "var(--purple)",
            openai: "var(--success)",
            google: "var(--warning)",
          };

          // Group by vendor
          const grouped = {};
          models.forEach(m => {
            const v = (m.owned_by || "other").toLowerCase();
            if (!grouped[v]) grouped[v] = [];
            grouped[v].push(m);
          });

          const sections = Object.entries(grouped).map(([vendor, items]) => {
            const color = vendorColors[vendor] || "var(--fg-subtle)";
            const cards = items.map(m => \`
              <div class="card p-4 hover:border-zinc-700 transition-colors" style="transition: border-color 0.15s">
                <h3 class="text-sm font-semibold mb-1">\${escapeHtml(m.display_name || m.id)}</h3>
                <code class="text-xs font-mono" style="color: var(--fg-subtle)">\${escapeHtml(m.id)}</code>
              </div>
            \`).join("");
            return \`
              <section class="mb-8">
                <div class="flex items-center gap-2 mb-4">
                  <div class="w-1.5 h-1.5 rounded-full" style="background: \${color}"></div>
                  <h2 class="text-xs uppercase tracking-wider font-medium capitalize" style="color: var(--fg-subtle)">\${escapeHtml(vendor)}</h2>
                  <span class="text-xs font-mono" style="color: var(--fg-subtle)">\${items.length}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">\${cards}</div>
              </section>\`;
          }).join("");

          return sections + renderRawData(data);
        }

        // === Config Tab ===
        function renderConfig() {
          const base = baseUrlInput.value.trim().replace(/\\/+$/, "") || DEFAULT_BASE;

          const configs = [
            {
              title: "Claude Code",
              variant: "Opus 4.7",
              path: "~/.claude/settings.json",
              lang: "json",
              code: JSON.stringify({
                env: {
                  ANTHROPIC_BASE_URL: base,
                  ANTHROPIC_AUTH_TOKEN: "Powered by xc copilot",
                  ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus-4.7-1m-internal",
                  CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
                },
              }, null, 2),
            },
            {
              title: "Claude Code",
              variant: "Opus 4.6",
              path: "~/.claude/settings.json",
              lang: "json",
              code: JSON.stringify({
                env: {
                  ANTHROPIC_BASE_URL: base,
                  ANTHROPIC_AUTH_TOKEN: "Powered by xc copilot",
                  ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus-4.6-1m",
                  CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
                },
              }, null, 2),
            },
            {
              title: "Codex CLI",
              variant: "GPT-5.5",
              path: "~/.codex/config.toml",
              lang: "toml",
              code: \`model = "gpt-5.5"\\nmodel_provider = "copilot-api"\\n\\n[model_providers.copilot-api]\\nname = "copilot-api"\\nbase_url = "\${base}/v1"\\nwire_api = "responses"\`,
            },
            {
              title: "Quick Setup",
              variant: "CLI",
              path: "Run in terminal",
              lang: "bash",
              code: \`# Start the server\\nnpx xc-copilot-api@latest start\\n\\n# Configure Claude Code (Opus 4.7 by default)\\nnpx xc-copilot-api@latest config --claude\\n\\n# Or Opus 4.6\\nnpx xc-copilot-api@latest config --claude -m 4.6\\n\\n# Configure Codex CLI\\nnpx xc-copilot-api@latest config --codex\`,
            },
          ];

          const cards = configs.map(c => \`
            <div class="card overflow-hidden">
              <div class="flex items-center justify-between px-4 py-3" style="border-bottom: 1px solid var(--border)">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-semibold">\${escapeHtml(c.title)}</h3>
                    <span class="badge">\${escapeHtml(c.variant)}</span>
                  </div>
                  <p class="text-xs font-mono mt-1 truncate" style="color: var(--fg-subtle)">\${escapeHtml(c.path)}</p>
                </div>
                <button class="btn-ghost flex-shrink-0" onclick="copyToClipboard(this)" data-code="\${escapeAttr(c.code)}">Copy</button>
              </div>
              <pre class="code-block px-4 py-3 text-xs overflow-x-auto" style="color: var(--fg-muted)">\${escapeHtml(c.code)}</pre>
            </div>
          \`).join("");

          return \`
            <section>
              <p class="text-sm mb-6" style="color: var(--fg-muted)">Examples auto-generated from server URL <code class="font-mono px-1.5 py-0.5 rounded text-xs" style="background: var(--bg-elevated); color: var(--fg)">\${escapeHtml(base)}</code></p>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">\${cards}</div>
            </section>\`;
        }

        // === Helpers ===
        function renderSpinner() {
          return \`<div class="flex justify-center items-center py-24"><div class="spinner"></div></div>\`;
        }

        function renderError(msg) {
          return \`<div class="card p-5" style="border-color: var(--danger)">
            <div class="flex items-start gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p class="text-sm font-semibold" style="color: var(--danger)">Connection failed</p>
                <p class="text-xs mt-1 font-mono" style="color: var(--fg-muted)">\${escapeHtml(msg)}</p>
              </div>
            </div>
          </div>\`;
        }

        function renderEmpty(msg) {
          return \`<div class="card p-12 text-center">
            <p class="text-sm" style="color: var(--fg-subtle)">\${escapeHtml(msg)}</p>
          </div>\`;
        }

        function escapeHtml(s) {
          const d = document.createElement("div");
          d.appendChild(document.createTextNode(String(s)));
          return d.innerHTML;
        }

        function escapeAttr(s) {
          return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        // === Init ===
        const urlParams = new URLSearchParams(window.location.search);
        let endpoint = urlParams.get("endpoint") || "";
        if (endpoint.endsWith("/usage")) {
          endpoint = endpoint.replace(/\\/usage$/, "");
        }
        // Auto-load when served from a local-ish host: loopback addresses,
        // private LAN IP ranges, or *.local mDNS names. Public hosts (e.g.
        // the docs site) require an explicit ?endpoint= param.
        function isLocalHost(h) {
          if (!h) return false;
          if (h === "localhost" || h === "0.0.0.0") return true;
          if (h === "[::1]" || h === "::1") return true;
          if (/\\.local$/i.test(h)) return true;
          if (/^127\\./.test(h)) return true;
          if (/^10\\./.test(h)) return true;
          if (/^192\\.168\\./.test(h)) return true;
          if (/^172\\.(1[6-9]|2\\d|3[01])\\./.test(h)) return true;
          return false;
        }
        if (!endpoint && isLocalHost(window.location.hostname)) {
          endpoint = window.location.origin;
        }
        baseUrlInput.value = endpoint || DEFAULT_BASE;
        if (endpoint) {
          fetchAll(endpoint);
        } else {
          render();
        }
      });
    <\/script>
  </body>
</html>
`,wt=new m;wt.get(`/`,e=>{let t=process.env.npm_package_version??g.version,n=b.githubLogin??`unknown`,r=b.accountType,i=e.req.query(`format`),a=e.req.header(`accept`)??``;if(i===`json`||a.includes(`application/json`))return e.json({version:t,login:n,accountType:r});if(i===`text`||!a.includes(`text/html`))return e.text(`Copilot API v${t} - running\nUser: ${n} (${r})`);let o=`<span class="text-xs px-2 py-0.5 rounded-full font-mono" style="background: var(--bg-hover); color: var(--fg-muted)">v${t}</span>`;return e.html(Ct(o))});const Tt=new Set([`connection`,`content-length`,`keep-alive`,`proxy-authenticate`,`proxy-authorization`,`te`,`trailer`,`transfer-encoding`,`upgrade`]);async function Et({path:e,body:t,requestHeaders:r,forwardRequestHeaders:i,initiator:a,enableVision:o=!1,errorMessage:s,throwOnError:c=!1}){if(!b.copilotToken)throw Error(`Copilot token not found`);let l=await u();if(l.status===401&&(n.warn(`Received 401, attempting to refresh Copilot token and retry`),await Ee(),l=await u()),n.debug(`Passthrough response:`,{path:e,status:l.status,ok:l.ok}),!l.ok&&(n.error(s,l),c))throw new k(s,l);return l;async function u(){let s=Dt({requestHeaders:r,forwardRequestHeaders:i,initiator:a,enableVision:o});return n.debug(`Passthrough request:`,{method:`POST`,path:e,bodyLength:t.length}),fetch(`${C(b)}${e}`,{method:`POST`,headers:s,body:t})}}function Dt({requestHeaders:e,forwardRequestHeaders:t=[],initiator:n,enableVision:r=!1}){let i={...w(b,r),"X-Initiator":n};if(!e)return i;for(let n of t){let t=e.get(n);t&&(i[n]=t)}return i}function Ot(e,t){let n=new Headers;if(t){for(let r of t){let t=e.get(r);t&&n.set(r,t)}return n}for(let[t,r]of e.entries())Tt.has(t.toLowerCase())||n.set(t,r);return n}const kt=[`accept`,`anthropic-beta`,`anthropic-version`],At=`context-1m-2025-08-07`,jt=new Set([At]);function Mt(e){let t=e.get(`anthropic-beta`);return t?t.split(`,`).map(e=>e.trim()).includes(At):!1}function Nt(e){let t=e.get(`anthropic-beta`);if(!t)return e;let n=t.split(`,`).map(e=>e.trim()).filter(e=>!jt.has(e)).join(`,`),r=new Headers(e);return n?r.set(`anthropic-beta`,n):r.delete(`anthropic-beta`),r}function Pt(e){let t={modified:!1};try{let n=JSON.parse(e,(e,n)=>{if(e===`cache_control`&&typeof n==`object`&&n&&!Array.isArray(n)){let e=n,r=Object.keys(e);if(r.length>1||r.length===1&&!r.includes(`type`))return t.modified=!0,{type:e.type}}return n});return t.modified?JSON.stringify(n):e}catch{return e}}async function Ft(e,t,r=`/v1/messages`){n.debug(`Original request headers: ${JSON.stringify([...t])}`);let i=t;return Mt(t)&&(n.debug(`Request includes unsupported beta features. Stripping unsupported beta flags and fields.`),i=Nt(t)),Et({path:r,body:Pt(e),requestHeaders:i,forwardRequestHeaders:kt,initiator:`user`,errorMessage:`Upstream ${r} request failed`})}function It(e){return Rt(e)?.model?.startsWith(`claude`)??!1}function Lt(e){return Ot(e)}function Rt(e){try{return JSON.parse(e)}catch{return}}function zt(e){return e===null?null:{stop:`end_turn`,length:`max_tokens`,tool_calls:`tool_use`,content_filter:`end_turn`}[e]}function J(e){return{model:Bt(e.model),messages:Vt(e.messages,e.system),max_tokens:e.max_tokens,stop:e.stop_sequences,stream:e.stream,temperature:e.temperature,top_p:e.top_p,user:e.metadata?.user_id,tools:Gt(e.tools),tool_choice:Kt(e.tool_choice)}}function Bt(e){return e.startsWith(`claude-sonnet-4-`)?e.replace(/^claude-sonnet-4-.*/,`claude-sonnet-4`):e.startsWith(`claude-opus-`)?e.replace(/^claude-opus-4-.*/,`claude-opus-4`):e}function Vt(e,t){let n=Ht(t),r=e.flatMap(e=>e.role===`user`?Ut(e):Wt(e));return[...n,...r]}function Ht(e){if(!e)return[];if(typeof e==`string`)return[{role:`system`,content:e}];let t=e;return Array.isArray(e)&&(t=e.filter(e=>!e.text.includes(`x-anthropic-billing-header:`))),[{role:`system`,content:t.map(e=>e.text).join(`

`)}]}function Ut(e){let t=[];if(Array.isArray(e.content)){let n=e.content.filter(e=>e.type===`tool_result`),r=e.content.filter(e=>e.type!==`tool_result`);for(let e of n)t.push({role:`tool`,tool_call_id:e.tool_use_id,content:Y(e.content)});r.length>0&&t.push({role:`user`,content:Y(r)})}else t.push({role:`user`,content:Y(e.content)});return t}function Wt(e){if(!Array.isArray(e.content))return[{role:`assistant`,content:Y(e.content)}];let t=e.content.filter(e=>e.type===`tool_use`),n=e.content.filter(e=>e.type===`text`),r=e.content.filter(e=>e.type===`thinking`),i=[...n.map(e=>e.text),...r.map(e=>e.thinking)].join(`

`);return t.length>0?[{role:`assistant`,content:i||null,tool_calls:t.map(e=>({id:e.id,type:`function`,function:{name:e.name,arguments:JSON.stringify(e.input)}}))}]:[{role:`assistant`,content:Y(e.content)}]}function Y(e){if(typeof e==`string`)return e;if(!Array.isArray(e))return null;if(!e.some(e=>e.type===`image`))return e.filter(e=>e.type===`text`||e.type===`thinking`).map(e=>e.type===`text`?e.text:e.thinking).join(`

`);let t=[];for(let n of e)switch(n.type){case`text`:t.push({type:`text`,text:n.text});break;case`thinking`:t.push({type:`text`,text:n.thinking});break;case`image`:t.push({type:`image_url`,image_url:{url:`data:${n.source.media_type};base64,${n.source.data}`}});break}return t}function Gt(e){if(e)return e.map(e=>({type:`function`,function:{name:e.name,description:e.description,parameters:e.input_schema}}))}function Kt(e){if(e)switch(e.type){case`auto`:return`auto`;case`any`:return`required`;case`tool`:return e.name?{type:`function`,function:{name:e.name}}:void 0;case`none`:return`none`;default:return}}function qt(e){let t=[],n=[],r=null;r=e.choices[0]?.finish_reason??r;for(let i of e.choices){let e=Jt(i.message.content),a=Yt(i.message.tool_calls);t.push(...e),n.push(...a),(i.finish_reason===`tool_calls`||r===`stop`)&&(r=i.finish_reason)}return{id:e.id,type:`message`,role:`assistant`,model:e.model,content:[...t,...n],stop_reason:zt(r),stop_sequence:null,usage:{input_tokens:(e.usage?.prompt_tokens??0)-(e.usage?.prompt_tokens_details?.cached_tokens??0),output_tokens:e.usage?.completion_tokens??0,...e.usage?.prompt_tokens_details?.cached_tokens!==void 0&&{cache_read_input_tokens:e.usage.prompt_tokens_details.cached_tokens}}}}function Jt(e){return typeof e==`string`?[{type:`text`,text:e}]:Array.isArray(e)?e.filter(e=>e.type===`text`).map(e=>({type:`text`,text:e.text})):[]}function Yt(e){return e?e.map(e=>({type:`tool_use`,id:e.id,name:e.function.name,input:JSON.parse(e.function.arguments)})):[]}async function Xt(e){try{let t=await e.req.text();if(n.debug(`Anthropic count_tokens payload:`,t.slice(0,1e3)),It(t)){let n=await Ft(t,e.req.raw.headers,`/v1/messages/count_tokens`);return new Response(n.body,{status:n.status,headers:Lt(n.headers)})}let r=e.req.header(`anthropic-beta`),i=JSON.parse(t),a=J(i),o=b.models?.data.find(e=>e.id===i.model);if(!o)return n.warn(`Model not found, returning default token count`),e.json({input_tokens:1});let s=await vt(a,o);if(i.tools&&i.tools.length>0){let e=!1;r?.startsWith(`claude-code`)&&(e=i.tools.some(e=>e.name.startsWith(`mcp__`))),e||(i.model.startsWith(`claude`)?s.input+=346:i.model.startsWith(`grok`)&&(s.input+=480))}let c=s.input+s.output;return i.model.startsWith(`claude`)?c=Math.round(c*1.15):i.model.startsWith(`grok`)&&(c=Math.round(c*1.03)),n.info(`Token count:`,c),e.json({input_tokens:c})}catch(t){return n.error(`Error counting tokens:`,t),e.json({input_tokens:1})}}function Zt(e){return e.contentBlockOpen?Object.values(e.toolCalls).some(t=>t.anthropicBlockIndex===e.contentBlockIndex):!1}function Qt(e,t){let n=[];if(e.choices.length===0)return n;let r=e.choices[0],{delta:i}=r;if(t.messageStartSent||=(n.push({type:`message_start`,message:{id:e.id,type:`message`,role:`assistant`,content:[],model:e.model,stop_reason:null,stop_sequence:null,usage:{input_tokens:(e.usage?.prompt_tokens??0)-(e.usage?.prompt_tokens_details?.cached_tokens??0),output_tokens:0,...e.usage?.prompt_tokens_details?.cached_tokens!==void 0&&{cache_read_input_tokens:e.usage.prompt_tokens_details.cached_tokens}}}}),!0),i.content&&(Zt(t)&&(n.push({type:`content_block_stop`,index:t.contentBlockIndex}),t.contentBlockIndex++,t.contentBlockOpen=!1),t.contentBlockOpen||=(n.push({type:`content_block_start`,index:t.contentBlockIndex,content_block:{type:`text`,text:``}}),!0),n.push({type:`content_block_delta`,index:t.contentBlockIndex,delta:{type:`text_delta`,text:i.content}})),i.tool_calls)for(let e of i.tool_calls){if(e.id&&e.function?.name){t.contentBlockOpen&&=(n.push({type:`content_block_stop`,index:t.contentBlockIndex}),t.contentBlockIndex++,!1);let r=t.contentBlockIndex;t.toolCalls[e.index]={id:e.id,name:e.function.name,anthropicBlockIndex:r},n.push({type:`content_block_start`,index:r,content_block:{type:`tool_use`,id:e.id,name:e.function.name,input:{}}}),t.contentBlockOpen=!0}if(e.function?.arguments){let r=t.toolCalls[e.index];r&&n.push({type:`content_block_delta`,index:r.anthropicBlockIndex,delta:{type:`input_json_delta`,partial_json:e.function.arguments}})}}return r.finish_reason&&(t.contentBlockOpen&&=(n.push({type:`content_block_stop`,index:t.contentBlockIndex}),!1),n.push({type:`message_delta`,delta:{stop_reason:zt(r.finish_reason),stop_sequence:null},usage:{input_tokens:(e.usage?.prompt_tokens??0)-(e.usage?.prompt_tokens_details?.cached_tokens??0),output_tokens:e.usage?.completion_tokens??0,...e.usage?.prompt_tokens_details?.cached_tokens!==void 0&&{cache_read_input_tokens:e.usage.prompt_tokens_details.cached_tokens}}},{type:`message_stop`})),n}async function $t(e){await U(b);let t=await e.req.text();if(n.debug(`Anthropic request payload:`,t.slice(0,1e3)),It(t)){b.manualApprove&&await H();let n=await Ft(t,e.req.raw.headers);return new Response(n.body,{status:n.status,headers:Lt(n.headers)})}let r=JSON.parse(t);n.debug(`Anthropic request payload:`,JSON.stringify(r));let i=J(r);n.debug(`Translated OpenAI request payload:`,JSON.stringify(i)),b.manualApprove&&await H();let a=await yt(i);if(en(a)){n.debug(`Non-streaming response from Copilot:`,JSON.stringify(a).slice(-400));let t=qt(a);return n.debug(`Translated Anthropic response:`,JSON.stringify(t)),e.json(t)}return n.debug(`Streaming response from Copilot`),h(e,async e=>{let t={messageStartSent:!1,contentBlockIndex:0,contentBlockOpen:!1,toolCalls:{}};for await(let r of a){if(n.debug(`Copilot raw stream event:`,JSON.stringify(r)),r.data===`[DONE]`)break;if(!r.data)continue;let i=JSON.parse(r.data),a=Qt(i,t);for(let t of a)n.debug(`Translated Anthropic event:`,JSON.stringify(t)),await e.writeSSE({event:t.type,data:JSON.stringify(t)})}})}const en=e=>Object.hasOwn(e,`choices`),X=new m;X.post(`/`,async e=>{try{return await $t(e)}catch(t){return await A(e,t)}}),X.post(`/count_tokens`,async e=>{try{return await Xt(e)}catch(t){return await A(e,t)}});const Z=new m;Z.get(`/`,async e=>{try{try{await ye()}catch(e){if(!b.models)throw e;n.warn(`Failed to refresh models, serving cached copy`,e)}let t=b.models?.data.map(e=>({id:e.id,object:`model`,type:`model`,created:0,created_at:new Date(0).toISOString(),owned_by:e.vendor,display_name:e.name}));return e.json({object:`list`,data:t,has_more:!1})}catch(t){return await A(e,t)}});const tn=64*1024;var nn=class{chunks=[];reader;pending;ended=!1;failed=!1;failure;text=``;bytes=0;decoder=new TextDecoder;constructor(e){this.reader=e.getReader()}inspect(e){if(this.chunks.push(e),this.bytes+=e.byteLength,this.bytes>tn)return`pass`;for(this.text+=this.decoder.decode(e,{stream:!0});;){let e=/\r?\n\r?\n/.exec(this.text);if(!e)return`wait`;let t=this.text.slice(0,e.index);this.text=this.text.slice(e.index+e[0].length);let n=t.split(/\r?\n/).filter(e=>e.startsWith(`data:`)).map(e=>e.slice(5).replace(/^ /,``)).join(`
`);if(!n)continue;let r=rn(n);if(r!==`wait`)return r}}replay(e){let t=0;return new Response(new ReadableStream({pull:async e=>{try{if(t<this.chunks.length){e.enqueue(this.chunks[t++]);return}if(this.failed){e.error(this.failure),this.reader.releaseLock();return}if(this.ended){e.close(),this.reader.releaseLock();return}let n=await(this.pending??this.reader.read());this.pending=void 0,n.done?(e.close(),this.reader.releaseLock()):e.enqueue(n.value)}catch(t){e.error(t),this.reader.releaseLock()}},cancel:async e=>{await this.reader.cancel(e),this.reader.releaseLock()}},{highWaterMark:0}),{status:e.status,headers:e.headers})}};function rn(e){let t;try{t=JSON.parse(e)}catch{return`pass`}return!t||typeof t!=`object`||!(`type`in t)?`pass`:t.type===`error`&&`code`in t&&t.code===`invalid_request_body`&&`message`in t&&typeof t.message==`string`?{code:t.code,message:t.message}:[`response.created`,`response.failed`,`response.queued`].includes(String(t.type))?`wait`:`pass`}async function an(e,t=500){if(e.status!==200||!e.body||e.headers.get(`content-type`)?.split(`;`,1)[0].trim().toLowerCase()!==`text/event-stream`)return e;let n=new nn(e.body),r,i=new Promise(e=>{r=setTimeout(()=>e(void 0),t)});try{for(;n.bytes<tn;){n.pending=n.reader.read();let t=await Promise.race([n.pending,i]);if(!t)break;if(n.pending=void 0,t.done){n.ended=!0;break}let r=n.inspect(t.value);if(r===`pass`)break;if(r===`wait`)continue;n.reader.cancel(`Upstream rejected the request before generation`).catch(()=>{});let a=new Headers(e.headers);return a.set(`content-type`,`application/json`),a.delete(`content-length`),a.delete(`content-encoding`),new Response(JSON.stringify({error:{...r,type:`invalid_request_error`}}),{status:400,headers:a})}return n.replay(e)}catch(t){return n.failed=!0,n.failure=t,n.pending=void 0,n.replay(e)}finally{clearTimeout(r)}}const on=new Set(`created,queued,in_progress,completed,failed,incomplete,output_item.added,output_item.done,content_part.added,content_part.done,output_text.delta,output_text.done,output_text.annotation.added,refusal.delta,refusal.done,function_call_arguments.delta,function_call_arguments.done,reasoning_summary_part.added,reasoning_summary_part.done,reasoning_summary_text.delta,reasoning_summary_text.done,reasoning_text.delta,reasoning_text.done,custom_tool_call_input.delta,custom_tool_call_input.done,file_search_call.in_progress,file_search_call.searching,file_search_call.completed,web_search_call.in_progress,web_search_call.searching,web_search_call.completed,code_interpreter_call.in_progress,code_interpreter_call.interpreting,code_interpreter_call.completed,code_interpreter_call_code.delta,code_interpreter_call_code.done,image_generation_call.in_progress,image_generation_call.generating,image_generation_call.completed,image_generation_call.partial_image,mcp_call_arguments.delta,mcp_call_arguments.done,mcp_call.in_progress,mcp_call.completed,mcp_call.failed,mcp_list_tools.in_progress,mcp_list_tools.completed,mcp_list_tools.failed,audio.delta,audio.done,audio_transcript.delta,audio_transcript.done`.split(`,`).map(e=>`response.${e}`));function sn(e){let t=new TextDecoder(`utf-8`,{fatal:!0,ignoreBOM:!0}),n=new TextEncoder,r=[],i=0,a=0,o,s=!0,c,l=new Map;function u(e){let t=e.match(/[^\n]*\n/g)??[],n=[];t.forEach((e,t)=>{let r=/^data:( ?)([\s\S]*?)(\r?\n)$/.exec(e);r&&n.push({index:t,value:r[2],prefix:`data:${r[1]}`,eol:r[3]})});let r;try{r=JSON.parse(n.map(e=>e.value).join(`
`))}catch{return e}if(!r||typeof r!=`object`||Array.isArray(r))return e;let i=t.filter(e=>e.startsWith(`event:`)).at(-1)?.replace(/^event: ?/,``).replace(/\r?\n$/,``),a=r.type??i;if(!on.has(a)||i&&i!==`message`&&i!==a)return e;let o=n.map(e=>e.value).join(`
`),s=[],u=[];for(let e of o.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g)){let t=e[0],n=u.at(-1);if(t===`:`)continue;if(t===`,`){n?.kind===`object`&&(n.keyNext=!0);continue}if(t===`}`||t===`]`){u.pop();continue}if(n?.kind===`object`&&n.keyNext){n.key=JSON.parse(t),n.keyNext=!1;continue}let i=n?n.path===null?null:[...n.path,n.kind===`object`?n.key:n.index++]:[];if(t===`{`||t===`[`){u.push({kind:t===`{`?`object`:`array`,path:i&&i.length<=4?i:null,keyNext:t===`{`,index:0});continue}if(!i||t[0]!==`"`)continue;let o=JSON.parse(t);if(!o)continue;let d;if(i.length===1&&i[0]===`response_id`||i.length===2&&i[0]===`response`&&i[1]===`id`)c??=o,d=c;else{let e;if(Number.isSafeInteger(r.output_index)&&r.output_index>=0&&(i.length===1&&i[0]===`item_id`||i.length===2&&i[0]===`item`&&i[1]===`id`&&(a===`response.output_item.added`||a===`response.output_item.done`))&&(e=r.output_index),i.length===4&&i[0]===`response`&&i[1]===`output`&&typeof i[2]==`number`&&i[3]===`id`&&(e=i[2]),e===void 0)continue;l.has(e)||l.set(e,o),d=l.get(e)}o!==d&&s.push({start:e.index,end:e.index+t.length,value:JSON.stringify(d)})}if(!s.length)return e;let d=o;for(let e of s.reverse())d=d.slice(0,e.start)+e.value+d.slice(e.end);let f=d.split(`
`);for(let[e,r]of n.entries())t[r.index]=`${r.prefix}${f[e]}${r.eol}`;return t.join(``)}function d(e){e.length&&(r.push(e),i+=e.length)}function f(){let e=new Uint8Array(i),t=0;for(let n of r)e.set(n,t),t+=n.length;return r=[],i=0,e}function p(e){let r=f(),i=s;s=!1;let a;try{a=t.decode(r)}catch{e.enqueue(r);return}let o=i&&a.startsWith(`﻿`)?`﻿`:``,c=o+u(a.slice(o.length));e.enqueue(c===a?r:n.encode(c))}return e.pipeThrough(new TransformStream({transform(e,t){let n=0;for(let r=0;r<e.length;r++){let i=e[r];if(i===10){let i=a===0||a===1&&o===13;a=0,i&&(d(e.subarray(n,r+1)),p(t),n=r+1)}else a++;o=i}d(new Uint8Array(e.subarray(n)))},flush(e){i&&e.enqueue(f())}}))}function cn(e,t,n=!0){if(!n||e.status!==200||!e.body||!e.headers.get(`content-type`)?.toLowerCase().includes(`text/event-stream`))return e.body;let r;try{r=JSON.parse(t)}catch{return e.body}return r?.model!==`gpt-6-astra`||r?.stream!==!0?e.body:sn(e.body)}const ln=[`content-type`,`cache-control`,`x-request-id`];function un(e){return dn(e)?.model?.startsWith(`gpt`)??!1}function dn(e){try{return JSON.parse(e)}catch{return}}const fn=async(e,t)=>{let n=pn(e);return Et({path:`/responses`,body:n,requestHeaders:t,initiator:`user`,errorMessage:`Failed to create responses`,throwOnError:!0})};function pn(e){let t=dn(e);if(!t?.tools||!Array.isArray(t.tools))return e;let n=new Set([`image_generation`]),r=t.tools.filter(e=>!n.has(e.type??``));return r.length===t.tools.length?e:(t.tools=r,JSON.stringify(t))}function mn(e){return Ot(e,ln)}async function hn(e){await U(b);let t=await e.req.text();if(!un(t))return e.json({error:{message:`Responses API is only enabled for GPT models.`,type:`invalid_request_error`}},400);b.manualApprove&&await H();let n=await an(await fn(t,e.req.raw.headers));return new Response(cn(n,t,process.env.EDGE_STABLE_IDS!==`0`),{status:n.status,headers:mn(n.headers)})}const Q=new m;Q.post(`/`,async e=>{try{return await hn(e)}catch(t){return await A(e,t)}});const gn=new m;gn.get(`/`,e=>{try{return e.json({token:b.copilotToken})}catch(t){return B(`Error fetching token:`,t),e.json({error:`Failed to fetch token`,token:null},500)}});const _n=new m;_n.get(`/`,async e=>{try{let t=await je();return e.json(t)}catch(t){return B(`Error fetching Copilot usage:`,t),e.json({error:`Failed to fetch Copilot usage`},500)}});const $=new m;$.use(et()),$.use(ae()),$.use(at()),$.use(ot()),$.use($e()),$.use(async(e,t)=>{if(b.paused&&!e.req.path.startsWith(`/admin`))return e.json({error:{message:`Service is paused by administrator`,type:`service_paused`}},503);await t()}),$.route(`/admin`,V),$.route(`/`,wt),$.route(`/chat/completions`,K),$.route(`/models`,Z),$.route(`/embeddings`,q),$.route(`/responses`,Q),$.route(`/usage`,_n),$.route(`/token`,gn),$.route(`/v1/chat/completions`,K),$.route(`/v1/models`,Z),$.route(`/v1/embeddings`,q),$.route(`/v1/responses`,Q),$.route(`/v1/messages`,X);async function vn(e){e.proxyEnv&&Ke(),e.verbose&&(n.level=5,n.info(`Verbose logging enabled`)),b.accountType=e.accountType,e.accountType!==`individual`&&n.info(`Using ${e.accountType} plan GitHub account`),b.manualApprove=e.manual,b.rateLimitSeconds=e.rateLimit,b.rateLimitWait=e.rateLimitWait,b.showToken=e.showToken,b.apiKey=e.apiKey,e.apiKey?n.info(`API key authentication enabled for incoming requests`):n.warn(`No API key set — incoming requests are unauthenticated. Set --api-key or COPILOT_API_KEY before exposing publicly.`),await y(),await R.load(),await be(),e.githubToken?(b.githubToken=e.githubToken,n.info(`Using provided GitHub token`)):await N(),await De(),await ye(),n.info(`Available models: \n${b.models?.data.map(e=>`- ${e.id}`).join(`
`)}`);let t=`http://localhost:${e.port}`;n.box(`🌐 Usage Viewer: https://billxc.github.io/copilot-api?endpoint=${t}/usage`);let r=setInterval(()=>void R.save(),3e4);typeof r.unref==`function`&&r.unref();let i=()=>{R.save().finally(()=>process.exit(0))};process.on(`SIGINT`,i),process.on(`SIGTERM`,i),ee({fetch:$.fetch,port:e.port,idleTimeout:255})}const yn=e({meta:{name:`start`,description:`Start the Copilot API server`},args:{port:{alias:`p`,type:`string`,default:`4141`,description:`Port to listen on`},verbose:{alias:`v`,type:`boolean`,default:!1,description:`Enable verbose logging`},"account-type":{alias:`a`,type:`string`,default:`individual`,description:`Account type to use (individual, business, enterprise)`},manual:{type:`boolean`,default:!1,description:`Enable manual request approval`},"rate-limit":{alias:`r`,type:`string`,description:`Rate limit in seconds between requests`},wait:{alias:`w`,type:`boolean`,default:!1,description:`Wait instead of error when rate limit is hit. Has no effect if rate limit is not set`},"github-token":{alias:`g`,type:`string`,description:"Provide GitHub token directly (must be generated using the `auth` subcommand)"},"show-token":{type:`boolean`,default:!1,description:`Show GitHub and Copilot tokens on fetch and refresh`},"proxy-env":{type:`boolean`,default:!1,description:`Initialize proxy from environment variables`},"api-key":{alias:`k`,type:`string`,description:`Require this key (Bearer token or x-api-key header) on incoming requests. Defaults to COPILOT_API_KEY env var`}},run({args:e}){let t=e[`rate-limit`],n=t===void 0?void 0:Number.parseInt(t,10);return vn({port:Number.parseInt(e.port,10),verbose:e.verbose,accountType:e[`account-type`],manual:e.manual,rateLimit:n,rateLimitWait:e.wait,githubToken:e[`github-token`],showToken:e[`show-token`],proxyEnv:e[`proxy-env`],apiKey:e[`api-key`]??process.env.COPILOT_API_KEY})}}),bn=e({meta:{name:`xc-copilot-api`,version:g.version,description:`A wrapper around GitHub Copilot API to make it OpenAI compatible, making it usable for other tools.`},args:{version:{type:`boolean`,alias:`V`,description:`Show version number`}},run({args:e}){e.version&&(console.log(g.version),process.exit(0))},subCommands:{auth:Ae,start:yn,config:Le,"check-usage":Me,debug:Ge}});await t(bn);export{};
//# sourceMappingURL=main.js.map