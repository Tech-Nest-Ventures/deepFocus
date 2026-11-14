import { randomUUID, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const activities = ['Reading', 'Coffee', 'Workout', 'Phone call', 'Walking', 'Resting'];
export const places = ['Café', 'Gym', 'Home', 'Outside', 'Unknown'];
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Use local 24-hour HH:mm.');
const session = { demoId: z.string().uuid() };
const revision = z.number().int().nonnegative();
export const schemas = {
  start_sample_day: z.object({}).strict(),
  get_sample_day: z.object(session).strict(),
  show_sample_day: z.object(session).strict(),
  correct_sample_activity: z.object({ ...session, expectedRevision: revision,
    activityId: z.enum(['reading', 'workout', 'call']), start: clock, end: clock,
    activities: z.array(z.enum(activities)).min(1).max(3), place: z.enum(places),
    status: z.enum(['confirmed', 'unknown']) }).strict(),
  preview_sample_calendar_update: z.object({ ...session, expectedRevision: revision }).strict(),
  confirm_sample_calendar_update: z.object({ ...session, previewToken: z.string().max(600),
    userConfirmed: z.literal(true) }).strict(),
};
export const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function elapsedMinutes(entries) {
  let end = -1, total = 0;
  for (const e of entries.filter(e => e.status === 'confirmed').sort((a,b) => minutes(a.start)-minutes(b.start))) {
    const start = minutes(e.start), next = minutes(e.end);
    total += Math.max(0, next - Math.max(start, end)); end = Math.max(end, next);
  }
  return total;
}
function fixture(id, now) {
  return { demoId: id, revision: 0, createdAt: now, sampleOnly: true, date: '2026-11-14',
    timezone: 'America/New_York', title: 'Your Saturday',
    notice: 'Fictional sample day. No real location, calendar, or browsing data is connected. Changes are in-memory simulations.',
    entries: [
      { id:'reading', start:'15:10', end:'16:20', activities:['Reading','Coffee'], place:'Café', status:'confirmed', source:'sample-script' },
      { id:'workout', start:'17:20', end:'18:15', activities:['Workout'], place:'Gym', status:'confirmed', source:'sample-script' },
      { id:'call', start:'18:15', end:'18:35', activities:['Phone call'], place:'Gym', status:'confirmed', source:'sample-script' },
    ],
    observations: [{ id:'gym-visit', kind:'place-visit', place:'Gym', start:'17:20', end:'18:35', source:'fictional-visit-estimate', establishesActivity:false }],
    originalPlan: { id:'sample-workout-event', title:'Workout', start:'17:00', end:'18:00', place:'Gym', source:'fictional-calendar-intention' },
    simulatedCalendar: { id:'sample-workout-event', title:'Workout', start:'17:00', end:'18:00', place:'Gym' },
    corrections: [], appliedUpdates: [] };
}

export class DemoStore {
  #days = new Map();
  #secret = randomBytes(32);
  constructor({now = () => Date.now(), ttl = 86400000, capacity = 200} = {}) { Object.assign(this, {now,ttl,capacity}); }
  #prune() { for (const [id,day] of this.#days) if (this.now()-day.createdAt >= this.ttl) this.#days.delete(id); }
  #get(id) { this.#prune(); const d=this.#days.get(id); if (!d) throw new Error('Sample session expired or was not found. Start a new sample day.'); return d; }
  #check(d, rev) { if(d.revision !== rev) throw new Error('The sample changed. Get the latest day and review again.'); }
  #snapshot(d) {
    const result=structuredClone(d); delete result.createdAt;
    result.confirmedElapsedMinutes=elapsedMinutes(d.entries);
    result.nextQuestion=d.corrections.length===0?'The sample visit lasts until 6:35 PM, but the workout ends at 6:15. Was the rest a phone call, walking, or something else?':null;
    return result;
  }
  #proposal(d) {
    const e=d.entries.find(e=>e.id==='workout');
    if(e.status!=='confirmed') throw new Error('The workout is unknown. Confirm an activity before previewing a calendar change.');
    return { id:d.originalPlan.id, title:e.activities.join(' + '), start:e.start, end:e.end, place:e.place };
  }
  #sign(payload) { return createHmac('sha256',this.#secret).update(payload).digest('base64url'); }
  run(name, input) {
    if(!Object.hasOwn(schemas,name)) throw new Error('Unsupported sample tool.');
    const a=schemas[name].parse(input);
    if(name==='start_sample_day') {
      this.#prune(); if(this.#days.size>=this.capacity) throw new Error('Sample capacity reached. Please try later.');
      const d=fixture(randomUUID(),this.now()); this.#days.set(d.demoId,d); return this.#snapshot(d);
    }
    const d=this.#get(a.demoId);
    if(name==='correct_sample_activity') {
      this.#check(d,a.expectedRevision);
      if(minutes(a.end)<=minutes(a.start)) throw new Error('End must be after start within this sample day.');
      if(new Set(a.activities).size!==a.activities.length) throw new Error('Choose each activity only once.');
      if(d.corrections.length>=100) throw new Error('This sample reached its edit limit. Start a fresh day.');
      const index=d.entries.findIndex(e=>e.id===a.activityId), before=structuredClone(d.entries[index]);
      d.entries[index]={id:a.activityId,start:a.start,end:a.end,activities:a.activities,place:a.place,status:a.status,source:'user-correction-in-demo'};
      d.corrections.push({revision:++d.revision,before,after:structuredClone(d.entries[index])});
    }
    if(name==='preview_sample_calendar_update') {
      this.#check(d,a.expectedRevision);
      const after=this.#proposal(d);
      const payload=Buffer.from(JSON.stringify({id:d.demoId,rev:d.revision,expires:this.now()+600000})).toString('base64url');
      return {...this.#snapshot(d),preview:{ before:structuredClone(d.simulatedCalendar),after,originalPlan:structuredClone(d.originalPlan),
        previewToken:payload+'.'+this.#sign(payload),message:'Preview only. Confirm to update the fictional calendar in this sample.' }};
    }
    if(name==='confirm_sample_calendar_update') {
      const [payload,signature,...extra]=a.previewToken.split('.');
      const expected=Buffer.from(this.#sign(payload||'')), received=Buffer.from(signature||'');
      if(extra.length||expected.length!==received.length||!timingSafeEqual(expected,received)) throw new Error('Invalid preview. Request a fresh calendar preview.');
      let p; try{p=JSON.parse(Buffer.from(payload,'base64url').toString());}catch{throw new Error('Invalid preview.');}
      if(p.id!==d.demoId) throw new Error('Preview belongs to a different sample session.');
      // A repeated confirmation is safe; it never applies an update twice.
      if(d.appliedUpdates.some(u=>u.previewToken===a.previewToken)) return this.#snapshot(d);
      if(p.expires<=this.now()) throw new Error('Preview expired. Review a fresh preview.');
      this.#check(d,p.rev);
      const after=this.#proposal(d);
      if(d.appliedUpdates.length>=100) throw new Error('Sample update limit reached. Start a fresh day.');
      d.appliedUpdates.push({revision:++d.revision,before:structuredClone(d.simulatedCalendar),after:structuredClone(after),previewToken:a.previewToken});
      d.simulatedCalendar=after;
    }
    return this.#snapshot(d);
  }
}
