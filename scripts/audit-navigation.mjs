import { chromium } from 'file:///C:/Users/ra654/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const target=new URL(process.argv[2]);
if(target.origin!=='https://trayl-ten.vercel.app'||!/^\/chat\/[0-9a-f-]{36}$/.test(target.pathname))throw Error('Pass the accepted chat URL');
const browser=await chromium.connectOverCDP('http://127.0.0.1:9223');
const page=await browser.contexts()[0].newPage();const events=[],errors=[];let searchApiCalls=0;
page.on('pageerror',e=>errors.push(e.message));
page.on('request',r=>{if(r.url().includes('/api/journeys/search'))searchApiCalls++});
page.on('websocket',socket=>socket.on('framesent',frame=>{
 try {const data=JSON.parse(String(frame.payload));const topic=Array.isArray(data)?data[2]:data.topic;const event=Array.isArray(data)?data[3]:data.event;
 if(['phx_join','phx_leave'].includes(event))events.push({topic,kind:topic?.includes('chat:')?'chat':topic?.includes('inbox:')?'inbox':'other',event});}catch{}
}));
try {
 await page.goto(target.href,{waitUntil:'networkidle'});await page.getByRole('textbox',{name:/message/i}).first().waitFor({timeout:30000});
 await page.waitForTimeout(1800);assert.equal(new Set(events.filter(e=>e.kind==='chat'&&e.event==='phx_join').map(e=>e.topic)).size,1);
 await page.getByRole('link',{name:'Back to messages'}).click();await page.waitForURL('**/messages');await page.waitForTimeout(1000);
 assert.equal(events.filter(e=>e.kind==='chat'&&e.event==='phx_leave').length,1);
 const nav=page.getByRole('navigation',{name:'Main navigation'});
 await nav.getByRole('link',{name:'Dashboard',exact:true}).click();await page.waitForURL('**/dashboard');await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
 await page.getByRole('tab',{name:'Requests Received'}).click();assert.equal(await page.getByText('Something went wrong',{exact:true}).count(),0);
 await nav.getByRole('link',{name:'Search',exact:true}).click();await page.waitForURL('**/search');
 await page.getByLabel('From city',{exact:true}).fill('Jaipur');await page.waitForTimeout(500);
 assert.equal(searchApiCalls,0,'Typing must not query');
 await page.getByRole('button',{name:'Search journeys',exact:true}).click();await page.waitForURL(/from=Jaipur/);await page.waitForTimeout(1500);
 assert.equal(searchApiCalls,0,'Server navigation already supplies search data; no duplicate browser fetch');
 assert.equal(events.filter(e=>e.kind==='inbox'&&e.event==='phx_join').length,1,'Inbox channel should survive client navigation');
 assert.deepEqual(errors,[]);
 const result={distinctChatTopics:1,chatJoinAttempts:events.filter(e=>e.kind==='chat'&&e.event==='phx_join').length,chatLeaves:1,inboxJoins:1,searchApiCalls,browserErrors:errors,passed:true};
 await writeFile('performance/navigation-check.json',JSON.stringify(result,null,2));console.log(result);
} catch (error) { console.error(error.message); process.exitCode=1; } finally {await page.close();process.exit(process.exitCode || 0);}
