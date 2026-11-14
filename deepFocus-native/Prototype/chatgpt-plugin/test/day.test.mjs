import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoStore, elapsedMinutes } from '../src/day.mjs';
const fresh=store=>store.run('start_sample_day',{});
const correction=(d,extra={})=>({demoId:d.demoId,expectedRevision:d.revision,activityId:'workout',start:'17:20',end:'18:10',activities:['Workout'],place:'Gym',status:'confirmed',...extra});

test('independent sample sessions preserve the original plan and visit evidence',()=>{
  const store=new DemoStore(),a=fresh(store),b=fresh(store);
  const edited=store.run('correct_sample_activity',correction(a));
  assert.equal(edited.entries[1].end,'18:10');assert.equal(edited.corrections[0].before.end,'18:15');
  assert.deepEqual(edited.originalPlan,a.originalPlan);assert.deepEqual(edited.observations,a.observations);
  assert.deepEqual(store.run('get_sample_day',{demoId:b.demoId}),b);
  edited.entries[0].place='Not shared';assert.equal(store.run('get_sample_day',{demoId:a.demoId}).entries[0].place,'Café');
});
test('parallel labels and overlapping intervals do not inflate elapsed time',()=>{
  const store=new DemoStore(),a=fresh(store);
  const next=store.run('correct_sample_activity',correction(a,{activityId:'call',start:'18:00',end:'18:35',activities:['Walking','Phone call']}));
  assert.equal(next.confirmedElapsedMinutes,145);assert.equal(next.entries[2].activities.length,2);
  assert.equal(elapsedMinutes([{start:'10:00',end:'11:00',status:'confirmed'},{start:'10:20',end:'10:30',status:'confirmed'}]),60);
});
test('unknown intervals are excluded and cannot overwrite a calendar',()=>{
  const store=new DemoStore(),a=fresh(store),next=store.run('correct_sample_activity',correction(a,{status:'unknown'}));
  assert.equal(next.confirmedElapsedMinutes,90);
  assert.throws(()=>store.run('preview_sample_calendar_update',{demoId:a.demoId,expectedRevision:1}),/unknown/);
});
test('invalid clock values, reversed times, duplicate labels and real-data fields are rejected atomically',()=>{
  const store=new DemoStore(),a=fresh(store);
  for(const patch of [{start:'25:00'},{end:'17:20'},{end:'16:00'},{activities:['Workout','Workout']},{latitude:41},{notes:'private narrative'},{place:'Real address'}])
    assert.throws(()=>store.run('correct_sample_activity',correction(a,patch)));
  assert.deepEqual(store.run('get_sample_day',{demoId:a.demoId}),a);
});
test('stale corrections cannot replace newer user choices',()=>{
  const store=new DemoStore(),a=fresh(store);store.run('correct_sample_activity',correction(a));
  assert.throws(()=>store.run('correct_sample_activity',correction(a)),/changed/);
});
test('calendar preview does not write; confirmation requires the reviewed preview and is idempotent',()=>{
  const store=new DemoStore(),a=fresh(store),preview=store.run('preview_sample_calendar_update',{demoId:a.demoId,expectedRevision:0});
  assert.deepEqual(store.run('get_sample_day',{demoId:a.demoId}).simulatedCalendar,a.simulatedCalendar);
  const args={demoId:a.demoId,previewToken:preview.preview.previewToken,userConfirmed:true};
  assert.throws(()=>store.run('confirm_sample_calendar_update',{...args,userConfirmed:false}));
  const next=store.run('confirm_sample_calendar_update',args);
  assert.equal(next.simulatedCalendar.end,'18:15');assert.equal(next.simulatedCalendar.id,a.originalPlan.id);
  assert.deepEqual(next.originalPlan,a.originalPlan);assert.equal(next.appliedUpdates.length,1);
  assert.deepEqual(store.run('confirm_sample_calendar_update',args),next);
});
test('foreign, forged, stale and expired previews cannot apply',()=>{
  let now=0;const store=new DemoStore({now:()=>now}),a=fresh(store),b=fresh(store);
  const preview=store.run('preview_sample_calendar_update',{demoId:a.demoId,expectedRevision:0}).preview;
  const args={demoId:a.demoId,previewToken:preview.previewToken,userConfirmed:true};
  assert.throws(()=>store.run('confirm_sample_calendar_update',{...args,demoId:b.demoId}),/different/);
  assert.throws(()=>store.run('confirm_sample_calendar_update',{...args,previewToken:args.previewToken+'x'}),/Invalid/);
  store.run('correct_sample_activity',correction(a));assert.throws(()=>store.run('confirm_sample_calendar_update',args),/changed/);
  now=600001;assert.throws(()=>store.run('confirm_sample_calendar_update',args),/expired/);
});
test('expired sessions and bounded capacity prevent unbounded demo retention',()=>{
  let now=0;const store=new DemoStore({now:()=>now,ttl:100,capacity:1}),a=fresh(store);
  assert.throws(()=>fresh(store),/capacity/);now=101;
  assert.throws(()=>store.run('get_sample_day',{demoId:a.demoId}),/expired/);assert.ok(fresh(store).demoId);
});
