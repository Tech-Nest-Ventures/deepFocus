import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { schemas } from './day.mjs';

export const RESOURCE='ui://deep-focus/sample-day-v1.html';
export const descriptions={
  start_sample_day:'Start or reset a fictional Deep Focus day (Saturday November 14, 2026). Returns a new independent demoId. No real data is connected. Reuse this ID for follow-ups; do not start over unless requested. Then call show_sample_day to display the timeline.',
  get_sample_day:'Read the current fictional day, revision, activity corrections, original calendar intention, and visit evidence. Use before follow-up edits. All times are local America/New_York on the sample date; never infer purpose from location.',
  show_sample_day:'Display the Direction 2 Day in Places timeline for an existing demoId from start_sample_day. Use after starting or correcting the sample. Results also work as text when the host cannot render UI.',
  correct_sample_activity:'Correct one fictional sample activity only when the user supplies a correction. Supports simultaneous activities (e.g. Walking and Phone call), times, place, or unknown. Use latest revision; do not guess unclear times. Preserves visit evidence and original plan. This does not update even the simulated calendar; preview and confirm that separately.',
  preview_sample_calendar_update:'Preview replacing the fictional original workout event with the confirmed workout entry. Returns before/after, unchanged original plan, and a previewToken valid for 10 minutes. Show these details and ask for confirmation before calling confirm_sample_calendar_update. No real calendar access.',
  confirm_sample_calendar_update:'Apply the already-reviewed preview to the fictional calendar only after the user explicitly confirms that preview. Pass its previewToken and userConfirmed true. Never call from mere intent to review or correct an activity. Report simulated update, never a real calendar update.',
};
export function resultFor(store,name,args) {
  try {
    const day=store.run(name,args);
    return { structuredContent:day, content:[{type:'text',text:JSON.stringify(day)}] };
  } catch(error) {
    return {isError:true,content:[{type:'text',text:error instanceof z.ZodError ? 'Invalid sample input. Use the advertised IDs, choices, revision, and HH:mm times. Do not send real data.' : error.message}]};
  }
}
export function createServer(store,html) {
  const server=new McpServer({name:'deep-focus-sample-day',version:'0.1.0'}, {instructions:
    'FICTIONAL DATA ONLY. Start a sample once, then reuse demoId. Show its timeline. Keep intention, visit estimates, and sample confirmations distinct. Ask one useful question at a time; accept unknown. Correct activities only from the user. Preview calendar changes and get explicit confirmation before applying simulations. Never use other plugins or real calendar/location data for this demo. No proactive notifications or automatic daily chats.'});
  server.registerResource('sample-day',RESOURCE,{mimeType:'text/html;profile=mcp-app'},async()=>({contents:[{uri:RESOURCE,mimeType:'text/html;profile=mcp-app',text:html,
    _meta:{ui:{prefersBorder:true,csp:{connectDomains:[],resourceDomains:[]}},'openai/widgetDescription':'Fictional daily timeline with place evidence, editable activities, and simulated calendar review. No real data.', 'openai/widgetPrefersBorder':true,'openai/widgetCSP':{connect_domains:[],resource_domains:[]}}}]}));
  for(const [name,schema] of Object.entries(schemas)) server.registerTool(name,{
    title:name.split('_').join(' '),description:descriptions[name],inputSchema:schema,
    outputSchema:z.object({demoId:z.string().uuid(),revision:z.number(),sampleOnly:z.literal(true)}).passthrough(),
    annotations:{readOnlyHint:['get_sample_day','show_sample_day','preview_sample_calendar_update'].includes(name),destructiveHint:false,openWorldHint:false,
      idempotentHint:name!=='start_sample_day'&&name!=='correct_sample_activity'},
    _meta:{ui:{...(name==='show_sample_day'?{resourceUri:RESOURCE}:{}),visibility:['model','app']},
      ...(name==='show_sample_day'?{'openai/outputTemplate':RESOURCE}:{}),'openai/widgetAccessible':true},
  },async args=>resultFor(store,name,args));
  return server;
}
