import { App } from '@modelcontextprotocol/ext-apps';
import mapImage from '../assets/sample-map.png';
import calendarIcon from '@phosphor-icons/core/assets/regular/calendar-blank.svg';

const root=document.querySelector('#app');
const embedded=window.parent!==window;
const bridge=embedded?new App({name:'Deep Focus sample day',version:'0.1.0'}):null;
let day, editing, busy=false, message='', error=false, connected=!embedded;
const labels=['Reading','Coffee','Workout','Phone call','Walking','Resting'];
const places=['Café','Gym','Home','Outside','Unknown'];
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clock=s=>`${Number(s.slice(0,2))%12||12}:${s.slice(3)}`;
const period=s=>Number(s.slice(0,2))>=12?'PM':'AM';
const range=e=>`${clock(e.start)}–${clock(e.end)} ${period(e.start)===period(e.end)?period(e.end):`(${period(e.start)}–${period(e.end)})`}`;
const title=e=>e.status==='unknown'?'Unknown activity':e.activities.join(' + ');
async function call(name,args) {
  const result=embedded?await bridge.callServerTool({name,arguments:args}):await fetch('/demo/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,arguments:args})}).then(r=>{if(!r.ok)throw new Error('Sample server unavailable. Try again.');return r.json();});
  if(result.isError)throw new Error(result.content?.find(c=>c.type==='text')?.text||'Unable to update the sample.');
  if(!result.structuredContent?.sampleOnly)throw new Error('No sample-day result received.');
  return result.structuredContent;
}
function accept(next) {
  if(!next?.sampleOnly)return;
  if(day&&day.demoId===next.demoId&&next.revision<day.revision)return;
  day=next; render();
}
async function action(fn) {
  if(busy||!connected)return;busy=true;message='';error=false;render();
  try{await fn();if(bridge&&day)await bridge.updateModelContext({structuredContent:day,content:[{type:'text',text:`Fictional sample ${day.demoId}, revision ${day.revision}. UI changes are simulated; no real calendar was changed.`}]}).catch(()=>{});}
  catch(e){message=e.message;error=true;}
  finally{busy=false;render();}
}
function render() {
  if(!day)return;
  const workout=day.entries.find(e=>e.id==='workout');
  const current=day.simulatedCalendar;
  const applied=current.start===workout.start&&current.end===workout.end&&current.title===title(workout)&&current.place===workout.place;
  root.setAttribute('aria-busy',String(busy));
  root.innerHTML=`<header><div class="brand">Deep <span>Focus</span></div><div class="headline"><h1>Your Saturday</h1><img src="${escape(calendarIcon)}" alt=""></div><p class="date">Nov 14 · Fictional sample day</p></header>
    ${message?`<p role="${error?'alert':'status'}" class="status ${error?'error':''}">${escape(message)}</p>`:''}
    <ol class="timeline">${[...day.entries].sort((a,b)=>a.start.localeCompare(b.start)).map(e=>`<li class="entry ${e.status==='unknown'?'unconfirmed':''}"><span class="dot" aria-hidden="true"></span><div class="entry-top"><div><div class="entry-time">${range(e)}</div><h2>${escape(title(e))}</h2></div><button class="edit" data-edit="${e.id}" aria-label="Edit ${escape(e.id==='call'?'phone call':e.id)}">Edit</button></div><p>${escape(e.place)} · ${e.status==='unknown'?'left unknown':e.source==='sample-script'?'sample confirmation':'confirmed in this demo'}</p>${e.id==='workout'?`<figure class="evidence"><img src="${mapImage}" alt="Illustrated fictional neighborhood with a blue gym location pin"><figcaption><strong>Saved place: Gym</strong><p>Visit estimate 5:20–6:35 PM</p></figcaption></figure>`:''}</li>`).join('')}</ol>
    ${editing?editForm(day.entries.find(e=>e.id===editing)):''}
    <section class="review" aria-label="Calendar review"><h2>${applied?'Sample calendar updated':workout.status==='unknown'?'An honest gap':'One update to review'}</h2><p>${applied?'Your correction is reflected in the fictional workout event. The original plan is preserved.':workout.status==='unknown'?'The gym visit remains evidence of a place. Confirm what happened before changing the sample calendar.':'The visit tells us where. Your confirmation tells us what happened. Update the fictional workout event?'}</p><dl class="comparison"><dt>Planned</dt><dd>${range(day.originalPlan)}</dd>${day.appliedUpdates.length&&!applied?`<dt>Calendar now</dt><dd>${range(current)} · ${escape(current.title)} · ${escape(current.place)}</dd>`:''}<dt>${applied?'Simulated':'Confirmed'}</dt><dd>${workout.status==='unknown'?'Unknown':`${range(workout)} · ${escape(workout.place)}${title(workout)!=='Workout'?`<br>${escape(title(workout))}`:''}`}</dd></dl>
    ${!applied&&workout.status!=='unknown'?'<button class="primary" id="confirm">Confirm sample update</button>':''}<button class="secondary full" data-edit="workout">${applied?'Make another correction':'Change times or activity'}</button>
    <p class="context">${day.confirmedElapsedMinutes} min of confirmed elapsed time. Concurrent activities count once. Gaps stay unknown.</p></section>
    <footer class="footer"><p>Sample only · No real calendar changes</p><p>${embedded?'Tell ChatGPT what changed.':'In ChatGPT, just tell it what changed.'}</p><button class="reset" id="reset">Start a fresh sample</button></footer>`;
  root.querySelectorAll('button').forEach(b=>b.disabled=busy||!connected);
  root.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{editing=b.dataset.edit;message='';render();root.querySelector('.edit-form')?.scrollIntoView({block:'nearest'});root.querySelector('#start')?.focus({preventScroll:true});});
  root.querySelector('#reset').onclick=()=>action(async()=>{accept(await call('start_sample_day',{}));editing=undefined;message='A fresh fictional Saturday is ready.';});
  root.querySelector('#confirm')?.addEventListener('click',()=>action(async()=>{
    const reviewed={...day};
    const preview=await call('preview_sample_calendar_update',{demoId:reviewed.demoId,expectedRevision:reviewed.revision});
    accept(await call('confirm_sample_calendar_update',{demoId:reviewed.demoId,previewToken:preview.preview.previewToken,userConfirmed:true}));
    message='Updated the sample calendar. Your real calendars are untouched.';
  }));
  root.querySelector('#cancel')?.addEventListener('click',()=>{editing=undefined;render();});
  root.querySelector('form')?.addEventListener('submit',event=>{
    event.preventDefault();const form=new FormData(event.currentTarget);
    const args={demoId:day.demoId,expectedRevision:day.revision,activityId:editing,start:form.get('start'),end:form.get('end'),activities:form.getAll('activities'),place:form.get('place'),status:form.get('status')};
    action(async()=>{accept(await call('correct_sample_activity',args));editing=undefined;message='Correction saved in this sample. The visit evidence and original plan are preserved.';});
  });
}
function editForm(e) {
  return `<form class="edit-form"><h2>Edit ${escape(e.id==='call'?'phone call':e.id)}</h2><div class="time-fields"><label for="start">Start<input id="start" name="start" type="time" value="${e.start}" required></label><label for="end">End<input id="end" name="end" type="time" value="${e.end}" required></label></div><fieldset><legend>Activities · choose up to three together</legend><div class="choices">${labels.map(l=>`<label><input type="checkbox" name="activities" value="${l}" ${e.activities.includes(l)?'checked':''}>${l}</label>`).join('')}</div></fieldset><label for="place">Place<select id="place" name="place">${places.map(p=>`<option ${p===e.place?'selected':''}>${p}</option>`).join('')}</select></label><label for="status">How certain are you?<select id="status" name="status"><option value="confirmed" ${e.status==='confirmed'?'selected':''}>Confirmed in this sample</option><option value="unknown" ${e.status==='unknown'?'selected':''}>Leave unknown</option></select></label><p class="fine">All times are on Nov 14, 2026, Eastern Time. This changes a fictional activity; calendar review is separate.</p><div class="actions"><button class="primary" type="submit">Save correction</button><button type="button" class="secondary" id="cancel">Cancel</button></div></form>`;
}
if(bridge) {
  bridge.ontoolresult=result=>accept(result.structuredContent);
  bridge.onerror=()=>{message='Connection interrupted. Ask ChatGPT to show the sample again.';error=true;render();};
  try{await bridge.connect();connected=true;render();}catch{root.innerHTML='<p class="loading">This host could not open the sample card. You can still ask ChatGPT to review and correct the sample using the tools.</p>';}
} else {
  try{accept(await call('start_sample_day',{}));}catch{root.innerHTML='<p class="loading">Could not reach the sample server. Reload to try again.</p>';}
}
