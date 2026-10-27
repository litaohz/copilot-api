#!/usr/bin/env node
import{defineCommand as e,runMain as t}from"citty";import n from"consola";import r,{copyFile as i,mkdir as a,readFile as o,writeFile as s}from"node:fs/promises";import c,{homedir as l}from"node:os";import u,{join as d}from"node:path";import{randomUUID as f,timingSafeEqual as p}from"node:crypto";import{serve as ee}from"srvx";import{getProxyForUrl as te}from"proxy-from-env";import{Agent as ne,ProxyAgent as re,setGlobalDispatcher as ie}from"undici";import{Hono as m}from"hono";import{cors as ae}from"hono/cors";import{streamSSE as h}from"hono/streaming";import{events as oe}from"fetch-event-stream";var g={name:`xc-copilot-api`,version:`1.2.6`,description:`Turn GitHub Copilot into OpenAI/Anthropic API compatible server. Usable with Claude Code and Codex`,keywords:[`proxy`,`github-copilot`,`openai-compatible`],homepage:`https://github.com/litaohz/copilot-api`,bugs:`https://github.com/litaohz/copilot-api/issues`,repository:{type:`git`,url:`git+https://github.com/litaohz/copilot-api.git`},author:`Xiaochen <wxc9312@gmail.com>`,type:`module`,bin:{"xc-copilot-api":`./dist/main.js`},files:[`dist`],scripts:{build:`bun run scripts/generate-page.ts && tsdown`,dev:`bun run scripts/generate-page.ts && bun run --watch ./src/main.ts start`,knip:`knip-bun`,lint:`eslint --cache`,"lint:all":`eslint --cache .`,prepack:`bun run build`,release:`bumpp && bun publish --access public`,start:`NODE_ENV=production bun run ./src/main.ts start`,typecheck:`tsc`},dependencies:{citty:`^0.1.6`,consola:`^3.4.2`,"fetch-event-stream":`^0.1.5`,"gpt-tokenizer":`^3.0.1`,hono:`^4.9.9`,"proxy-from-env":`^1.1.0`,srvx:`^0.8.9`,undici:`^7.16.0`},devDependencies:{"@echristian/eslint-config":`^0.0.54`,"@types/bun":`^1.2.23`,"@types/proxy-from-env":`^1.0.4`,bumpp:`^10.2.3`,eslint:`^9.37.0`,knip:`^5.64.1`,"prettier-plugin-packagejson":`^3.0.2`,tsdown:`^0.15.6`,typescript:`^5.9.3`}};const _={accountType:`individual`,manualApprove:!1,rateLimitWait:!1,showToken:!1,paused:!1};function se(e=`github.com`){let t=e.trim().toLowerCase(),n=new URL(t.includes(`://`)?t:`https://${t}`);if(n.protocol!==`https:`||n.username||n.password||n.port||n.pathname!==`/`||n.search||n.hash||!/^(?:github\.com|[a-z\d](?:[a-z\d-]*[a-z\d])?\.ghe\.com)$/.test(n.hostname))throw Error(`GitHub host must be github.com or <enterprise>.ghe.com`);return n.hostname}const v={"github-host":{type:`string`,description:`GitHub host (github.com or <enterprise>.ghe.com); defaults to COPILOT_GITHUB_HOST`},"data-dir":{type:`string`,description:`Private token and statistics directory; defaults to COPILOT_DATA_DIR or a host-specific directory`}};function y(e={}){_.githubHost=se(e.githubHost??process.env.COPILOT_GITHUB_HOST),_.dataDir=e.dataDir??process.env.COPILOT_DATA_DIR,_.copilotApiBaseUrl=void 0}const b={get APP_DIR(){if(_.dataDir)return u.resolve(_.dataDir);let e=u.join(c.homedir(),`.local`,`share`,`copilot-api`);return _.githubHost&&_.githubHost!==`github.com`?u.join(e,_.githubHost):e},get GITHUB_TOKEN_PATH(){return u.join(this.APP_DIR,`github_token`)}};async function x(){await r.mkdir(b.APP_DIR,{recursive:!0,mode:448}),await ce(b.GITHUB_TOKEN_PATH)}async function ce(e){try{await r.access(e,r.constants.W_OK)}catch{await r.writeFile(e,``,{flag:`wx`,mode:384}),await r.chmod(e,384)}}const S=()=>({"content-type":`application/json`,accept:`application/json`}),le=`0.26.7`,ue=`copilot-chat/${le}`,de=`GitHubCopilotChat/${le}`,C=`2025-04-01`,w=e=>{if(e.copilotApiBaseUrl)return e.copilotApiBaseUrl;if(e.githubHost&&e.githubHost!==`github.com`)throw Error(`Enterprise Copilot token did not provide an API endpoint`);return e.accountType===`individual`?`https://api.githubcopilot.com`:`https://api.${e.accountType}.githubcopilot.com`},T=(e,t=!1)=>{let n={Authorization:`Bearer ${e.copilotToken}`,"content-type":S()[`content-type`],"copilot-integration-id":`vscode-chat`,"editor-version":`vscode/${e.vsCodeVersion}`,"editor-plugin-version":ue,"user-agent":de,"openai-intent":`conversation-panel`,"x-github-api-version":C,"x-request-id":f(),"x-vscode-user-agent-library-version":`electron-fetch`};return t&&(n[`copilot-vision-request`]=`true`),n},E=e=>`https://api.${e.githubHost??`github.com`}`,fe=e=>({...S(),authorization:`token ${e.githubToken}`,"editor-version":`vscode/${e.vsCodeVersion}`,"editor-plugin-version":ue,"user-agent":de,"x-github-api-version":C,"x-vscode-user-agent-library-version":`electron-fetch`}),D=e=>`https://${e.githubHost??`github.com`}`,O=`Iv1.b507a08c87ecfe98`,pe=[`read:user`].join(` `);var k=class extends Error{response;constructor(e,t){super(e),this.response=t}};async function A(e,t){if(n.error(`Error occurred:`,t),t instanceof k){let r=await t.response.text(),i;try{i=JSON.parse(r)}catch{i=r}n.error(`HTTP error:`,i);let a=typeof i==`object`&&!!i&&`error`in i&&typeof i.error==`object`&&i.error!==null,o=t.response.headers.get(`x-request-id`);return o&&e.header(`x-request-id`,o),e.json(a?i:{error:{message:r,type:`error`}},t.response.status)}return e.json({error:{message:t.message,type:`error`}},500)}const me=async()=>{let e=await fetch(`${E(_)}/copilot_internal/v2/token`,{headers:fe(_),redirect:`error`});if(!e.ok)throw new k(`Failed to get Copilot token`,e);return await e.json()};async function he(){let e=await fetch(`${D(_)}/login/device/code`,{method:`POST`,redirect:`error`,headers:S(),body:JSON.stringify({client_id:O,scope:pe})});if(!e.ok)throw new k(`Failed to get device code`,e);let t=await e.json();if(!t.device_code||!t.user_code||!Number.isFinite(t.expires_in)||t.expires_in<=0||!Number.isFinite(t.interval)||t.interval<0)throw Error(`GitHub returned an invalid device authorization response`);let n=new URL(t.verification_uri);if(n.origin!==D(_)||n.username||n.password)throw Error(`GitHub returned a verification URL for a different host`);return t}async function ge(){let e=await fetch(`${E(_)}/user`,{redirect:`error`,headers:{authorization:`token ${_.githubToken}`,...S()}});if(!e.ok)throw new k(`Failed to get GitHub user`,e);return await e.json()}const _e=async()=>{let e=await fetch(`${w(_)}/models`,{headers:T(_)});if(!e.ok)throw new k(`Failed to get models`,e);return await e.json()},ve=`1.104.3`;async function ye(){let e=new AbortController,t=setTimeout(()=>{e.abort()},5e3);try{let t=(await(await fetch(`https://aur.archlinux.org/cgit/aur.git/plain/PKGBUILD?h=visual-studio-code-bin`,{signal:e.signal})).text()).match(/pkgver=([0-9.]+)/);return t?t[1]:ve}catch{return ve}finally{clearTimeout(t)}}await ye();const be=e=>new Promise(t=>{setTimeout(t,e)}),xe=e=>e==null;async function Se(){_.models=await _e()}const Ce=async()=>{let e=await ye();_.vsCodeVersion=e,n.info(`Using VSCode version: ${e}`)};async function we(e,t={now:Date.now,wait:be}){let n=t.now()+e.expires_in*1e3,r=(e.interval+1)*1e3;for(;t.now()+r<n;){await t.wait(r);let i=n-t.now();if(i<=0)break;let a=await fetch(`${D(_)}/login/oauth/access_token`,{method:`POST`,redirect:`error`,signal:AbortSignal.timeout(Math.min(i,3e4)),headers:S(),body:JSON.stringify({client_id:O,device_code:e.device_code,grant_type:`urn:ietf:params:oauth:grant-type:device_code`})});if(!a.ok)throw new k(`Failed to poll GitHub authorization`,a);let o=await a.json();if(o.access_token)return o.access_token;switch(o.error){case`authorization_pending`:break;case`slow_down`:r+=5e3;break;case`access_denied`:throw Error(`GitHub authorization was denied; run auth to try again`);case`expired_token`:throw Error(`GitHub device code expired; run auth for a new code`);default:throw Error(`GitHub device authorization failed; run auth again`)}}throw Error(`GitHub device code expired; run auth for a new code`)}function Te(e){let t=new URL(e),n=_.githubHost??`github.com`,r=t.hostname===`api.githubcopilot.com`||t.hostname.endsWith(`.githubcopilot.com`)||n!==`github.com`&&t.hostname.endsWith(`.${n}`);if(t.protocol!==`https:`||t.username||t.password||t.port||t.pathname!==`/`||t.search||t.hash||!r)throw Error(`GitHub returned an invalid Copilot API endpoint`);return t.origin}function j(e){let t=e.endpoints?.api?Te(e.endpoints.api):void 0;if(!t&&_.githubHost&&_.githubHost!==`github.com`)throw Error(`Enterprise Copilot token did not provide an API endpoint`);if(!e.token)throw Error(`GitHub returned an empty Copilot token`);_.copilotApiBaseUrl=t,_.copilotToken=e.token}const Ee=()=>r.readFile(b.GITHUB_TOKEN_PATH,`utf8`),De=e=>r.writeFile(b.GITHUB_TOKEN_PATH,e,{mode:384}),Oe=e=>new Promise(t=>{setTimeout(t,e)}),ke=async(e=3,t=1e3)=>{let r=null;for(let i=0;i<e;i++)try{return await me()}catch(a){r=a;let o=t*2**i;n.warn(`Token refresh attempt ${i+1}/${e} failed, retrying in ${o}ms:`,r.message),i<e-1&&await Oe(o)}throw r||Error(`Failed to refresh Copilot token`)},Ae=async()=>{try{n.debug(`Force refreshing Copilot token due to 401 response`),j(await ke()),n.debug(`Copilot token force refreshed successfully`)}catch(e){n.error(`Failed to force refresh Copilot token:`,e)}},je=async()=>{let e=await me(),{token:t,refresh_in:r}=e;j(e),n.debug(`GitHub Copilot Token fetched successfully!`),_.showToken&&n.info(`Copilot token:`,t);let i=Math.max(30,r-60)*1e3;setInterval(async()=>{try{n.debug(`Refreshing Copilot token`);let e=await ke();j(e),n.debug(`Copilot token refreshed successfully`),_.showToken&&n.info(`Refreshed Copilot token:`,e.token)}catch(e){n.error(`Failed to refresh Copilot token, will retry on next interval:`,e)}},i)};async function M(e){try{let t=await Ee();if(t&&!e?.force){_.githubToken=t,_.showToken&&n.info(`GitHub token:`,t),await Me();return}n.info(`Not logged in, getting new access token`);let r=await he();n.info(`Please enter the code "${r.user_code}" in ${r.verification_uri}`);let i=new URL(r.verification_uri);i.searchParams.set(`user_code`,r.user_code),n.info(`Authorize this instance: ${i.href}`),n.info(`This code expires in ${r.expires_in} seconds`);let a=await we(r);await De(a),_.githubToken=a,_.showToken&&n.info(`GitHub token:`,a),await Me()}catch(e){throw e instanceof k?(n.error(`Failed to get GitHub token:`,await e.response.json()),e):(n.error(`Failed to get GitHub token:`,e),e)}}async function Me(){let e=await ge();_.githubLogin=e.login,n.info(`Logged in as ${e.login}`)}async function Ne(e){y(e),e.verbose&&(n.level=5,n.info(`Verbose logging enabled`)),_.showToken=e.showToken,await x(),await M({force:!0}),n.success(`GitHub token written to`,b.GITHUB_TOKEN_PATH)}const Pe=e({meta:{name:`auth`,description:`Run GitHub auth flow without running the server`},args:{...v,verbose:{alias:`v`,type:`boolean`,default:!1,description:`Enable verbose logging`},"show-token":{type:`boolean`,default:!1,description:`Show GitHub token on auth`}},run({args:e}){return Ne({verbose:e.verbose,showToken:e[`show-token`],githubHost:e[`github-host`],dataDir:e[`data-dir`]})}}),Fe=async()=>{let e=await fetch(`${E(_)}/copilot_internal/user`,{headers:fe(_),redirect:`error`});if(!e.ok)throw new k(`Failed to get Copilot usage`,e);return await e.json()},Ie=e({meta:{name:`check-usage`,description:`Show current GitHub Copilot usage/quota information`},args:v,async run({args:e}){y({githubHost:e[`github-host`],dataDir:e[`data-dir`]}),await x(),await M();try{let e=await Fe(),t=e.quota_snapshots.premium_interactions,r=t.entitlement,i=r-t.remaining,a=r>0?i/r*100:0,o=t.percent_remaining;function s(e,t){if(!t)return`${e}: N/A`;let n=t.entitlement,r=n-t.remaining,i=n>0?r/n*100:0,a=t.percent_remaining;return`${e}: ${r}/${n} used (${i.toFixed(1)}% used, ${a.toFixed(1)}% remaining)`}let c=`Premium: ${i}/${r} used (${a.toFixed(1)}% used, ${o.toFixed(1)}% remaining)`,l=s(`Chat`,e.quota_snapshots.chat),u=s(`Completions`,e.quota_snapshots.completions);n.box(`Copilot Usage (plan: ${e.copilot_plan})\nQuota resets: ${e.quota_reset_date}\n\nQuotas:\n  ${c}\n  ${l}\n  ${u}`)}catch(e){n.error(`Failed to fetch Copilot usage:`,e),process.exit(1)}}});async function Le(e){try{let t=`${e}.bak`;await i(e,t),n.info(`Backup saved: ${t}`)}catch{}}const Re={"4.8":`claude-opus-4.8`,"4.7":`claude-opus-4.7-1m-internal`,"4.6":`claude-opus-4.6-1m`};async function ze(e,t){let r=Re[t];r||(n.error(`Unknown Claude model version: ${t}. Supported: ${Object.keys(Re).join(`, `)}`),process.exit(1));let i=d(l(),`.claude`),c=d(i,`settings.json`);await a(i,{recursive:!0});let u={};try{let e=await o(c,`utf8`);u=JSON.parse(e)}catch(e){e.code!==`ENOENT`&&(n.error(`Failed to parse ${c}. Please fix it manually.`),process.exit(1))}let f=typeof u.env==`object`&&u.env!==null?u.env:{},p={...u,env:{...f,ANTHROPIC_BASE_URL:`http://localhost:${e}`,ANTHROPIC_AUTH_TOKEN:`Powered by xc copilot`,ANTHROPIC_DEFAULT_OPUS_MODEL:r,CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS:`1`},model:`opus[1m]`};await Le(c),await s(c,JSON.stringify(p,null,2)+`
`,`utf8`),n.success(`Claude Code configured: ${c}`)}function Be(e,t,n){let r=RegExp(`^${t}\\s*=.*$`,`m`),i=`${t} = ${JSON.stringify(n)}`;if(r.test(e))return e.replace(r,i);let a=e.match(/^\[/m);return a?.index===void 0?e.trimEnd()+`
`+i+`
`:e.slice(0,a.index)+i+`
`+e.slice(a.index)}function Ve(e,t,n){let r=t.replaceAll(/[.*+?^${}()|[\]\\]/g,String.raw`\$&`),i=RegExp(`^\\[${r}\\]\\n[^[]*`,`m`),a=`[${t}]\n${n}\n\n`;return i.test(e)?e.replace(i,a):e.trimEnd()+`

`+a}async function He(e){let t=d(l(),`.codex`),r=d(t,`config.toml`);await a(t,{recursive:!0});let i=``;try{i=await o(r,`utf8`)}catch(e){e.code!==`ENOENT`&&(n.error(`Failed to read ${r}. Please fix it manually.`),process.exit(1))}i=Be(i,`model`,`gpt-5.5`),i=Be(i,`model_provider`,`copilot-api`),i=Ve(i,`model_providers.copilot-api`,`name = "copilot-api"\nbase_url = "http://localhost:${e}/v1"\nwire_api = "responses"`),await Le(r),await s(r,i,`utf8`),n.success(`Codex CLI configured: ${r}`)}const Ue=e({meta:{name:`config`,description:`Configure external AI tools (Claude Code, Codex CLI) to use Copilot API. Configures both by default; use --claude or --codex to target one.`},args:{claude:{alias:`c`,type:`boolean`,default:!1,description:`Configure Claude Code (~/.claude/settings.json)`},codex:{alias:`x`,type:`boolean`,default:!1,description:`Configure Codex CLI (~/.codex/config.toml)`},"claude-model":{alias:`m`,type:`string`,default:`4.8`,description:`Claude Opus model version (4.8, 4.7, or 4.6)`},port:{alias:`p`,type:`string`,default:`4141`,description:`Port the Copilot API server listens on`}},async run({args:e}){let t=Number.parseInt(e.port,10),n=!e.claude&&!e.codex;(n||e.claude)&&await ze(t,e[`claude-model`]),(n||e.codex)&&await He(t)}});async function We(){try{let e=new URL(`../package.json`,import.meta.url).pathname;return JSON.parse(await r.readFile(e)).version}catch{return`unknown`}}function Ge(){let e=typeof Bun<`u`;return{name:e?`bun`:`node`,version:e?Bun.version:process.version.slice(1),platform:c.platform(),arch:c.arch()}}async function Ke(){try{return(await r.stat(b.GITHUB_TOKEN_PATH)).isFile()?(await r.readFile(b.GITHUB_TOKEN_PATH,`utf8`)).trim().length>0:!1}catch{return!1}}async function qe(){let[e,t]=await Promise.all([We(),Ke()]);return{version:e,runtime:Ge(),paths:{APP_DIR:b.APP_DIR,GITHUB_TOKEN_PATH:b.GITHUB_TOKEN_PATH},tokenExists:t}}function Je(e){n.info(`xc-copilot-api debug

Version: ${e.version}
Runtime: ${e.runtime.name} ${e.runtime.version} (${e.runtime.platform} ${e.runtime.arch})

Paths:
- APP_DIR: ${e.paths.APP_DIR}
- GITHUB_TOKEN_PATH: ${e.paths.GITHUB_TOKEN_PATH}

Token exists: ${e.tokenExists?`Yes`:`No`}`)}function Ye(e){console.log(JSON.stringify(e,null,2))}async function Xe(e){let t=await qe();e.json?Ye(t):Je(t)}const Ze=e({meta:{name:`debug`,description:`Print debug information about the application`},args:{json:{type:`boolean`,default:!1,description:`Output debug information as JSON`}},run({args:e}){return Xe({json:e.json})}});function Qe(){if(!(typeof Bun<`u`))try{let e=new ne,t=new Map;ie({dispatch(r,i){try{let a=typeof r.origin==`string`?new URL(r.origin):r.origin,o=te(a.toString()),s=o&&o.length>0?o:void 0;if(!s)return n.debug(`HTTP proxy bypass: ${a.hostname}`),e.dispatch(r,i);let c=t.get(s);c||(c=new re(s),t.set(s,c));let l=s;try{let e=new URL(s);l=`${e.protocol}//${e.host}`}catch{}return n.debug(`HTTP proxy route: ${a.hostname} via ${l}`),c.dispatch(r,i)}catch{return e.dispatch(r,i)}},close(){return e.close()},destroy(){return e.destroy()}}),n.debug(`HTTP proxy configured from environment (per-URL)`)}catch(e){n.debug(`Proxy setup skipped:`,e)}}function N(e){return e instanceof Set?e:new Set(Array.isArray(e)?e:[])}const P=()=>u.join(b.APP_DIR,`stats.json`),$e=new Set([`/`,`/chat/completions`,`/models`,`/embeddings`,`/responses`,`/systemone`,`/usage`,`/token`]);function et(e){return $e.has(e)?!0:e.startsWith(`/v1/`)||e.startsWith(`/admin/`)}const F=new class{startedAt=Date.now();totalRequests=0;droppedNoise=0;tokens={prompt:0,completion:0,total:0};byModel=new Map;byIp=new Map;byStatus=new Map;byKey=new Map;recent=[];noteDropped(){this.droppedNoise+=1}record(e){this.totalRequests+=1,this.byStatus.set(e.status,(this.byStatus.get(e.status)??0)+1);let t=e.keyId||(e.status===401?`__unauth__`:`__unknown__`),n=this.byKey.get(t)??{count:0,tokens:0,lastSeen:0,ips:new Set,models:new Set};n.count+=1,n.lastSeen=e.time,e.ip&&n.ips.add(e.ip),e.model&&n.models.add(e.model),this.byKey.set(t,n);let r=this.byIp.get(e.ip)??{count:0,authorized:0,unauthorized:0,tokens:0,lastSeen:0,models:new Set,keys:new Set};if(r.count+=1,r.lastSeen=e.time,e.status===401?r.unauthorized+=1:e.status<400&&(r.authorized+=1),e.model&&r.models.add(e.model),r.keys=N(r.keys),e.keyId&&r.keys.add(e.keyId),this.byIp.set(e.ip,r),e.model){let t=this.byModel.get(e.model)??{count:0,prompt:0,completion:0,total:0};t.count+=1,this.byModel.set(e.model,t)}this.recent.push(e),this.recent.length>200&&this.recent.splice(0,this.recent.length-200)}addTokens(e,t){if(this.tokens.prompt+=t.prompt,this.tokens.completion+=t.completion,this.tokens.total+=t.total,e.keyId){let n=this.byKey.get(e.keyId);n&&(n.tokens+=t.total)}let n=this.byIp.get(e.ip);if(n&&(n.tokens+=t.total),e.model){let n=this.byModel.get(e.model)??{count:0,prompt:0,completion:0,total:0};n.prompt+=t.prompt,n.completion+=t.completion,n.total+=t.total,this.byModel.set(e.model,n)}}snapshot(e){let t=Date.now();return{startedAt:new Date(this.startedAt).toISOString(),uptimeSeconds:Math.floor((t-this.startedAt)/1e3),paused:e,totalRequests:this.totalRequests,droppedNoise:this.droppedNoise,tokens:this.tokens,models:[...this.byModel.entries()].map(([e,t])=>({model:e,...t})).sort((e,t)=>t.count-e.count),ips:[...this.byIp.entries()].map(([e,t])=>({ip:e,count:t.count,authorized:t.authorized,unauthorized:t.unauthorized,tokens:t.tokens,lastSeen:new Date(t.lastSeen).toISOString(),models:[...t.models],keys:[...N(t.keys)]})).sort((e,t)=>t.count-e.count),keys:[...this.byKey.entries()].map(([e,t])=>({key:e,count:t.count,tokens:t.tokens,lastSeen:new Date(t.lastSeen).toISOString(),ips:[...t.ips],ipCount:t.ips.size,models:[...t.models]})).sort((e,t)=>t.count-e.count),statuses:Object.fromEntries([...this.byStatus.entries()].sort((e,t)=>e[0]-t[0])),recent:[...this.recent].reverse()}}serialize(){return JSON.stringify({startedAt:this.startedAt,totalRequests:this.totalRequests,droppedNoise:this.droppedNoise,tokens:this.tokens,byModel:[...this.byModel.entries()],byIp:[...this.byIp.entries()].map(([e,t])=>[e,{...t,models:[...t.models],keys:[...N(t.keys)]}]),byStatus:[...this.byStatus.entries()],recent:this.recent})}async save(){try{let e=`${P()}.tmp`;await r.writeFile(e,this.serialize()),await r.rename(e,P())}catch{}}async load(){try{let e=await r.readFile(P(),`utf8`),t=JSON.parse(e);this.startedAt=t.startedAt??this.startedAt,this.totalRequests=t.totalRequests??0,this.droppedNoise=t.droppedNoise??0,this.tokens=t.tokens??{prompt:0,completion:0,total:0},this.byModel=new Map(t.byModel??[]),this.byIp=new Map((t.byIp??[]).map(([e,t])=>[e,{...t,models:new Set(t.models),keys:N(t.keys)}])),this.byStatus=new Map(t.byStatus??[]),this.recent=t.recent??[]}catch{}}};function tt(e){let t=e.req.header(`x-real-ip`);if(t)return t.trim();let n=e.req.header(`x-forwarded-for`);if(n){let e=n.split(`,`)[0]?.trim();if(e)return e}return e.req.raw.ip??`unknown`}function nt(e){let t=t=>{let n;for(let r of e.matchAll(t))n=Number.parseInt(r[1],10);return n},n=t(/"(?:prompt_tokens|input_tokens)"\s*:\s*(\d+)/g),r=t(/"(?:completion_tokens|output_tokens)"\s*:\s*(\d+)/g),i=t(/"total_tokens"\s*:\s*(\d+)/g);if(!(n===void 0&&r===void 0&&i===void 0))return i===void 0&&(i=(n??0)+(r??0)),{prompt:n??0,completion:r??0,total:i}}function rt(e,t){let n=Buffer.from(e),r=t.split(`,`).map(e=>e.trim()).filter(Boolean),i=(process.env.COPILOT_API_KEY_NAMES??``).split(`,`).map(e=>e.trim());for(let[e,t]of r.entries()){let r=Buffer.from(t);if(n.length===r.length&&p(n,r))return i[e]||`key${e+1}`}return!1}function it(e){let t=e.req.header(`authorization`);if(t){let e=/^Bearer\s+(.+)$/i.exec(t);if(e)return e[1].trim()}let n=e.req.header(`x-api-key`);if(n)return n.trim()}function at(){return async function(e,t){let{apiKey:n}=_;if(!n){await t();return}if(e.req.method===`OPTIONS`){await t();return}let r=it(e),i=r?rt(r,n):!1;if(!r||!i)return e.json({error:{message:`Unauthorized: invalid or missing API key`,type:`authentication_error`}},401);e.set(`keyId`,i),await t()}}function I(){return new Date().toISOString()}function ot(){return async function(e,t){let n=performance.now();await t();let r=(performance.now()-n).toFixed(1),i=e.req.method,a=e.req.path,o=e.res.status;console.log(`[${I()}] ${i} ${a} ${o} ${r}ms`)}}function L(e,t){console.error(`[${I()}] ${e}`,t)}const st=[`/chat/completions`,`/responses`,`/messages`,`/embeddings`];function ct(e){return st.some(t=>e===t||e.endsWith(t))}async function lt(e){if(e.req.method===`POST`)try{let t=await e.req.raw.clone().text();return/"model"\s*:\s*"([^"]+)"/.exec(t)?.[1]}catch{return}}async function ut(e,t){try{let n=e.getReader(),r=new TextDecoder,i=``,a=4e6;for(;;){let{done:e,value:t}=await n.read();if(e)break;i+=r.decode(t,{stream:!0}),i.length>a&&(i=i.slice(-a))}let o=nt(i);o&&(t.promptTokens=o.prompt,t.completionTokens=o.completion,t.totalTokens=o.total,F.addTokens(t,o))}catch{}}function dt(){return async function(e,t){if(!et(e.req.path))return F.noteDropped(),e.json({error:{message:`Not found`,type:`not_found`}},404);await t()}}function ft(){return async function(e,t){let n=performance.now(),r=tt(e),i=await lt(e);await t();let a={time:Date.now(),ip:r,method:e.req.method,path:e.req.path,model:i,status:e.res.status,keyId:e.get(`keyId`)||null,durationMs:Number((performance.now()-n).toFixed(1))};if(F.record(a),e.res.body&&ct(e.req.path))try{let[t,n]=e.res.body.tee();e.res=new Response(t,{status:e.res.status,headers:e.res.headers}),ut(n,a)}catch{}}}const R=new m;R.get(`/stats`,e=>e.json(F.snapshot(_.paused))),R.post(`/pause`,e=>(_.paused=!0,n.warn(`Service PAUSED via /admin/pause — proxy endpoints return 503`),e.json({paused:!0}))),R.post(`/resume`,e=>(_.paused=!1,n.info(`Service RESUMED via /admin/resume`),e.json({paused:!1}))),R.post(`/shutdown`,e=>(n.warn(`Shutdown requested via /admin/shutdown — exiting process`),setTimeout(()=>{F.save().finally(()=>process.exit(0))},100),e.json({shuttingDown:!0})));const z=async()=>{if(!await n.prompt(`Accept incoming request?`,{type:`confirm`}))throw new k(`Request rejected`,Response.json({message:`Request rejected`},{status:403}))};async function B(e){if(e.rateLimitSeconds===void 0)return;let t=Date.now();if(!e.lastRequestTimestamp){e.lastRequestTimestamp=t;return}let r=(t-e.lastRequestTimestamp)/1e3;if(r>e.rateLimitSeconds){e.lastRequestTimestamp=t;return}let i=Math.ceil(e.rateLimitSeconds-r);if(!e.rateLimitWait)throw n.warn(`Rate limit exceeded. Need to wait ${i} more seconds.`),new k(`Rate limit exceeded`,Response.json({message:`Rate limit exceeded`},{status:429}));let a=i*1e3;n.warn(`Rate limit reached. Waiting ${i} seconds before proceeding...`),await be(a),e.lastRequestTimestamp=t,n.info(`Rate limit wait completed, proceeding with request`)}const V={o200k_base:()=>import(`gpt-tokenizer/encoding/o200k_base`),cl100k_base:()=>import(`gpt-tokenizer/encoding/cl100k_base`),p50k_base:()=>import(`gpt-tokenizer/encoding/p50k_base`),p50k_edit:()=>import(`gpt-tokenizer/encoding/p50k_edit`),r50k_base:()=>import(`gpt-tokenizer/encoding/r50k_base`)},H=new Map,pt=(e,t,n)=>{let r=0;for(let i of e)r+=n.funcInit,r+=t.encode(JSON.stringify(i)).length;return r+=n.funcEnd,r},mt=(e,t)=>{let n=0;for(let r of e)r.type===`image_url`?n+=t.encode(r.image_url.url).length+85:r.text&&(n+=t.encode(r.text).length);return n},ht=(e,t,n)=>{let r=3;for(let[i,a]of Object.entries(e))typeof a==`string`&&(r+=t.encode(a).length),i===`name`&&(r+=1),i===`tool_calls`&&(r+=pt(a,t,n)),i===`content`&&Array.isArray(a)&&(r+=mt(a,t));return r},gt=(e,t,n)=>{if(e.length===0)return 0;let r=0;for(let i of e)r+=ht(i,t,n);return r+=3,r},_t=async e=>{if(H.has(e)){let t=H.get(e);if(t)return t}let t=e;if(!(t in V)){let t=await V.o200k_base();return H.set(e,t),t}let n=await V[t]();return H.set(e,n),n},vt=e=>e.capabilities.tokenizer||`o200k_base`,yt=e=>e.id===`gpt-3.5-turbo`||e.id===`gpt-4`?{funcInit:10,propInit:3,propKey:3,enumInit:-3,enumItem:3,funcEnd:12}:{funcInit:7,propInit:3,propKey:3,enumInit:-3,enumItem:3,funcEnd:12},bt=(e,t,n)=>{let{encoder:r,constants:i}=n,a=i.propKey;if(typeof t!=`object`||!t)return a;let o=t,s=e,c=o.type||`string`,l=o.description||``;if(o.enum&&Array.isArray(o.enum)){a+=i.enumInit;for(let e of o.enum)a+=i.enumItem,a+=r.encode(String(e)).length}l.endsWith(`.`)&&(l=l.slice(0,-1));let u=`${s}:${c}:${l}`;a+=r.encode(u).length;let d=new Set([`type`,`description`,`enum`]);for(let e of Object.keys(o))if(!d.has(e)){let t=o[e],n=typeof t==`string`?t:JSON.stringify(t);a+=r.encode(`${e}:${n}`).length}return a},xt=(e,t,n)=>{if(!e||typeof e!=`object`)return 0;let r=e,i=0;for(let[e,a]of Object.entries(r))if(e===`properties`){let e=a;if(Object.keys(e).length>0){i+=n.propInit;for(let r of Object.keys(e))i+=bt(r,e[r],{encoder:t,constants:n})}}else{let n=typeof a==`string`?a:JSON.stringify(a);i+=t.encode(`${e}:${n}`).length}return i},St=(e,t,n)=>{let r=n.funcInit,i=e.function,a=i.name,o=i.description||``;o.endsWith(`.`)&&(o=o.slice(0,-1));let s=a+`:`+o;return r+=t.encode(s).length,typeof i.parameters==`object`&&i.parameters!==null&&(r+=xt(i.parameters,t,n)),r},Ct=(e,t,n)=>{let r=0;for(let i of e)r+=St(i,t,n);return r+=n.funcEnd,r},wt=async(e,t)=>{let n=vt(t),r=await _t(n),i=e.messages,a=i.filter(e=>e.role!==`assistant`),o=i.filter(e=>e.role===`assistant`),s=yt(t),c=gt(a,r,s);e.tools&&e.tools.length>0&&(c+=Ct(e.tools,r,s));let l=gt(o,r,s);return{input:c,output:l}},Tt=async e=>{if(!_.copilotToken)throw Error(`Copilot token not found`);let t=e.messages.some(e=>typeof e.content!=`string`&&e.content?.some(e=>e.type===`image_url`)),r=e.messages.some(e=>[`assistant`,`tool`].includes(e.role)),i=()=>({...T(_,t),"X-Initiator":r?`agent`:`user`}),a=await fetch(`${w(_)}/chat/completions`,{method:`POST`,headers:i(),body:JSON.stringify(e)});if(a.status===401&&(n.warn(`Received 401, attempting to refresh token and retry`),await Ae(),a=await fetch(`${w(_)}/chat/completions`,{method:`POST`,headers:i(),body:JSON.stringify(e)})),!a.ok)throw n.error(`Failed to create chat completions`,a),new k(`Failed to create chat completions`,a);return e.stream?oe(a):await a.json()};async function Et(e){await B(_);let t=await e.req.json();n.debug(`Request payload:`,JSON.stringify(t).slice(-400));let r=_.models?.data.find(e=>e.id===t.model);try{if(r){let e=await wt(t,r);n.info(`Current token count:`,e)}else n.warn(`No model selected, skipping token count calculation`)}catch(e){n.warn(`Failed to calculate token count:`,e)}_.manualApprove&&await z(),xe(t.max_tokens)&&(t={...t,max_tokens:r?.capabilities.limits.max_output_tokens},n.debug(`Set max_tokens to:`,JSON.stringify(t.max_tokens)));let i=await Tt(t);return Dt(i)?(n.debug(`Non-streaming response:`,JSON.stringify(i)),e.json(i)):(n.debug(`Streaming response`),h(e,async e=>{for await(let t of i)n.debug(`Streaming chunk:`,JSON.stringify(t)),await e.writeSSE(t)}))}const Dt=e=>Object.hasOwn(e,`choices`),U=new m;U.post(`/`,async e=>{try{return await Et(e)}catch(t){return await A(e,t)}});const Ot=async e=>{if(!_.copilotToken)throw Error(`Copilot token not found`);let t=await fetch(`${w(_)}/embeddings`,{method:`POST`,headers:T(_),body:JSON.stringify(e)});if(!t.ok)throw new k(`Failed to create embeddings`,t);return await t.json()},W=new m;W.post(`/`,async e=>{try{let t=await e.req.json(),n=await Ot(t);return e.json(n)}catch(t){return await A(e,t)}});const kt=e=>`<!doctype html>
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
`,At=new m;At.get(`/`,e=>{let t=process.env.npm_package_version??g.version,n=_.githubLogin??`unknown`,r=_.accountType,i=e.req.query(`format`),a=e.req.header(`accept`)??``;if(i===`json`||a.includes(`application/json`))return e.json({version:t,login:n,accountType:r});if(i===`text`||!a.includes(`text/html`))return e.text(`Copilot API v${t} - running\nUser: ${n} (${r})`);let o=`<span class="text-xs px-2 py-0.5 rounded-full font-mono" style="background: var(--bg-hover); color: var(--fg-muted)">v${t}</span>`;return e.html(kt(o))});const jt=new Set([`connection`,`content-length`,`keep-alive`,`proxy-authenticate`,`proxy-authorization`,`te`,`trailer`,`transfer-encoding`,`upgrade`]);async function G({path:e,body:t,requestHeaders:r,forwardRequestHeaders:i,initiator:a,enableVision:o=!1,errorMessage:s,throwOnError:c=!1,signal:l,redirect:u}){if(!_.copilotToken)throw Error(`Copilot token not found`);let d=await f();if(d.status===401&&(await d.body?.cancel(),n.warn(`Received 401, attempting to refresh Copilot token and retry`),await Ae(),d=await f()),n.debug(`Passthrough response:`,{path:e,status:d.status,ok:d.ok}),!d.ok&&(n.error(s,d),c))throw new k(s,d);return d;async function f(){let s=Mt({requestHeaders:r,forwardRequestHeaders:i,initiator:a,enableVision:o});return n.debug(`Passthrough request:`,{method:`POST`,path:e,bodyLength:t.length}),fetch(`${w(_)}${e}`,{method:`POST`,headers:s,body:t,signal:l,redirect:u})}}function Mt({requestHeaders:e,forwardRequestHeaders:t=[],initiator:n,enableVision:r=!1}){let i={...T(_,r),"X-Initiator":n};if(!e)return i;for(let n of t){let t=e.get(n);t&&(i[n]=t)}return i}function K(e,t){let n=new Headers;if(t){for(let r of t){let t=e.get(r);t&&n.set(r,t)}return n}for(let[t,r]of e.entries())jt.has(t.toLowerCase())||n.set(t,r);return n}const Nt=[`accept`,`anthropic-beta`,`anthropic-version`],Pt=`context-1m-2025-08-07`,Ft=new Set([Pt]);function It(e){let t=e.get(`anthropic-beta`);return t?t.split(`,`).map(e=>e.trim()).includes(Pt):!1}function Lt(e){let t=e.get(`anthropic-beta`);if(!t)return e;let n=t.split(`,`).map(e=>e.trim()).filter(e=>!Ft.has(e)).join(`,`),r=new Headers(e);return n?r.set(`anthropic-beta`,n):r.delete(`anthropic-beta`),r}function Rt(e){let t={modified:!1};try{let n=JSON.parse(e,(e,n)=>{if(e===`cache_control`&&typeof n==`object`&&n&&!Array.isArray(n)){let e=n,r=Object.keys(e);if(r.length>1||r.length===1&&!r.includes(`type`))return t.modified=!0,{type:e.type}}return n});return t.modified?JSON.stringify(n):e}catch{return e}}async function zt(e,t,r=`/v1/messages`){n.debug(`Original request headers: ${JSON.stringify([...t])}`);let i=t;return It(t)&&(n.debug(`Request includes unsupported beta features. Stripping unsupported beta flags and fields.`),i=Lt(t)),G({path:r,body:Rt(e),requestHeaders:i,forwardRequestHeaders:Nt,initiator:`user`,errorMessage:`Upstream ${r} request failed`})}function Bt(e){return Ht(e)?.model?.startsWith(`claude`)??!1}function Vt(e){return K(e)}function Ht(e){try{return JSON.parse(e)}catch{return}}function Ut(e){return e===null?null:{stop:`end_turn`,length:`max_tokens`,tool_calls:`tool_use`,content_filter:`end_turn`}[e]}function Wt(e){return{model:Gt(e.model),messages:Kt(e.messages,e.system),max_tokens:e.max_tokens,stop:e.stop_sequences,stream:e.stream,temperature:e.temperature,top_p:e.top_p,user:e.metadata?.user_id,tools:Xt(e.tools),tool_choice:Zt(e.tool_choice)}}function Gt(e){return e.startsWith(`claude-sonnet-4-`)?e.replace(/^claude-sonnet-4-.*/,`claude-sonnet-4`):e.startsWith(`claude-opus-`)?e.replace(/^claude-opus-4-.*/,`claude-opus-4`):e}function Kt(e,t){let n=qt(t),r=e.flatMap(e=>e.role===`user`?Jt(e):Yt(e));return[...n,...r]}function qt(e){if(!e)return[];if(typeof e==`string`)return[{role:`system`,content:e}];let t=e;return Array.isArray(e)&&(t=e.filter(e=>!e.text.includes(`x-anthropic-billing-header:`))),[{role:`system`,content:t.map(e=>e.text).join(`

`)}]}function Jt(e){let t=[];if(Array.isArray(e.content)){let n=e.content.filter(e=>e.type===`tool_result`),r=e.content.filter(e=>e.type!==`tool_result`);for(let e of n)t.push({role:`tool`,tool_call_id:e.tool_use_id,content:q(e.content)});r.length>0&&t.push({role:`user`,content:q(r)})}else t.push({role:`user`,content:q(e.content)});return t}function Yt(e){if(!Array.isArray(e.content))return[{role:`assistant`,content:q(e.content)}];let t=e.content.filter(e=>e.type===`tool_use`),n=e.content.filter(e=>e.type===`text`),r=e.content.filter(e=>e.type===`thinking`),i=[...n.map(e=>e.text),...r.map(e=>e.thinking)].join(`

`);return t.length>0?[{role:`assistant`,content:i||null,tool_calls:t.map(e=>({id:e.id,type:`function`,function:{name:e.name,arguments:JSON.stringify(e.input)}}))}]:[{role:`assistant`,content:q(e.content)}]}function q(e){if(typeof e==`string`)return e;if(!Array.isArray(e))return null;if(!e.some(e=>e.type===`image`))return e.filter(e=>e.type===`text`||e.type===`thinking`).map(e=>e.type===`text`?e.text:e.thinking).join(`

`);let t=[];for(let n of e)switch(n.type){case`text`:t.push({type:`text`,text:n.text});break;case`thinking`:t.push({type:`text`,text:n.thinking});break;case`image`:t.push({type:`image_url`,image_url:{url:`data:${n.source.media_type};base64,${n.source.data}`}});break}return t}function Xt(e){if(e)return e.map(e=>({type:`function`,function:{name:e.name,description:e.description,parameters:e.input_schema}}))}function Zt(e){if(e)switch(e.type){case`auto`:return`auto`;case`any`:return`required`;case`tool`:return e.name?{type:`function`,function:{name:e.name}}:void 0;case`none`:return`none`;default:return}}function Qt(e){let t=[],n=[],r=null;r=e.choices[0]?.finish_reason??r;for(let i of e.choices){let e=$t(i.message.content),a=en(i.message.tool_calls);t.push(...e),n.push(...a),(i.finish_reason===`tool_calls`||r===`stop`)&&(r=i.finish_reason)}return{id:e.id,type:`message`,role:`assistant`,model:e.model,content:[...t,...n],stop_reason:Ut(r),stop_sequence:null,usage:{input_tokens:(e.usage?.prompt_tokens??0)-(e.usage?.prompt_tokens_details?.cached_tokens??0),output_tokens:e.usage?.completion_tokens??0,...e.usage?.prompt_tokens_details?.cached_tokens!==void 0&&{cache_read_input_tokens:e.usage.prompt_tokens_details.cached_tokens}}}}function $t(e){return typeof e==`string`?[{type:`text`,text:e}]:Array.isArray(e)?e.filter(e=>e.type===`text`).map(e=>({type:`text`,text:e.text})):[]}function en(e){return e?e.map(e=>({type:`tool_use`,id:e.id,name:e.function.name,input:JSON.parse(e.function.arguments)})):[]}async function tn(e){try{let t=await e.req.text();if(n.debug(`Anthropic count_tokens payload:`,t.slice(0,1e3)),Bt(t)){let n=await zt(t,e.req.raw.headers,`/v1/messages/count_tokens`);return new Response(n.body,{status:n.status,headers:Vt(n.headers)})}let r=e.req.header(`anthropic-beta`),i=JSON.parse(t),a=Wt(i),o=_.models?.data.find(e=>e.id===i.model);if(!o)return n.warn(`Model not found, returning default token count`),e.json({input_tokens:1});let s=await wt(a,o);if(i.tools&&i.tools.length>0){let e=!1;r?.startsWith(`claude-code`)&&(e=i.tools.some(e=>e.name.startsWith(`mcp__`))),e||(i.model.startsWith(`claude`)?s.input+=346:i.model.startsWith(`grok`)&&(s.input+=480))}let c=s.input+s.output;return i.model.startsWith(`claude`)?c=Math.round(c*1.15):i.model.startsWith(`grok`)&&(c=Math.round(c*1.03)),n.info(`Token count:`,c),e.json({input_tokens:c})}catch(t){return n.error(`Error counting tokens:`,t),e.json({input_tokens:1})}}function nn(e){return e.contentBlockOpen?Object.values(e.toolCalls).some(t=>t.anthropicBlockIndex===e.contentBlockIndex):!1}function rn(e,t){let n=[];if(e.choices.length===0)return n;let r=e.choices[0],{delta:i}=r;if(t.messageStartSent||=(n.push({type:`message_start`,message:{id:e.id,type:`message`,role:`assistant`,content:[],model:e.model,stop_reason:null,stop_sequence:null,usage:{input_tokens:(e.usage?.prompt_tokens??0)-(e.usage?.prompt_tokens_details?.cached_tokens??0),output_tokens:0,...e.usage?.prompt_tokens_details?.cached_tokens!==void 0&&{cache_read_input_tokens:e.usage.prompt_tokens_details.cached_tokens}}}}),!0),i.content&&(nn(t)&&(n.push({type:`content_block_stop`,index:t.contentBlockIndex}),t.contentBlockIndex++,t.contentBlockOpen=!1),t.contentBlockOpen||=(n.push({type:`content_block_start`,index:t.contentBlockIndex,content_block:{type:`text`,text:``}}),!0),n.push({type:`content_block_delta`,index:t.contentBlockIndex,delta:{type:`text_delta`,text:i.content}})),i.tool_calls)for(let e of i.tool_calls){if(e.id&&e.function?.name){t.contentBlockOpen&&=(n.push({type:`content_block_stop`,index:t.contentBlockIndex}),t.contentBlockIndex++,!1);let r=t.contentBlockIndex;t.toolCalls[e.index]={id:e.id,name:e.function.name,anthropicBlockIndex:r},n.push({type:`content_block_start`,index:r,content_block:{type:`tool_use`,id:e.id,name:e.function.name,input:{}}}),t.contentBlockOpen=!0}if(e.function?.arguments){let r=t.toolCalls[e.index];r&&n.push({type:`content_block_delta`,index:r.anthropicBlockIndex,delta:{type:`input_json_delta`,partial_json:e.function.arguments}})}}return r.finish_reason&&(t.contentBlockOpen&&=(n.push({type:`content_block_stop`,index:t.contentBlockIndex}),!1),n.push({type:`message_delta`,delta:{stop_reason:Ut(r.finish_reason),stop_sequence:null},usage:{input_tokens:(e.usage?.prompt_tokens??0)-(e.usage?.prompt_tokens_details?.cached_tokens??0),output_tokens:e.usage?.completion_tokens??0,...e.usage?.prompt_tokens_details?.cached_tokens!==void 0&&{cache_read_input_tokens:e.usage.prompt_tokens_details.cached_tokens}}},{type:`message_stop`})),n}async function an(e){await B(_);let t=await e.req.text();if(n.debug(`Anthropic request payload:`,t.slice(0,1e3)),Bt(t)){_.manualApprove&&await z();let n=await zt(t,e.req.raw.headers);return new Response(n.body,{status:n.status,headers:Vt(n.headers)})}let r=JSON.parse(t);n.debug(`Anthropic request payload:`,JSON.stringify(r));let i=Wt(r);n.debug(`Translated OpenAI request payload:`,JSON.stringify(i)),_.manualApprove&&await z();let a=await Tt(i);if(on(a)){n.debug(`Non-streaming response from Copilot:`,JSON.stringify(a).slice(-400));let t=Qt(a);return n.debug(`Translated Anthropic response:`,JSON.stringify(t)),e.json(t)}return n.debug(`Streaming response from Copilot`),h(e,async e=>{let t={messageStartSent:!1,contentBlockIndex:0,contentBlockOpen:!1,toolCalls:{}};for await(let r of a){if(n.debug(`Copilot raw stream event:`,JSON.stringify(r)),r.data===`[DONE]`)break;if(!r.data)continue;let i=JSON.parse(r.data),a=rn(i,t);for(let t of a)n.debug(`Translated Anthropic event:`,JSON.stringify(t)),await e.writeSSE({event:t.type,data:JSON.stringify(t)})}})}const on=e=>Object.hasOwn(e,`choices`),J=new m;J.post(`/`,async e=>{try{return await an(e)}catch(t){return await A(e,t)}}),J.post(`/count_tokens`,async e=>{try{return await tn(e)}catch(t){return await A(e,t)}});const Y=new m;Y.get(`/`,async e=>{try{try{await Se()}catch(e){if(!_.models)throw e;n.warn(`Failed to refresh models, serving cached copy`,e)}let t=_.models?.data.map(e=>({id:e.id,object:`model`,type:`model`,created:0,created_at:new Date(0).toISOString(),owned_by:e.vendor,display_name:e.name}));return e.json({object:`list`,data:t,has_more:!1})}catch(t){return await A(e,t)}});const sn=64*1024;var cn=class{chunks=[];reader;pending;ended=!1;failed=!1;failure;text=``;bytes=0;decoder=new TextDecoder;constructor(e){this.reader=e.getReader()}inspect(e){if(this.chunks.push(e),this.bytes+=e.byteLength,this.bytes>sn)return`pass`;for(this.text+=this.decoder.decode(e,{stream:!0});;){let e=/\r?\n\r?\n/.exec(this.text);if(!e)return`wait`;let t=this.text.slice(0,e.index);this.text=this.text.slice(e.index+e[0].length);let n=t.split(/\r?\n/).filter(e=>e.startsWith(`data:`)).map(e=>e.slice(5).replace(/^ /,``)).join(`
`);if(!n)continue;let r=ln(n);if(r!==`wait`)return r}}replay(e){let t=0;return new Response(new ReadableStream({pull:async e=>{try{if(t<this.chunks.length){e.enqueue(this.chunks[t++]);return}if(this.failed){e.error(this.failure),this.reader.releaseLock();return}if(this.ended){e.close(),this.reader.releaseLock();return}let n=await(this.pending??this.reader.read());this.pending=void 0,n.done?(e.close(),this.reader.releaseLock()):e.enqueue(n.value)}catch(t){e.error(t),this.reader.releaseLock()}},cancel:async e=>{await this.reader.cancel(e),this.reader.releaseLock()}},{highWaterMark:0}),{status:e.status,headers:e.headers})}};function ln(e){let t;try{t=JSON.parse(e)}catch{return`pass`}return!t||typeof t!=`object`||!(`type`in t)?`pass`:t.type===`error`&&`code`in t&&t.code===`invalid_request_body`&&`message`in t&&typeof t.message==`string`?{code:t.code,message:t.message}:[`response.created`,`response.failed`,`response.queued`].includes(String(t.type))?`wait`:`pass`}async function un(e,t=500){if(e.status!==200||!e.body||e.headers.get(`content-type`)?.split(`;`,1)[0].trim().toLowerCase()!==`text/event-stream`)return e;let n=new cn(e.body),r,i=new Promise(e=>{r=setTimeout(()=>e(void 0),t)});try{for(;n.bytes<sn;){n.pending=n.reader.read();let t=await Promise.race([n.pending,i]);if(!t)break;if(n.pending=void 0,t.done){n.ended=!0;break}let r=n.inspect(t.value);if(r===`pass`)break;if(r===`wait`)continue;n.reader.cancel(`Upstream rejected the request before generation`).catch(()=>{});let a=new Headers(e.headers);return a.set(`content-type`,`application/json`),a.delete(`content-length`),a.delete(`content-encoding`),new Response(JSON.stringify({error:{...r,type:`invalid_request_error`}}),{status:400,headers:a})}return n.replay(e)}catch(t){return n.failed=!0,n.failure=t,n.pending=void 0,n.replay(e)}finally{clearTimeout(r)}}const dn=new Set(`created,queued,in_progress,completed,failed,incomplete,output_item.added,output_item.done,content_part.added,content_part.done,output_text.delta,output_text.done,output_text.annotation.added,refusal.delta,refusal.done,function_call_arguments.delta,function_call_arguments.done,reasoning_summary_part.added,reasoning_summary_part.done,reasoning_summary_text.delta,reasoning_summary_text.done,reasoning_text.delta,reasoning_text.done,custom_tool_call_input.delta,custom_tool_call_input.done,file_search_call.in_progress,file_search_call.searching,file_search_call.completed,web_search_call.in_progress,web_search_call.searching,web_search_call.completed,code_interpreter_call.in_progress,code_interpreter_call.interpreting,code_interpreter_call.completed,code_interpreter_call_code.delta,code_interpreter_call_code.done,image_generation_call.in_progress,image_generation_call.generating,image_generation_call.completed,image_generation_call.partial_image,mcp_call_arguments.delta,mcp_call_arguments.done,mcp_call.in_progress,mcp_call.completed,mcp_call.failed,mcp_list_tools.in_progress,mcp_list_tools.completed,mcp_list_tools.failed,audio.delta,audio.done,audio_transcript.delta,audio_transcript.done`.split(`,`).map(e=>`response.${e}`));function fn(e){let t=new TextDecoder(`utf-8`,{fatal:!0,ignoreBOM:!0}),n=new TextEncoder,r=[],i=0,a=0,o,s=!0,c,l=new Map;function u(e){let t=e.match(/[^\n]*\n/g)??[],n=[];t.forEach((e,t)=>{let r=/^data:( ?)([\s\S]*?)(\r?\n)$/.exec(e);r&&n.push({index:t,value:r[2],prefix:`data:${r[1]}`,eol:r[3]})});let r;try{r=JSON.parse(n.map(e=>e.value).join(`
`))}catch{return e}if(!r||typeof r!=`object`||Array.isArray(r))return e;let i=t.filter(e=>e.startsWith(`event:`)).at(-1)?.replace(/^event: ?/,``).replace(/\r?\n$/,``),a=r.type??i;if(!dn.has(a)||i&&i!==`message`&&i!==a)return e;let o=n.map(e=>e.value).join(`
`),s=[],u=[];for(let e of o.matchAll(/"(?:\\[\s\S]|[^"\\])*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g)){let t=e[0],n=u.at(-1);if(t===`:`)continue;if(t===`,`){n?.kind===`object`&&(n.keyNext=!0);continue}if(t===`}`||t===`]`){u.pop();continue}if(n?.kind===`object`&&n.keyNext){n.key=JSON.parse(t),n.keyNext=!1;continue}let i=n?n.path===null?null:[...n.path,n.kind===`object`?n.key:n.index++]:[];if(t===`{`||t===`[`){u.push({kind:t===`{`?`object`:`array`,path:i&&i.length<=4?i:null,keyNext:t===`{`,index:0});continue}if(!i||t[0]!==`"`)continue;let o=JSON.parse(t);if(!o)continue;let d;if(i.length===1&&i[0]===`response_id`||i.length===2&&i[0]===`response`&&i[1]===`id`)c??=o,d=c;else{let e;if(Number.isSafeInteger(r.output_index)&&r.output_index>=0&&(i.length===1&&i[0]===`item_id`||i.length===2&&i[0]===`item`&&i[1]===`id`&&(a===`response.output_item.added`||a===`response.output_item.done`))&&(e=r.output_index),i.length===4&&i[0]===`response`&&i[1]===`output`&&typeof i[2]==`number`&&i[3]===`id`&&(e=i[2]),e===void 0)continue;l.has(e)||l.set(e,o),d=l.get(e)}o!==d&&s.push({start:e.index,end:e.index+t.length,value:JSON.stringify(d)})}if(!s.length)return e;let d=o;for(let e of s.reverse())d=d.slice(0,e.start)+e.value+d.slice(e.end);let f=d.split(`
`);for(let[e,r]of n.entries())t[r.index]=`${r.prefix}${f[e]}${r.eol}`;return t.join(``)}function d(e){e.length&&(r.push(e),i+=e.length)}function f(){let e=new Uint8Array(i),t=0;for(let n of r)e.set(n,t),t+=n.length;return r=[],i=0,e}function p(e){let r=f(),i=s;s=!1;let a;try{a=t.decode(r)}catch{e.enqueue(r);return}let o=i&&a.startsWith(`﻿`)?`﻿`:``,c=o+u(a.slice(o.length));e.enqueue(c===a?r:n.encode(c))}return e.pipeThrough(new TransformStream({transform(e,t){let n=0;for(let r=0;r<e.length;r++){let i=e[r];if(i===10){let i=a===0||a===1&&o===13;a=0,i&&(d(e.subarray(n,r+1)),p(t),n=r+1)}else a++;o=i}d(new Uint8Array(e.subarray(n)))},flush(e){i&&e.enqueue(f())}}))}function pn(e,t,n=!0){if(!n||e.status!==200||!e.body||!e.headers.get(`content-type`)?.toLowerCase().includes(`text/event-stream`))return e.body;let r;try{r=JSON.parse(t)}catch{return e.body}return r?.model!==`gpt-6-astra`||r?.stream!==!0?e.body:fn(e.body)}const mn=[`content-type`,`cache-control`,`x-request-id`];function hn(e){return X(e)?.model?.startsWith(`gpt`)??!1}function X(e){try{return JSON.parse(e)}catch{return}}const gn=async(e,t)=>{let n=_n(e);return G({path:`/responses`,body:n,requestHeaders:t,initiator:`user`,errorMessage:`Failed to create responses`,throwOnError:!0})};function _n(e){let t=X(e);if(!t?.tools||!Array.isArray(t.tools))return e;let n=new Set([`image_generation`]),r=t.tools.filter(e=>!n.has(e.type??``));return r.length===t.tools.length?e:(t.tools=r,JSON.stringify(t))}function vn(e){return K(e,mn)}async function yn(e){await B(_);let t=await e.req.text();if(!hn(t))return e.json({error:{message:`Responses API is only enabled for GPT models.`,type:`invalid_request_error`}},400);_.manualApprove&&await z();let n=await un(await gn(t,e.req.raw.headers));return new Response(pn(n,t,process.env.EDGE_STABLE_IDS!==`0`),{status:n.status,headers:vn(n.headers)})}const Z=new m;Z.post(`/`,async e=>{try{return await yn(e)}catch(t){return await A(e,t)}});function bn(e){let t=e.runtime?.node?.res;if(!t)return e.signal;let n=new AbortController;return t.once(`close`,()=>{t.writableFinished||n.abort()}),t.destroyed&&!t.writableFinished&&n.abort(),n.signal}const Q=new m;Q.post(`/`,async e=>{try{await B(_);let t=await e.req.text();_.manualApprove&&await z();let n=await G({path:`/v1/systemone`,body:t,requestHeaders:e.req.raw.headers,forwardRequestHeaders:[`content-type`,`accept`],initiator:`user`,errorMessage:`SystemOne request failed`,signal:bn(e.req.raw),redirect:`error`});return new Response(n.body,{status:n.status,headers:K(n.headers,[`content-type`,`cache-control`,`x-request-id`,`x-github-request-id`,`retry-after`])})}catch(t){return await A(e,t)}});const xn=new m;xn.get(`/`,e=>{try{return e.json({token:_.copilotToken})}catch(t){return L(`Error fetching token:`,t),e.json({error:`Failed to fetch token`,token:null},500)}});const Sn=new m;Sn.get(`/`,async e=>{try{let t=await Fe();return e.json(t)}catch(t){return L(`Error fetching Copilot usage:`,t),e.json({error:`Failed to fetch Copilot usage`},500)}});const $=new m;$.use(ot()),$.use(ae()),$.use(dt()),$.use(ft()),$.use(at()),$.use(async(e,t)=>{if(_.paused&&!e.req.path.startsWith(`/admin`))return e.json({error:{message:`Service is paused by administrator`,type:`service_paused`}},503);await t()}),$.route(`/admin`,R),$.route(`/`,At),$.route(`/chat/completions`,U),$.route(`/models`,Y),$.route(`/embeddings`,W),$.route(`/responses`,Z),$.route(`/systemone`,Q),$.route(`/usage`,Sn),$.route(`/token`,xn),$.route(`/v1/chat/completions`,U),$.route(`/v1/models`,Y),$.route(`/v1/embeddings`,W),$.route(`/v1/responses`,Z),$.route(`/v1/systemone`,Q),$.route(`/v1/messages`,J);async function Cn(e){y(e),e.proxyEnv&&Qe(),e.verbose&&(n.level=5,n.info(`Verbose logging enabled`)),_.accountType=e.accountType,e.accountType!==`individual`&&n.info(`Using ${e.accountType} plan GitHub account`),_.manualApprove=e.manual,_.rateLimitSeconds=e.rateLimit,_.rateLimitWait=e.rateLimitWait,_.showToken=e.showToken,_.apiKey=e.apiKey,e.apiKey?n.info(`API key authentication enabled for incoming requests`):n.warn(`No API key set — incoming requests are unauthenticated. Set --api-key or COPILOT_API_KEY before exposing publicly.`),await x(),await F.load(),await Ce(),e.githubToken?(_.githubToken=e.githubToken,n.info(`Using provided GitHub token`)):await M(),await je(),await Se(),n.info(`Available models: \n${_.models?.data.map(e=>`- ${e.id}`).join(`
`)}`);let t=`http://localhost:${e.port}`;n.box(`🌐 Usage Viewer: https://billxc.github.io/copilot-api?endpoint=${t}/usage`);let r=setInterval(()=>void F.save(),3e4);typeof r.unref==`function`&&r.unref();let i=()=>{F.save().finally(()=>process.exit(0))};process.on(`SIGINT`,i),process.on(`SIGTERM`,i),ee({fetch:$.fetch,port:e.port,hostname:e.host,idleTimeout:255})}const wn=e({meta:{name:`start`,description:`Start the Copilot API server`},args:{...v,host:{type:`string`,description:`Listen address (use 127.0.0.1 behind a local reverse proxy)`},port:{alias:`p`,type:`string`,default:`4141`,description:`Port to listen on`},verbose:{alias:`v`,type:`boolean`,default:!1,description:`Enable verbose logging`},"account-type":{alias:`a`,type:`string`,default:`individual`,description:`Account type to use (individual, business, enterprise)`},manual:{type:`boolean`,default:!1,description:`Enable manual request approval`},"rate-limit":{alias:`r`,type:`string`,description:`Rate limit in seconds between requests`},wait:{alias:`w`,type:`boolean`,default:!1,description:`Wait instead of error when rate limit is hit. Has no effect if rate limit is not set`},"github-token":{alias:`g`,type:`string`,description:"Provide GitHub token directly (must be generated using the `auth` subcommand)"},"show-token":{type:`boolean`,default:!1,description:`Show GitHub and Copilot tokens on fetch and refresh`},"proxy-env":{type:`boolean`,default:!1,description:`Initialize proxy from environment variables`},"api-key":{alias:`k`,type:`string`,description:`Require this key (Bearer token or x-api-key header) on incoming requests. Defaults to COPILOT_API_KEY env var`}},run({args:e}){let t=e[`rate-limit`],n=t===void 0?void 0:Number.parseInt(t,10);return Cn({port:Number.parseInt(e.port,10),host:e.host,githubHost:e[`github-host`],dataDir:e[`data-dir`],verbose:e.verbose,accountType:e[`account-type`],manual:e.manual,rateLimit:n,rateLimitWait:e.wait,githubToken:e[`github-token`],showToken:e[`show-token`],proxyEnv:e[`proxy-env`],apiKey:e[`api-key`]??process.env.COPILOT_API_KEY})}}),Tn=e({meta:{name:`xc-copilot-api`,version:g.version,description:`A wrapper around GitHub Copilot API to make it OpenAI compatible, making it usable for other tools.`},args:{version:{type:`boolean`,alias:`V`,description:`Show version number`}},run({args:e}){e.version&&(console.log(g.version),process.exit(0))},subCommands:{auth:Pe,start:wn,config:Ue,"check-usage":Ie,debug:Ze}});await t(Tn);export{};
//# sourceMappingURL=main.js.map