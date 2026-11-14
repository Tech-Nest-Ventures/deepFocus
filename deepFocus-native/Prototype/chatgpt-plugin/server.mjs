import express from 'express';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { DemoStore } from './src/day.mjs';
import { createServer, resultFor } from './src/mcp.mjs';

export function createHttpApp(html, {store=new DemoStore(),publicOrigin=process.env.PUBLIC_ORIGIN,port=8787}={}) {
  const app=express(); app.disable('x-powered-by');
  const allowed=new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
  if(publicOrigin) { const u=new URL(publicOrigin); if(u.protocol!=='https:') throw new Error('PUBLIC_ORIGIN must use HTTPS'); allowed.add(u.origin); }
  const hosts=new Set([...allowed].map(origin=>new URL(origin).host));
  app.use((req,res,next)=>{
    res.set('Cache-Control','no-store'); res.set('X-Content-Type-Options','nosniff'); res.set('Referrer-Policy','no-referrer');
    if(!hosts.has(req.headers.host)) return res.status(403).json({error:'Host not allowed'});
    if(req.headers.origin&&!allowed.has(req.headers.origin)) return res.status(403).json({error:'Origin not allowed'});
    next();
  });
  app.use(express.json({limit:'24kb'}));
  // No request/body logging, filesystem APIs, uploads, location permissions, or provider credentials.
  app.get('/health',(_,res)=>res.json({status:'ok',sampleOnly:true}));
  app.get('/',(_,res)=>res.type('html').send(html));
  app.get('/favicon.ico',(_,res)=>res.sendStatus(204));
  app.post('/demo/tools',(req,res)=>res.json(resultFor(store,req.body?.name,req.body?.arguments)));
  app.post('/mcp',async(req,res)=>{
    const server=createServer(store,html);
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on('close',()=>{ void transport.close(); void server.close(); });
    try {await server.connect(transport);await transport.handleRequest(req,res,req.body);}
    catch {if(!res.headersSent)res.status(500).json({jsonrpc:'2.0',id:null,error:{code:-32603,message:'Sample server error'}});}
  });
  app.all('/mcp',(_,res)=>res.status(405).set('Allow','POST').json({error:'Use MCP Streamable HTTP POST'}));
  app.use((_,res)=>res.status(404).json({error:'Not found'}));
  app.use((err,req,res,next)=>res.status(err.type==='entity.too.large'?413:400).json({error:'Invalid request'}));
  return app;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  const port=Number(process.env.PORT||8787);
  const html=await readFile(new URL('./dist/widget.html',import.meta.url),'utf8');
  createHttpApp(html,{port}).listen(port,'127.0.0.1',()=>console.log(`Deep Focus SAMPLE ONLY: http://127.0.0.1:${port} · MCP /mcp`));
}
