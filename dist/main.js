#!/usr/bin/env node
import { bodyWithStableIds as edgeBodyWithStableIds } from "./responses-compat.mjs";
import{defineCommand as e,runMain as t}from"citty";import n from"consola";import r,{copyFile as i,mkdir as a,readFile as o,writeFile as s}from"node:fs/promises";import c,{homedir as l}from"node:os";import u,{join as d}from"node:path";import{randomUUID as ee,timingSafeEqual as f}from"node:crypto";import{serve as te}from"srvx";import{getProxyForUrl as ne}from"proxy-from-env";import{Agent as re,ProxyAgent as ie,setGlobalDispatcher as ae}from"undici";import{Hono as p}from"hono";import{cors as oe}from"hono/cors";import{streamSSE as m}from"hono/streaming";import{events as se}from"fetch-event-stream";var ce=`xc-copilot-api`,le=`1.2.6`,ue=`Turn GitHub Copilot into OpenAI/Anthropic API compatible server. Usable with Claude Code and Codex`,de=[`proxy`,`github-copilot`,`openai-compatible`],fe=`https://github.com/billxc/copilot-api`,pe=`https://github.com/billxc/copilot-api/issues`,me={type:`git`,url:`git+https://github.com/billxc/copilot-api.git`},he=`Xiaochen <wxc9312@gmail.com>`,ge=`module`,_e={"xc-copilot-api":`./dist/main.js`},ve=[`dist`],ye={build:`bun run scripts/generate-page.ts && tsdown`,dev:`bun run scripts/generate-page.ts && bun run --watch ./src/main.ts start`,knip:`knip-bun`,lint:`eslint --cache`,"lint:all":`eslint --cache .`,prepack:`bun run build`,prepare:`simple-git-hooks`,release:`bumpp && bun publish --access public`,start:`NODE_ENV=production bun run ./src/main.ts start`,typecheck:`tsc`},be={},xe={},Se={citty:`^0.1.6`,consola:`^3.4.2`,"fetch-event-stream":`^0.1.5`,"gpt-tokenizer":`^3.0.1`,hono:`^4.9.9`,"proxy-from-env":`^1.1.0`,srvx:`^0.8.9`,undici:`^7.16.0`},Ce={"@echristian/eslint-config":`^0.0.54`,"@types/bun":`^1.2.23`,"@types/proxy-from-env":`^1.0.4`,bumpp:`^10.2.3`,eslint:`^9.37.0`,knip:`^5.64.1`,"simple-git-hooks":`^2.13.1`,tsdown:`^0.15.6`,typescript:`^5.9.3`},h={name:ce,version:le,description:ue,keywords:de,homepage:fe,bugs:pe,repository:me,author:he,type:ge,bin:_e,files:ve,scripts:ye,"simple-git-hooks":be,"lint-staged":xe,dependencies:Se,devDependencies:Ce};const we=u.join(c.homedir(),`.local`,`share`,`copilot-api`),Te=u.join(we,`github_token`),g={APP_DIR:we,GITHUB_TOKEN_PATH:Te};async function _(){await r.mkdir(g.APP_DIR,{recursive:!0}),await Ee(g.GITHUB_TOKEN_PATH)}async function Ee(e){try{await r.access(e,r.constants.W_OK)}catch{await r.writeFile(e,``),await r.chmod(e,384)}}const v={accountType:`individual`,manualApprove:!1,rateLimitWait:!1,showToken:!1,paused:!1},y=()=>({"content-type":`application/json`,accept:`application/json`}),b=`0.26.7`,x=`copilot-chat/${b}`,S=`GitHubCopilotChat/${b}`,C=`2025-04-01`,w=e=>e.accountType===`individual`?`https://api.githubcopilot.com`:`https://api.${e.accountType}.githubcopilot.com`,T=(e,t=!1)=>{let n={Authorization:`Bearer ${e.copilotToken}`,"content-type":y()[`content-type`],"copilot-integration-id":`vscode-chat`,"editor-version":`vscode/${e.vsCodeVersion}`,"editor-plugin-version":x,"user-agent":S,"openai-intent":`conversation-panel`,"x-github-api-version":C,"x-request-id":ee(),"x-vscode-user-agent-library-version":`electron-fetch`};return t&&(n[`copilot-vision-request`]=`true`),n},E=`https://api.github.com`,De=e=>({...y(),authorization:`token ${e.githubToken}`,"editor-version":`vscode/${e.vsCodeVersion}`,"editor-plugin-version":x,"user-agent":S,"x-github-api-version":C,"x-vscode-user-agent-library-version":`electron-fetch`}),D=`https://github.com`,Oe=`Iv1.b507a08c87ecfe98`,ke=[`read:user`].join(` `);var O=class extends Error{response;constructor(e,t){super(e),this.response=t}};async function k(e,t){if(n.error(`Error occurred:`,t),t instanceof O){let r=await t.response.text(),i;try{i=JSON.parse(r)}catch{i=r}return n.error(`HTTP error:`,i),e.json({error:{message:r,type:`error`}},t.response.status)}return e.json({error:{message:t.message,type:`error`}},500)}const A=async()=>{let e=await fetch(`${E}/copilot_internal/v2/token`,{headers:De(v)});if(!e.ok)throw new O(`Failed to get Copilot token`,e);return await e.json()};async function Ae(){let e=await fetch(`${D}/login/device/code`,{method:`POST`,headers:y(),body:JSON.stringify({client_id:Oe,scope:ke})});if(!e.ok)throw new O(`Failed to get device code`,e);return await e.json()}async function je(){let e=await fetch(`${E}/user`,{headers:{authorization:`token ${v.githubToken}`,...y()}});if(!e.ok)throw new O(`Failed to get GitHub user`,e);return await e.json()}const Me=async()=>{let e=await fetch(`${w(v)}/models`,{headers:T(v)});if(!e.ok)throw new O(`Failed to get models`,e);return await e.json()},Ne=`1.104.3`;async function Pe(){let e=new AbortController,t=setTimeout(()=>{e.abort()},5e3);try{let t=(await(await fetch(`https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=visual-studio-code-bin`,{signal:e.signal})).text()).match(/pkgver=([0-9.]+)/);return t?t[1]:Ne}catch{return Ne}finally{clearTimeout(t)}}await Pe();const j=e=>new Promise(t=>{setTimeout(t,e)}),Fe=e=>e==null;async function Ie(){v.models=await Me()}const Le=async()=>{let e=await Pe();v.vsCodeVersion=e,n.info(`Using VSCode version: ${e}`)};async function Re(e){let t=(e.interval+1)*1e3;for(n.debug(`Polling access token with interval of ${t}ms`);;){let r=await fetch(`${D}/login/oauth/access_token`,{method:`POST`,headers:y(),body:JSON.stringify({client_id:Oe,device_code:e.device_code,grant_type:`urn:ietf:params:oauth:grant-type:device_code`})});if(!r.ok){await j(t),n.error(`Failed to poll access token:`,await r.text());continue}let i=await r.json();n.debug(`Polling access token response:`,i);let{access_token:a}=i;if(a)return a;await j(t)}}const ze=()=>r.readFile(g.GITHUB_TOKEN_PATH,`utf8`),Be=e=>r.writeFile(g.GITHUB_TOKEN_PATH,e),Ve=e=>new Promise(t=>{setTimeout(t,e)}),He=async(e=3,t=1e3)=>{let r=null;for(let i=0;i<e;i++)try{return await A()}catch(a){r=a;let o=t*2**i;n.warn(`Token refresh attempt ${i+1}/${e} failed, retrying in ${o}ms:`,r.message),i<e-1&&await Ve(o)}throw r||Error(`Failed to refresh Copilot token`)},Ue=async()=>{try{n.debug(`Force refreshing Copilot token due to 401 response`);let{token:e}=await He();v.copilotToken=e,n.debug(`Copilot token force refreshed successfully`)}catch(e){n.error(`Failed to force refresh Copilot token:`,e)}},We=async()=>{let{token:e,refresh_in:t}=await A();v.copilotToken=e,n.debug(`GitHub Copilot Token fetched successfully!`),v.showToken&&n.info(`Copilot token:`,e);let r=(t-60)*1e3;setInterval(async()=>{try{n.debug(`Refreshing Copilot token`);let{token:e}=await He();v.copilotToken=e,n.debug(`Copilot token refreshed successfully`),v.showToken&&n.info(`Refreshed Copilot token:`,e)}catch(e){n.error(`Failed to refresh Copilot token, will retry on next interval:`,e)}},r)};async function M(e){try{let t=await ze();if(t&&!e?.force){v.githubToken=t,v.showToken&&n.info(`GitHub token:`,t),await N();return}n.info(`Not logged in, getting new access token`);let r=await Ae();n.debug(`Device code response:`,r),n.info(`Please enter the code "${r.user_code}" in ${r.verification_uri}`);let i=await Re(r);await Be(i),v.githubToken=i,v.showToken&&n.info(`GitHub token:`,i),await N()}catch(e){throw e instanceof O?(n.error(`Failed to get GitHub token:`,await e.response.json()),e):(n.error(`Failed to get GitHub token:`,e),e)}}async function N(){let e=await je();v.githubLogin=e.login,n.info(`Logged in as ${e.login}`)}async function Ge(e){e.verbose&&(n.level=5,n.info(`Verbose logging enabled`)),v.showToken=e.showToken,await _(),await M({force:!0}),n.success(`GitHub token written to`,g.GITHUB_TOKEN_PATH)}const Ke=e({meta:{name:`auth`,description:`Run GitHub auth flow without running the server`},args:{verbose:{alias:`v`,type:`boolean`,default:!1,description:`Enable verbose logging`},"show-token":{type:`boolean`,default:!1,description:`Show GitHub token on auth`}},run({args:e}){return Ge({verbose:e.verbose,showToken:e[`show-token`]})}}),P=async()=>{let e=await fetch(`${E}/copilot_internal/user`,{headers:De(v)});if(!e.ok)throw new O(`Failed to get Copilot usage`,e);return await e.json()},qe=e({meta:{name:`check-usage`,description:`Show current GitHub Copilot usage/quota information`},async run(){await _(),await M();try{let e=await P(),t=e.quota_snapshots.premium_interactions,r=t.entitlement,i=r-t.remaining,a=r>0?i/r*100:0,o=t.percent_remaining;function s(e,t){if(!t)return`${e}: N/A`;let n=t.entitlement,r=n-t.remaining,i=n>0?r/n*100:0,a=t.percent_remaining;return`${e}: ${r}/${n} used (${i.toFixed(1)}% used, ${a.toFixed(1)}% remaining)`}let c=`Premium: ${i}/${r} used (${a.toFixed(1)}% used, ${o.toFixed(1)}% remaining)`,l=s(`Chat`,e.quota_snapshots.chat),u=s(`Completions`,e.quota_snapshots.completions);n.box(`Copilot Usage (plan: ${e.copilot_plan})\nQuota resets: ${e.quota_reset_date}\n\nQuotas:\n  ${c}\n  ${l}\n  ${u}`)}catch(e){n.error(`Failed to fetch Copilot usage:`,e),process.exit(1)}}});async function F(e){try{let t=`${e}.bak`;await i(e,t),n.info(`Backup saved: ${t}`)}catch{}}const I={"4.8":`claude-opus-4.8`,"4.7":`claude-opus-4.7-1m-internal`,"4.6":`claude-opus-4.6-1m`};async function Je(e,t){let r=I[t];r||(n.error(`Unknown Claude model version: ${t}. Supported: ${Object.keys(I).join(`, `)}`),process.exit(1));let i=d(l(),`.claude`),c=d(i,`settings.json`);await a(i,{recursive:!0});let u={};try{let e=await o(c,`utf-8`);u=JSON.parse(e)}catch(e){e.code!==`ENOENT`&&(n.error(`Failed to parse ${c}. Please fix it manually.`),process.exit(1))}let ee=typeof u.env==`object`&&u.env!==null?u.env:{},f={...u,env:{...ee,ANTHROPIC_BASE_URL:`http://localhost:${e}`,ANTHROPIC_AUTH_TOKEN:`Powered by xc copilot`,ANTHROPIC_DEFAULT_OPUS_MODEL:r,CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS:`1`},model:`opus[1m]`};await F(c),await s(c,JSON.stringify(f,null,2)+`
`,`utf-8`),n.success(`Claude Code configured: ${c}`)}function L(e,t,n){let r=RegExp(`^${t}\\s*=.*$`,`m`),i=`${t} = ${JSON.stringify(n)}`;if(r.test(e))return e.replace(r,i);let a=e.match(/^\[/m);return a?.index===void 0?e.trimEnd()+`
`+i+`
`:e.slice(0,a.index)+i+`
`+e.slice(a.index)}function Ye(e,t,n){let r=t.replace(/[.*+?^${}()|[\]\\]/g,`\\$&`),i=RegExp(`^\\[${r}\\]\\n[^[]*`,`m`),a=`[${t}]\n${n}\n\n`;return i.test(e)?e.replace(i,a):e.trimEnd()+`

`+a}async function Xe(e){let t=d(l(),`.codex`),r=d(t,`config.toml`);await a(t,{recursive:!0});let i=``;try{i=await o(r,`utf-8`)}catch(e){e.code!==`ENOENT`&&(n.error(`Failed to read ${r}. Please fix it manually.`),process.exit(1))}i=L(i,`model`,`gpt-5.5`),i=L(i,`model_provider`,`copilot-api`),i=Ye(i,`model_providers.copilot-api`,`name = "copilot-api"\nbase_url = "http://localhost:${e}/v1"\nwire_api = "responses"`),await F(r),await s(r,i,`utf-8`),n.success(`Codex CLI configured: ${r}`)}const Ze=e({meta:{name:`config`,description:`Configure external AI tools (Claude Code, Codex CLI) to use Copilot API. Configures both by default; use --claude or --codex to target one.`},args:{claude:{alias:`c`,type:`boolean`,default:!1,description:`Configure Claude Code (~/.claude/settings.json)`},codex:{alias:`x`,type:`boolean`,default:!1,description:`Configure Codex CLI (~/.codex/config.toml)`},"claude-model":{alias:`m`,type:`string`,default:`4.8`,description:`Claude Opus model version (4.8, 4.7, or 4.6)`},port:{alias:`p`,type:`string`,default:`4141`,description:`Port the Copilot API server listens on`}},async run({args:e}){let t=Number.parseInt(e.port,10),n=!e.claude&&!e.codex;(n||e.claude)&&await Je(t,e[`claude-model`]),(n||e.codex)&&await Xe(t)}});async function Qe(){try{let e=new URL(`../package.json`,import.meta.url).pathname;return JSON.parse(await r.readFile(e)).version}catch{return`unknown`}}function $e(){let e=typeof Bun<`u`;return{name:e?`bun`:`node`,version:e?Bun.version:process.version.slice(1),platform:c.platform(),arch:c.arch()}}async function et(){try{return(await r.stat(g.GITHUB_TOKEN_PATH)).isFile()?(await r.readFile(g.GITHUB_TOKEN_PATH,`utf8`)).trim().length>0:!1}catch{return!1}}async function tt(){let[e,t]=await Promise.all([Qe(),et()]);return{version:e,runtime:$e(),paths:{APP_DIR:g.APP_DIR,GITHUB_TOKEN_PATH:g.GITHUB_TOKEN_PATH},tokenExists:t}}function nt(e){n.info(`xc-copilot-api debug

Version: ${e.version}
Runtime: ${e.runtime.name} ${e.runtime.version} (${e.runtime.platform} ${e.runtime.arch})

Paths:
- APP_DIR: ${e.paths.APP_DIR}
- GITHUB_TOKEN_PATH: ${e.paths.GITHUB_TOKEN_PATH}

Token exists: ${e.tokenExists?`Yes`:`No`}`)}function rt(e){console.log(JSON.stringify(e,null,2))}async function it(e){let t=await tt();e.json?rt(t):nt(t)}const at=e({meta:{name:`debug`,description:`Print debug information about the application`},args:{json:{type:`boolean`,default:!1,description:`Output debug information as JSON`}},run({args:e}){return it({json:e.json})}});function ot(){if(!(typeof Bun<`u`))try{let e=new re,t=new Map;ae({dispatch(r,i){try{let a=typeof r.origin==`string`?new URL(r.origin):r.origin,o=ne(a.toString()),s=o&&o.length>0?o:void 0;if(!s)return n.debug(`HTTP proxy bypass: ${a.hostname}`),e.dispatch(r,i);let c=t.get(s);c||(c=new ie(s),t.set(s,c));let l=s;try{let e=new URL(s);l=`${e.protocol}//${e.host}`}catch{}return n.debug(`HTTP proxy route: ${a.hostname} via ${l}`),c.dispatch(r,i)}catch{return e.dispatch(r,i)}},close(){return e.close()},destroy(){return e.destroy()}}),n.debug(`HTTP proxy configured from environment (per-URL)`)}catch(e){n.debug(`Proxy setup skipped:`,e)}}const R=u.join(g.APP_DIR,`stats.json`),st=new Set([`/`,`/chat/completions`,`/models`,`/embeddings`,`/responses`,`/usage`,`/token`]);function ct(e){return st.has(e)?!0:e.startsWith(`/v1/`)||e.startsWith(`/admin/`)}const z=new class{startedAt=Date.now();totalRequests=0;droppedNoise=0;tokens={prompt:0,completion:0,total:0};byModel=new Map;byIp=new Map;byStatus=new Map;recent=[];noteDropped(){this.droppedNoise+=1}record(e){this.totalRequests+=1,this.byStatus.set(e.status,(this.byStatus.get(e.status)??0)+1);if(!this.byKey)this.byKey=new Map;{let k=e.keyId||(e.status===401?'__unauth__':'__unknown__');let kv=this.byKey.get(k)??{count:0,tokens:0,lastSeen:0,ips:new Set,models:new Set};kv.count+=1;kv.lastSeen=e.time;if(e.ip)kv.ips.add(e.ip);if(e.model)kv.models.add(e.model);this.byKey.set(k,kv);}let t=this.byIp.get(e.ip)??{count:0,authorized:0,unauthorized:0,tokens:0,lastSeen:0,models:new Set,keys:new Set};if(t.count+=1,t.lastSeen=e.time,e.status===401?t.unauthorized+=1:e.status<400&&(t.authorized+=1),e.model&&t.models.add(e.model),(t.keys instanceof Set||(t.keys=new Set(Array.isArray(t.keys)?t.keys:[]))),e.keyId&&t.keys.add(e.keyId),this.byIp.set(e.ip,t),e.model){let t=this.byModel.get(e.model)??{count:0,prompt:0,completion:0,total:0};t.count+=1,this.byModel.set(e.model,t)}this.recent.push(e),this.recent.length>200&&this.recent.splice(0,this.recent.length-200)}addTokens(e,t){this.tokens.prompt+=t.prompt,this.tokens.completion+=t.completion,this.tokens.total+=t.total;if(this.byKey&&e.keyId){let kv=this.byKey.get(e.keyId);if(kv)kv.tokens+=t.total;}let n=this.byIp.get(e.ip);if(n&&(n.tokens+=t.total),e.model){let n=this.byModel.get(e.model)??{count:0,prompt:0,completion:0,total:0};n.prompt+=t.prompt,n.completion+=t.completion,n.total+=t.total,this.byModel.set(e.model,n)}}snapshot(e){let t=Date.now();return{startedAt:new Date(this.startedAt).toISOString(),uptimeSeconds:Math.floor((t-this.startedAt)/1e3),paused:e,totalRequests:this.totalRequests,droppedNoise:this.droppedNoise,tokens:this.tokens,models:[...this.byModel.entries()].map(([e,t])=>({model:e,...t})).sort((e,t)=>t.count-e.count),ips:[...this.byIp.entries()].map(([e,t])=>({ip:e,count:t.count,authorized:t.authorized,unauthorized:t.unauthorized,tokens:t.tokens,lastSeen:new Date(t.lastSeen).toISOString(),models:[...t.models],keys:[...(t.keys instanceof Set||Array.isArray(t.keys)?t.keys:[])]})).sort((e,t)=>t.count-e.count),keys:[...(this.byKey||new Map).entries()].map(([e,t])=>({key:e,count:t.count,tokens:t.tokens,lastSeen:new Date(t.lastSeen).toISOString(),ips:[...t.ips],ipCount:t.ips.size,models:[...t.models]})).sort((e,t)=>t.count-e.count),statuses:Object.fromEntries([...this.byStatus.entries()].sort((e,t)=>e[0]-t[0])),recent:[...this.recent].reverse()}}serialize(){return JSON.stringify({startedAt:this.startedAt,totalRequests:this.totalRequests,droppedNoise:this.droppedNoise,tokens:this.tokens,byModel:[...this.byModel.entries()],byIp:[...this.byIp.entries()].map(([e,t])=>[e,{...t,models:[...t.models],keys:[...(t.keys instanceof Set||Array.isArray(t.keys)?t.keys:[])]}]),byStatus:[...this.byStatus.entries()],recent:this.recent})}async save(){try{let e=`${R}.tmp`;await r.writeFile(e,this.serialize()),await r.rename(e,R)}catch{}}async load(){try{let e=await r.readFile(R,`utf8`),t=JSON.parse(e);this.startedAt=t.startedAt??this.startedAt,this.totalRequests=t.totalRequests??0,this.droppedNoise=t.droppedNoise??0,this.tokens=t.tokens??{prompt:0,completion:0,total:0},this.byModel=new Map(t.byModel??[]),this.byIp=new Map((t.byIp??[]).map(([e,t])=>[e,{...t,models:new Set(t.models),keys:new Set(Array.isArray(t.keys)?t.keys:[])}])),this.byStatus=new Map(t.byStatus??[]),this.recent=t.recent??[]}catch{}}};function lt(e){let t=e.req.header(`x-real-ip`);if(t)return t.trim();let n=e.req.header(`x-forwarded-for`);if(n){let e=n.split(`,`)[0]?.trim();if(e)return e}return e.req.raw.ip??`unknown`}function ut(e){let t=t=>{let n;for(let r of e.matchAll(t))n=Number.parseInt(r[1],10);return n},n=t(/"(?:prompt_tokens|input_tokens)"\s*:\s*(\d+)/g),r=t(/"(?:completion_tokens|output_tokens)"\s*:\s*(\d+)/g),i=t(/"total_tokens"\s*:\s*(\d+)/g);if(!(n===void 0&&r===void 0&&i===void 0))return i===void 0&&(i=(n??0)+(r??0)),{prompt:n??0,completion:r??0,total:i}}function dt(e,t){/*__MULTIKEY__*/let ks=String(t==null?'':t).split(',').map(s=>s.trim()).filter(Boolean);let names=(process.env.COPILOT_API_KEY_NAMES||'').split(',').map(s=>s.trim());let n=Buffer.from(e);for(let i=0;i<ks.length;i++){let r=Buffer.from(ks[i]);if(n.length===r.length&&f(n,r))return names[i]||('key'+(i+1));}return false}function ft(e){let t=e.req.header(`authorization`);if(t){let e=/^Bearer\s+(.+)$/i.exec(t);if(e)return e[1].trim()}let n=e.req.header(`x-api-key`);if(n)return n.trim()}function pt(){return async function(e,t){let{apiKey:n}=v;if(!n){await t();return}if(e.req.method===`OPTIONS`){await t();return}let r=ft(e);let kid=r?dt(r,n):false;if(!r||!kid)return e.json({error:{message:`Unauthorized: invalid or missing API key`,type:`authentication_error`}},401);try{e.set('keyId',kid)}catch{}await t()}}function B(){return new Date().toISOString()}function mt(){return async function(e,t){let n=performance.now();await t();let r=(performance.now()-n).toFixed(1),i=e.req.method,a=e.req.path,o=e.res.status;console.log(`[${B()}] ${i} ${a} ${o} ${r}ms`)}}function V(e,t){console.error(`[${B()}] ${e}`,t)}const ht=[`/chat/completions`,`/responses`,`/messages`,`/embeddings`];function gt(e){return ht.some(t=>e===t||e.endsWith(t))}async function _t(e){if(e.req.method===`POST`)try{let t=await e.req.raw.clone().text();return/"model"\s*:\s*"([^"]+)"/.exec(t)?.[1]}catch{return}}async function vt(e,t){try{let n=e.getReader(),r=new TextDecoder,i=``,a=4e6;for(;;){let{done:e,value:t}=await n.read();if(e)break;t&&(i+=r.decode(t,{stream:!0})),i.length>a&&(i=i.slice(-a))}let o=ut(i);o&&(t.promptTokens=o.prompt,t.completionTokens=o.completion,t.totalTokens=o.total,z.addTokens(t,o))}catch{}}function yt(){return async function(e,t){if(!ct(e.req.path))return z.noteDropped(),e.json({error:{message:`Not found`,type:`not_found`}},404);await t()}}function bt(){return async function(e,t){let n=performance.now(),r=lt(e),i=await _t(e);await t();let kid;try{kid=e.get('keyId')}catch{}let a={time:Date.now(),ip:r,method:e.req.method,path:e.req.path,model:i,status:e.res.status,keyId:kid||null,durationMs:Number((performance.now()-n).toFixed(1))};if(z.record(a),e.res.body&&gt(e.req.path))try{let[t,n]=e.res.body.tee();e.res=new Response(t,{status:e.res.status,headers:e.res.headers}),vt(n,a)}catch{}}}const H=new p;H.get(`/stats`,e=>e.json(z.snapshot(v.paused))),H.post(`/pause`,e=>(v.paused=!0,n.warn(`Service PAUSED via /admin/pause — proxy endpoints return 503`),e.json({paused:!0}))),H.post(`/resume`,e=>(v.paused=!1,n.info(`Service RESUMED via /admin/resume`),e.json({paused:!1}))),H.post(`/shutdown`,e=>(n.warn(`Shutdown requested via /admin/shutdown — exiting process`),setTimeout(()=>{z.save().finally(()=>process.exit(0))},100),e.json({shuttingDown:!0})));const U=async()=>{if(!await n.prompt(`Accept incoming request?`,{type:`confirm`}))throw new O(`Request rejected`,Response.json({message:`Request rejected`},{status:403}))};async function W(e){if(e.rateLimitSeconds===void 0)return;let t=Date.now();if(!e.lastRequestTimestamp){e.lastRequestTimestamp=t;return}let r=(t-e.lastRequestTimestamp)/1e3;if(r>e.rateLimitSeconds){e.lastRequestTimestamp=t;return}let i=Math.ceil(e.rateLimitSeconds-r);if(!e.rateLimitWait)throw n.warn(`Rate limit exceeded. Need to wait ${i} more seconds.`),new O(`Rate limit exceeded`,Response.json({message:`Rate limit exceeded`},{status:429}));let a=i*1e3;n.warn(`Rate limit reached. Waiting ${i} seconds before proceeding...`),await j(a),e.lastRequestTimestamp=t,n.info(`Rate limit wait completed, proceeding with request`)}const G={o200k_base:()=>import(`gpt-tokenizer/encoding/o200k_base`),cl100k_base:()=>import(`gpt-tokenizer/encoding/cl100k_base`),p50k_base:()=>import(`gpt-tokenizer/encoding/p50k_base`),p50k_edit:()=>import(`gpt-tokenizer/encoding/p50k_edit`),r50k_base:()=>import(`gpt-tokenizer/encoding/r50k_base`)},K=new Map,xt=(e,t,n)=>{let r=0;for(let i of e)r+=n.funcInit,r+=t.encode(JSON.stringify(i)).length;return r+=n.funcEnd,r},St=(e,t)=>{let n=0;for(let r of e)r.type===`image_url`?n+=t.encode(r.image_url.url).length+85:r.text&&(n+=t.encode(r.text).length);return n},Ct=(e,t,n)=>{let r=3;for(let[i,a]of Object.entries(e))typeof a==`string`&&(r+=t.encode(a).length),i===`name`&&(r+=1),i===`tool_calls`&&(r+=xt(a,t,n)),i===`content`&&Array.isArray(a)&&(r+=St(a,t));return r},wt=(e,t,n)=>{if(e.length===0)return 0;let r=0;for(let i of e)r+=Ct(i,t,n);return r+=3,r},Tt=async e=>{if(K.has(e)){let t=K.get(e);if(t)return t}let t=e;if(!(t in G)){let t=await G.o200k_base();return K.set(e,t),t}let n=await G[t]();return K.set(e,n),n},Et=e=>e.capabilities.tokenizer||`o200k_base`,Dt=e=>e.id===`gpt-3.5-turbo`||e.id===`gpt-4`?{funcInit:10,propInit:3,propKey:3,enumInit:-3,enumItem:3,funcEnd:12}:{funcInit:7,propInit:3,propKey:3,enumInit:-3,enumItem:3,funcEnd:12},Ot=(e,t,n)=>{let{encoder:r,constants:i}=n,a=i.propKey;if(typeof t!=`object`||!t)return a;let o=t,s=e,c=o.type||`string`,l=o.description||``;if(o.enum&&Array.isArray(o.enum)){a+=i.enumInit;for(let e of o.enum)a+=i.enumItem,a+=r.encode(String(e)).length}l.endsWith(`.`)&&(l=l.slice(0,-1));let u=`${s}:${c}:${l}`;a+=r.encode(u).length;let d=new Set([`type`,`description`,`enum`]);for(let e of Object.keys(o))if(!d.has(e)){let t=o[e],n=typeof t==`string`?t:JSON.stringify(t);a+=r.encode(`${e}:${n}`).length}return a},kt=(e,t,n)=>{if(!e||typeof e!=`object`)return 0;let r=e,i=0;for(let[e,a]of Object.entries(r))if(e===`properties`){let e=a;if(Object.keys(e).length>0){i+=n.propInit;for(let r of Object.keys(e))i+=Ot(r,e[r],{encoder:t,constants:n})}}else{let n=typeof a==`string`?a:JSON.stringify(a);i+=t.encode(`${e}:${n}`).length}return i},At=(e,t,n)=>{let r=n.funcInit,i=e.function,a=i.name,o=i.description||``;o.endsWith(`.`)&&(o=o.slice(0,-1));let s=a+`:`+o;return r+=t.encode(s).length,typeof i.parameters==`object`&&i.parameters!==null&&(r+=kt(i.parameters,t,n)),r},jt=(e,t,n)=>{let r=0;for(let i of e)r+=At(i,t,n);return r+=n.funcEnd,r},Mt=async(e,t)=>{let n=Et(t),r=await Tt(n),i=e.messages,a=i.filter(e=>e.role!==`assistant`),o=i.filter(e=>e.role===`assistant`),s=Dt(t),c=wt(a,r,s);e.tools&&e.tools.length>0&&(c+=jt(e.tools,r,s));let l=wt(o,r,s);return{input:c,output:l}},Nt=async e=>{if(!v.copilotToken)throw Error(`Copilot token not found`);let t=e.messages.some(e=>typeof e.content!=`string`&&e.content?.some(e=>e.type===`image_url`)),r=e.messages.some(e=>[`assistant`,`tool`].includes(e.role)),i=()=>({...T(v,t),"X-Initiator":r?`agent`:`user`}),a=await fetch(`${w(v)}/chat/completions`,{method:`POST`,headers:i(),body:JSON.stringify(e)});if(a.status===401&&(n.warn(`Received 401, attempting to refresh token and retry`),await Ue(),a=await fetch(`${w(v)}/chat/completions`,{method:`POST`,headers:i(),body:JSON.stringify(e)})),!a.ok)throw n.error(`Failed to create chat completions`,a),new O(`Failed to create chat completions`,a);return e.stream?se(a):await a.json()};async function Pt(e){await W(v);let t=await e.req.json();n.debug(`Request payload:`,JSON.stringify(t).slice(-400));let r=v.models?.data.find(e=>e.id===t.model);try{if(r){let e=await Mt(t,r);n.info(`Current token count:`,e)}else n.warn(`No model selected, skipping token count calculation`)}catch(e){n.warn(`Failed to calculate token count:`,e)}v.manualApprove&&await U(),Fe(t.max_tokens)&&!/^gpt-5/.test(t.model||"")&&(t={...t,max_tokens:r?.capabilities.limits.max_output_tokens},n.debug(`Set max_tokens to:`,JSON.stringify(t.max_tokens)));if(/^gpt-5/.test(t.model||"")&&t.max_tokens!=null&&t.max_completion_tokens==null){t={...t,max_completion_tokens:t.max_tokens};delete t.max_tokens}let i=await Nt(t);return Ft(i)?(n.debug(`Non-streaming response:`,JSON.stringify(i)),e.json(i)):(n.debug(`Streaming response`),m(e,async e=>{for await(let t of i)n.debug(`Streaming chunk:`,JSON.stringify(t)),await e.writeSSE(t)}))}const Ft=e=>Object.hasOwn(e,`choices`),q=new p;q.post(`/`,async e=>{try{return await Pt(e)}catch(t){return await k(e,t)}});const It=async e=>{if(!v.copilotToken)throw Error(`Copilot token not found`);let t=await fetch(`${w(v)}/embeddings`,{method:`POST`,headers:T(v),body:JSON.stringify(e)});if(!t.ok)throw new O(`Failed to create embeddings`,t);return await t.json()},J=new p;J.post(`/`,async e=>{try{let t=await e.req.json(),n=await It(t);return e.json(n)}catch(t){return await k(e,t)}});const Lt=e=>`<!doctype html>
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
`,Rt=new p;Rt.get(`/`,e=>{let t=process.env.npm_package_version??h.version,n=v.githubLogin??`unknown`,r=v.accountType,i=e.req.query(`format`),a=e.req.header(`accept`)??``;if(i===`json`||a.includes(`application/json`))return e.json({version:t,login:n,accountType:r});if(i===`text`||!a.includes(`text/html`))return e.text(`Copilot API v${t} - running\nUser: ${n} (${r})`);let o=`<span class="text-xs px-2 py-0.5 rounded-full font-mono" style="background: var(--bg-hover); color: var(--fg-muted)">v${t}</span>`;return e.html(Lt(o))});const zt=new Set([`connection`,`content-length`,`keep-alive`,`proxy-authenticate`,`proxy-authorization`,`te`,`trailer`,`transfer-encoding`,`upgrade`]);async function Bt({path:e,body:t,requestHeaders:r,forwardRequestHeaders:i,initiator:a,enableVision:o=!1,errorMessage:s,throwOnError:c=!1}){if(!v.copilotToken)throw Error(`Copilot token not found`);let l=await u();if(l.status===401&&(n.warn(`Received 401, attempting to refresh Copilot token and retry`),await Ue(),l=await u()),n.debug(`Passthrough response:`,{path:e,status:l.status,ok:l.ok}),!l.ok&&(n.error(s,l),c))throw new O(s,l);return l;async function u(){let s=Vt({requestHeaders:r,forwardRequestHeaders:i,initiator:a,enableVision:o});return n.debug(`Passthrough request:`,{method:`POST`,path:e,bodyLength:t.length}),fetch(`${w(v)}${e}`,{method:`POST`,headers:s,body:t})}}function Vt({requestHeaders:e,forwardRequestHeaders:t=[],initiator:n,enableVision:r=!1}){let i={...T(v,r),"X-Initiator":n};if(!e)return i;for(let n of t){let t=e.get(n);t&&(i[n]=t)}return i}function Ht(e,t){let n=new Headers;if(t){for(let r of t){let t=e.get(r);t&&n.set(r,t)}return n}for(let[t,r]of e.entries())zt.has(t.toLowerCase())||n.set(t,r);return n}const Ut=[`accept`,`anthropic-beta`,`anthropic-version`],Wt=`context-1m-2025-08-07`,Gt=new Set([Wt]);function Kt(e){let t=e.get(`anthropic-beta`);return t?t.split(`,`).map(e=>e.trim()).includes(Wt):!1}function qt(e){let t=e.get(`anthropic-beta`);if(!t)return e;let n=t.split(`,`).map(e=>e.trim()).filter(e=>!Gt.has(e)).join(`,`),r=new Headers(e);return n?r.set(`anthropic-beta`,n):r.delete(`anthropic-beta`),r}function Jt(e){let t={modified:!1};try{let n=JSON.parse(e,(e,n)=>{if(e===`cache_control`&&typeof n==`object`&&n&&!Array.isArray(n)){let e=n,r=Object.keys(e);if(r.length>1||r.length===1&&!r.includes(`type`))return t.modified=!0,{type:e.type}}return n});return t.modified?JSON.stringify(n):e}catch{return e}}async function Yt(e,t,r=`/v1/messages`){return n.debug(`Original request headers: ${JSON.stringify([...t])}`),Kt(t)&&(n.debug(`Request includes unsupported beta features. Stripping unsupported beta flags and fields.`),t=qt(t)),Bt({path:r,body:Jt(e),requestHeaders:t,forwardRequestHeaders:Ut,initiator:`user`,errorMessage:`Upstream ${r} request failed`})}function Xt(e){return Qt(e)?.model?.startsWith(`claude`)??!1}function Zt(e){return Ht(e)}function Qt(e){try{return JSON.parse(e)}catch{return}}function $t(e){return e===null?null:{stop:`end_turn`,length:`max_tokens`,tool_calls:`tool_use`,content_filter:`end_turn`}[e]}function en(e){return{model:tn(e.model),messages:nn(e.messages,e.system),max_tokens:e.max_tokens,stop:e.stop_sequences,stream:e.stream,temperature:e.temperature,top_p:e.top_p,user:e.metadata?.user_id,tools:sn(e.tools),tool_choice:cn(e.tool_choice)}}function tn(e){return e.startsWith(`claude-sonnet-4-`)?e.replace(/^claude-sonnet-4-.*/,`claude-sonnet-4`):e.startsWith(`claude-opus-`)?e.replace(/^claude-opus-4-.*/,`claude-opus-4`):e}function nn(e,t){let n=rn(t),r=e.flatMap(e=>e.role===`user`?an(e):on(e));return[...n,...r]}function rn(e){if(!e)return[];if(typeof e==`string`)return[{role:`system`,content:e}];let t=e;return Array.isArray(e)&&(t=e.filter(e=>!e.text.includes(`x-anthropic-billing-header:`))),[{role:`system`,content:t.map(e=>e.text).join(`

`)}]}function an(e){let t=[];if(Array.isArray(e.content)){let n=e.content.filter(e=>e.type===`tool_result`),r=e.content.filter(e=>e.type!==`tool_result`);for(let e of n)t.push({role:`tool`,tool_call_id:e.tool_use_id,content:Y(e.content)});r.length>0&&t.push({role:`user`,content:Y(r)})}else t.push({role:`user`,content:Y(e.content)});return t}function on(e){if(!Array.isArray(e.content))return[{role:`assistant`,content:Y(e.content)}];let t=e.content.filter(e=>e.type===`tool_use`),n=e.content.filter(e=>e.type===`text`),r=e.content.filter(e=>e.type===`thinking`),i=[...n.map(e=>e.text),...r.map(e=>e.thinking)].join(`

`);return t.length>0?[{role:`assistant`,content:i||null,tool_calls:t.map(e=>({id:e.id,type:`function`,function:{name:e.name,arguments:JSON.stringify(e.input)}}))}]:[{role:`assistant`,content:Y(e.content)}]}function Y(e){if(typeof e==`string`)return e;if(!Array.isArray(e))return null;if(!e.some(e=>e.type===`image`))return e.filter(e=>e.type===`text`||e.type===`thinking`).map(e=>e.type===`text`?e.text:e.thinking).join(`

`);let t=[];for(let n of e)switch(n.type){case`text`:t.push({type:`text`,text:n.text});break;case`thinking`:t.push({type:`text`,text:n.thinking});break;case`image`:t.push({type:`image_url`,image_url:{url:`data:${n.source.media_type};base64,${n.source.data}`}});break}return t}function sn(e){if(e)return e.map(e=>({type:`function`,function:{name:e.name,description:e.description,parameters:e.input_schema}}))}function cn(e){if(e)switch(e.type){case`auto`:return`auto`;case`any`:return`required`;case`tool`:return e.name?{type:`function`,function:{name:e.name}}:void 0;case`none`:return`none`;default:return}}function ln(e){let t=[],n=[],r=null;r=e.choices[0]?.finish_reason??r;for(let i of e.choices){let e=un(i.message.content),a=dn(i.message.tool_calls);t.push(...e),n.push(...a),(i.finish_reason===`tool_calls`||r===`stop`)&&(r=i.finish_reason)}return{id:e.id,type:`message`,role:`assistant`,model:e.model,content:[...t,...n],stop_reason:$t(r),stop_sequence:null,usage:{input_tokens:(e.usage?.prompt_tokens??0)-(e.usage?.prompt_tokens_details?.cached_tokens??0),output_tokens:e.usage?.completion_tokens??0,...e.usage?.prompt_tokens_details?.cached_tokens!==void 0&&{cache_read_input_tokens:e.usage.prompt_tokens_details.cached_tokens}}}}function un(e){return typeof e==`string`?[{type:`text`,text:e}]:Array.isArray(e)?e.filter(e=>e.type===`text`).map(e=>({type:`text`,text:e.text})):[]}function dn(e){return e?e.map(e=>({type:`tool_use`,id:e.id,name:e.function.name,input:JSON.parse(e.function.arguments)})):[]}async function fn(e){try{let t=await e.req.text();if(n.debug(`Anthropic count_tokens payload:`,t.slice(0,1e3)),Xt(t)){let n=await Yt(t,e.req.raw.headers,`/v1/messages/count_tokens`);return new Response(n.body,{status:n.status,headers:Zt(n.headers)})}let r=e.req.header(`anthropic-beta`),i=JSON.parse(t),a=en(i),o=v.models?.data.find(e=>e.id===i.model);if(!o)return n.warn(`Model not found, returning default token count`),e.json({input_tokens:1});let s=await Mt(a,o);if(i.tools&&i.tools.length>0){let e=!1;r?.startsWith(`claude-code`)&&(e=i.tools.some(e=>e.name.startsWith(`mcp__`))),e||(i.model.startsWith(`claude`)?s.input+=346:i.model.startsWith(`grok`)&&(s.input+=480))}let c=s.input+s.output;return i.model.startsWith(`claude`)?c=Math.round(c*1.15):i.model.startsWith(`grok`)&&(c=Math.round(c*1.03)),n.info(`Token count:`,c),e.json({input_tokens:c})}catch(t){return n.error(`Error counting tokens:`,t),e.json({input_tokens:1})}}function pn(e){return e.contentBlockOpen?Object.values(e.toolCalls).some(t=>t.anthropicBlockIndex===e.contentBlockIndex):!1}function mn(e,t){let n=[];if(e.choices.length===0)return n;let r=e.choices[0],{delta:i}=r;if(t.messageStartSent||=(n.push({type:`message_start`,message:{id:e.id,type:`message`,role:`assistant`,content:[],model:e.model,stop_reason:null,stop_sequence:null,usage:{input_tokens:(e.usage?.prompt_tokens??0)-(e.usage?.prompt_tokens_details?.cached_tokens??0),output_tokens:0,...e.usage?.prompt_tokens_details?.cached_tokens!==void 0&&{cache_read_input_tokens:e.usage.prompt_tokens_details.cached_tokens}}}}),!0),i.content&&(pn(t)&&(n.push({type:`content_block_stop`,index:t.contentBlockIndex}),t.contentBlockIndex++,t.contentBlockOpen=!1),t.contentBlockOpen||=(n.push({type:`content_block_start`,index:t.contentBlockIndex,content_block:{type:`text`,text:``}}),!0),n.push({type:`content_block_delta`,index:t.contentBlockIndex,delta:{type:`text_delta`,text:i.content}})),i.tool_calls)for(let e of i.tool_calls){if(e.id&&e.function?.name){t.contentBlockOpen&&=(n.push({type:`content_block_stop`,index:t.contentBlockIndex}),t.contentBlockIndex++,!1);let r=t.contentBlockIndex;t.toolCalls[e.index]={id:e.id,name:e.function.name,anthropicBlockIndex:r},n.push({type:`content_block_start`,index:r,content_block:{type:`tool_use`,id:e.id,name:e.function.name,input:{}}}),t.contentBlockOpen=!0}if(e.function?.arguments){let r=t.toolCalls[e.index];r&&n.push({type:`content_block_delta`,index:r.anthropicBlockIndex,delta:{type:`input_json_delta`,partial_json:e.function.arguments}})}}return r.finish_reason&&(t.contentBlockOpen&&=(n.push({type:`content_block_stop`,index:t.contentBlockIndex}),!1),n.push({type:`message_delta`,delta:{stop_reason:$t(r.finish_reason),stop_sequence:null},usage:{input_tokens:(e.usage?.prompt_tokens??0)-(e.usage?.prompt_tokens_details?.cached_tokens??0),output_tokens:e.usage?.completion_tokens??0,...e.usage?.prompt_tokens_details?.cached_tokens!==void 0&&{cache_read_input_tokens:e.usage.prompt_tokens_details.cached_tokens}}},{type:`message_stop`})),n}async function hn(e){await W(v);let t=await e.req.text();if(n.debug(`Anthropic request payload:`,t.slice(0,1e3)),Xt(t)){v.manualApprove&&await U();let n=await Yt(t,e.req.raw.headers);return new Response(n.body,{status:n.status,headers:Zt(n.headers)})}let r=JSON.parse(t);n.debug(`Anthropic request payload:`,JSON.stringify(r));let i=en(r);n.debug(`Translated OpenAI request payload:`,JSON.stringify(i)),v.manualApprove&&await U();let a=await Nt(i);if(gn(a)){n.debug(`Non-streaming response from Copilot:`,JSON.stringify(a).slice(-400));let t=ln(a);return n.debug(`Translated Anthropic response:`,JSON.stringify(t)),e.json(t)}return n.debug(`Streaming response from Copilot`),m(e,async e=>{let t={messageStartSent:!1,contentBlockIndex:0,contentBlockOpen:!1,toolCalls:{}};for await(let r of a){if(n.debug(`Copilot raw stream event:`,JSON.stringify(r)),r.data===`[DONE]`)break;if(!r.data)continue;let i=JSON.parse(r.data),a=mn(i,t);for(let t of a)n.debug(`Translated Anthropic event:`,JSON.stringify(t)),await e.writeSSE({event:t.type,data:JSON.stringify(t)})}})}const gn=e=>Object.hasOwn(e,`choices`),X=new p;X.post(`/`,async e=>{try{return await hn(e)}catch(t){return await k(e,t)}}),X.post(`/count_tokens`,async e=>{try{return await fn(e)}catch(t){return await k(e,t)}});const Z=new p;Z.get(`/`,async e=>{try{try{await Ie()}catch(e){if(!v.models)throw e;n.warn(`Failed to refresh models, serving cached copy`,e)}let t=v.models?.data.map(e=>({id:e.id,object:`model`,type:`model`,created:0,created_at:new Date(0).toISOString(),owned_by:e.vendor,display_name:e.name}));return e.json({object:`list`,data:t,has_more:!1})}catch(t){return await k(e,t)}});const _n=[`content-type`,`cache-control`,`x-request-id`];function vn(e){return yn(e)?.model?.startsWith(`gpt`)??!1}function yn(e){try{return JSON.parse(e)}catch{return}}const bn=async(e,t)=>{let n=xn(e);return Bt({path:`/responses`,body:n,requestHeaders:t,initiator:`user`,errorMessage:`Failed to create responses`,throwOnError:!0})};function xn(e){let t=yn(e);if(!t?.tools||!Array.isArray(t.tools))return e;let n=new Set([`image_generation`]),r=t.tools.filter(e=>!n.has(e.type??``));return r.length===t.tools.length?e:(t.tools=r,JSON.stringify(t))}function Sn(e){return Ht(e,_n)}async function Cn(e){await W(v);let t=await e.req.text();if(!vn(t))return e.json({error:{message:`Responses API is only enabled for GPT models.`,type:`invalid_request_error`}},400);v.manualApprove&&await U();let n=await bn(t,e.req.raw.headers);return new Response(edgeBodyWithStableIds(n,t,process.env.EDGE_STABLE_IDS!=='0'),{status:n.status,headers:Sn(n.headers)})}const Q=new p;Q.post(`/`,async e=>{try{return await Cn(e)}catch(t){return await k(e,t)}});const wn=new p;wn.get(`/`,e=>{try{return e.json({token:v.copilotToken})}catch(t){return V(`Error fetching token:`,t),e.json({error:`Failed to fetch token`,token:null},500)}});const Tn=new p;Tn.get(`/`,async e=>{try{let t=await P();return e.json(t)}catch(t){return V(`Error fetching Copilot usage:`,t),e.json({error:`Failed to fetch Copilot usage`},500)}});const $=new p;$.use(mt()),$.use(oe()),$.use(yt()),$.use(bt()),$.use(pt()),$.use(async(e,t)=>{if(v.paused&&!e.req.path.startsWith(`/admin`))return e.json({error:{message:`Service is paused by administrator`,type:`service_paused`}},503);await t()}),$.route(`/admin`,H),$.route(`/`,Rt),$.route(`/chat/completions`,q),$.route(`/models`,Z),$.route(`/embeddings`,J),$.route(`/responses`,Q),$.route(`/usage`,Tn),$.route(`/token`,wn),$.route(`/v1/chat/completions`,q),$.route(`/v1/models`,Z),$.route(`/v1/embeddings`,J),$.route(`/v1/responses`,Q),$.route(`/v1/messages`,X);async function En(e){e.proxyEnv&&ot(),e.verbose&&(n.level=5,n.info(`Verbose logging enabled`)),v.accountType=e.accountType,e.accountType!==`individual`&&n.info(`Using ${e.accountType} plan GitHub account`),v.manualApprove=e.manual,v.rateLimitSeconds=e.rateLimit,v.rateLimitWait=e.rateLimitWait,v.showToken=e.showToken,v.apiKey=e.apiKey,e.apiKey?n.info(`API key authentication enabled for incoming requests`):n.warn(`No API key set — incoming requests are unauthenticated. Set --api-key or COPILOT_API_KEY before exposing publicly.`),await _(),await z.load(),await Le(),e.githubToken?(v.githubToken=e.githubToken,n.info(`Using provided GitHub token`)):await M(),await We(),await Ie(),n.info(`Available models: \n${v.models?.data.map(e=>`- ${e.id}`).join(`
`)}`);let t=`http://localhost:${e.port}`;n.box(`🌐 Usage Viewer: https://billxc.github.io/copilot-api?endpoint=${t}/usage`);let r=setInterval(()=>void z.save(),3e4);typeof r.unref==`function`&&r.unref();let i=()=>{z.save().finally(()=>process.exit(0))};process.on(`SIGINT`,i),process.on(`SIGTERM`,i),te({fetch:$.fetch,port:e.port,idleTimeout:255})}const Dn=e({meta:{name:`start`,description:`Start the Copilot API server`},args:{port:{alias:`p`,type:`string`,default:`4141`,description:`Port to listen on`},verbose:{alias:`v`,type:`boolean`,default:!1,description:`Enable verbose logging`},"account-type":{alias:`a`,type:`string`,default:`individual`,description:`Account type to use (individual, business, enterprise)`},manual:{type:`boolean`,default:!1,description:`Enable manual request approval`},"rate-limit":{alias:`r`,type:`string`,description:`Rate limit in seconds between requests`},wait:{alias:`w`,type:`boolean`,default:!1,description:`Wait instead of error when rate limit is hit. Has no effect if rate limit is not set`},"github-token":{alias:`g`,type:`string`,description:"Provide GitHub token directly (must be generated using the `auth` subcommand)"},"show-token":{type:`boolean`,default:!1,description:`Show GitHub and Copilot tokens on fetch and refresh`},"proxy-env":{type:`boolean`,default:!1,description:`Initialize proxy from environment variables`},"api-key":{alias:`k`,type:`string`,description:`Require this key (Bearer token or x-api-key header) on incoming requests. Defaults to COPILOT_API_KEY env var`}},run({args:e}){let t=e[`rate-limit`],n=t===void 0?void 0:Number.parseInt(t,10);return En({port:Number.parseInt(e.port,10),verbose:e.verbose,accountType:e[`account-type`],manual:e.manual,rateLimit:n,rateLimitWait:e.wait,githubToken:e[`github-token`],showToken:e[`show-token`],proxyEnv:e[`proxy-env`],apiKey:e[`api-key`]??process.env.COPILOT_API_KEY})}}),On=e({meta:{name:`xc-copilot-api`,version:h.version,description:`A wrapper around GitHub Copilot API to make it OpenAI compatible, making it usable for other tools.`},args:{version:{type:`boolean`,alias:`V`,description:`Show version number`}},run({args:e}){e.version&&(console.log(h.version),process.exit(0))},subCommands:{auth:Ke,start:Dn,config:Ze,"check-usage":qe,debug:at}});await t(On);export{};
//# sourceMappingURL=main.js.map