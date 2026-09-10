import {createClient} from '@supabase/supabase-js';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const cfg=JSON.parse(readFileSync('work/local-status.json','utf8'));
if(!/^http:\/\/(127\.0\.0\.1|localhost):/.test(cfg.API_URL))throw Error('Local backend required');
const admin=createClient(cfg.API_URL,cfg.SERVICE_ROLE_KEY);
const users=[];
const paths=[];
try {
 for(let i=0;i<2;i++){
  const email=`edge-${crypto.randomUUID()}@example.test`,password='LocalEdgeTest!2026';
  const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;
  const client=createClient(cfg.API_URL,cfg.ANON_KEY);const login=await client.auth.signInWithPassword({email,password});if(login.error)throw login.error;
  users.push({id:data.user.id,client});
 }
 const [a,b]=users;
 const n=await a.client.from('notes').insert({user_id:a.id,title:'Image test'}).select().single();if(n.error)throw n.error;
 const path=`${a.id}/${n.data.id}/${crypto.randomUUID()}.png`;paths.push(path);
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWTcAAAAASUVORK5CYII=','base64');
 const upload=await a.client.storage.from('note-images').upload(path,png,{contentType:'image/png'});if(upload.error)throw upload.error;
 const url=a.client.storage.from('note-images').getPublicUrl(path).data.publicUrl;
 const saved=await a.client.from('notes').update({content:`![test](${url})`}).eq('id',n.data.id);if(saved.error)throw saved.error;
 const token=crypto.randomUUID().replaceAll('-','');
 const share=await a.client.from('share_tokens').insert({user_id:a.id,token,target_type:'note',note_id:n.data.id});if(share.error)throw share.error;
 const invoke=async(token,path)=>fetch(`${cfg.API_URL}/functions/v1/shared-image`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,path})});
 const publicRead=await fetch(url);assert.notEqual(publicRead.status,200,'Private bytes exposed by public URL');
 const foreignRead=await b.client.storage.from('note-images').createSignedUrl(path,60);assert(foreignRead.error,'Foreign user signed an attachment');
 const good=await invoke(token,path);assert.equal(good.status,200,await good.text());
 const missing=await invoke(token,`${a.id}/${n.data.id}/${crypto.randomUUID()}.png`);assert.equal(missing.status,404);
 const otherNote=await b.client.from('notes').insert({user_id:b.id,title:'Forged URL',content:`![foreign](${url})`}).select().single();if(otherNote.error)throw otherNote.error;
 const otherToken=crypto.randomUUID().replaceAll('-','');
 await b.client.from('share_tokens').insert({user_id:b.id,token:otherToken,target_type:'note',note_id:otherNote.data.id});
 assert.equal((await invoke(otherToken,path)).status,404,'Share signed a foreign owner attachment');
 await a.client.from('share_tokens').update({revoked_at:new Date().toISOString()}).eq('token',token);
 assert.equal((await invoke(token,path)).status,404,'Revoked share signed an attachment');
 const cron=await fetch(`${cfg.API_URL}/functions/v1/send-reminders`,{method:'POST'});assert.equal(cron.status,401,'Scheduler accepted an unauthorized call');
 console.log('PASS: private storage, owner isolation, allowed share, unrelated path rejection, foreign-share rejection, revocation, scheduler authorization');
} finally {
 if(paths.length)await admin.storage.from('note-images').remove(paths);
 for(const user of users)await admin.auth.admin.deleteUser(user.id);
}
