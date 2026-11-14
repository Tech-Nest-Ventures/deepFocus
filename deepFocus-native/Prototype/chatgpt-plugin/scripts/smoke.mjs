import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const url=new URL(process.env.MCP_URL||'http://127.0.0.1:8787/mcp');
const client=new Client({name:'deep-focus-smoke',version:'0.1.0'});
await client.connect(new StreamableHTTPClientTransport(url));
try {
  const tools=await client.listTools();assert.equal(tools.tools.length,6);
  const started=await client.callTool({name:'start_sample_day',arguments:{}});
  const id=started.structuredContent.demoId;assert.equal(started.structuredContent.sampleOnly,true);
  const shown=await client.callTool({name:'show_sample_day',arguments:{demoId:id}});assert.equal(shown.structuredContent.confirmedElapsedMinutes,145);
  const resource=await client.readResource({uri:'ui://deep-focus/sample-day-v1.html'});
  assert.match(resource.contents[0].mimeType,/mcp-app/);assert.match(resource.contents[0].text,/Deep Focus/);
  const corrected=await client.callTool({name:'correct_sample_activity',arguments:{demoId:id,expectedRevision:0,activityId:'call',start:'18:15',end:'18:35',activities:['Walking','Phone call'],place:'Outside',status:'confirmed'}});
  assert.equal(corrected.structuredContent.revision,1);
  const preview=await client.callTool({name:'preview_sample_calendar_update',arguments:{demoId:id,expectedRevision:1}});
  assert.equal(preview.structuredContent.simulatedCalendar.start,'17:00');
  const confirmed=await client.callTool({name:'confirm_sample_calendar_update',arguments:{demoId:id,previewToken:preview.structuredContent.preview.previewToken,userConfirmed:true}});
  assert.equal(confirmed.structuredContent.simulatedCalendar.start,'17:20');
  const invalid=await client.callTool({name:'correct_sample_activity',arguments:{demoId:id,expectedRevision:0,activityId:'call',start:'18:15',end:'18:35',activities:['Walking'],place:'Outside',status:'confirmed'}});
  assert.equal(invalid.isError,true);
  console.log('PASS: real MCP initialization, 6 tools, structured results, UI resource, correction, preview, confirmation, stale rejection.');
}finally{await client.close();}
