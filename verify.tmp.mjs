import { chromium } from "playwright";
const BASE = "http://127.0.0.1:4191";
const OUT = "/tmp/claude-0/-home-user-DailyMark/ce4821d6-11f0-5bd0-ab8f-0b5bf37e1f56/scratchpad";
const USER = { id:"u1", email:"you@example.com", aud:"authenticated", role:"authenticated", app_metadata:{}, user_metadata:{}, created_at:"2026-01-01T00:00:00Z" };
const NB = [{id:"nb1",user_id:"u1",name:"Inbox",color:"#f59e0b",created_at:"2026-01-01T00:00:00Z"},
            {id:"nb2",user_id:"u1",name:"Ideas",color:"#3b82f6",created_at:"2026-01-02T00:00:00Z"}];
const notes = Array.from({length:5},(_,i)=>({id:`n${i+1}`,user_id:"u1",notebook_id:NB[i%2].id,
  title:["Morning pages","Reading list","Weekly review","Trip notes","Recipes"][i],
  content:"# Morning pages\n\nSome **bold** and *italic* with `code`.\n\n- one\n- two\n",
  preview:"Some bold and italic with code. One. Two.",is_pinned:i===0,
  tags:i%2?["reading"]:["daily","writing"],deleted_at:null,revisit_at:null,
  created_at:"2026-07-20T09:00:00Z",updated_at:"2026-08-01T09:00:00Z"}));

const browser = await chromium.launch({ executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args:["--disable-background-networking","--no-first-run"] });

async function run(name, path, width, height, theme, signedIn) {
  const ctx = await browser.newContext({ viewport:{width,height} });
  const page = await ctx.newPage();
  const reqs=[], errs=[];
  page.on("request", r=>reqs.push(r.url()));
  page.on("pageerror", e=>errs.push("pageerror: "+e.message));
  page.on("console", m=>{ if(m.type()==="error") errs.push("console: "+m.text()); });
  page.on("requestfailed", r=>{ const u=r.url(); if(u.startsWith(BASE)) errs.push("failed: "+u.replace(BASE,"")); });

  await page.route("**/*.supabase.co/auth/v1/**", r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({user:USER,session:null})}));
  await page.route("**/*.supabase.co/rest/v1/rpc/**", r=>r.fulfill({status:200,contentType:"application/json",body:JSON.stringify({streak:7})}));
  await page.route("**/*.supabase.co/rest/v1/**", r=>{
    const u=new URL(r.request().url()), t=u.pathname.split("/").pop();
    let d = t==="notebooks"?NB : t==="notes" ? (u.searchParams.get("deleted_at")==="is.null"?notes:[]) : [];
    const single=(r.request().headers()["accept"]||"").includes("vnd.pgrst.object");
    return r.fulfill({status:200,contentType:"application/json",body:JSON.stringify(single?(d[0]??null):d)});
  });
  await page.addInitScript(([th,si,u])=>{ localStorage.setItem("theme",th);
    if(si) localStorage.setItem("sb-tekzjuuerbozevmznymd-auth-token",JSON.stringify({access_token:"s",refresh_token:"s",token_type:"bearer",expires_in:360000,expires_at:Math.floor(Date.now()/1000)+360000,user:u})); },[theme,signedIn,USER]);

  await page.goto(BASE+path,{waitUntil:"domcontentloaded"});
  await page.waitForLoadState("networkidle").catch(()=>{});
  await page.waitForTimeout(1200);
  await page.screenshot({path:`${OUT}/prod-${name}.png`});

  const local = reqs.filter(u=>u.startsWith(BASE));
  return { name,
    chunks: local.filter(u=>u.includes("/assets/")&&u.endsWith(".js")).map(u=>u.split("/").pop()),
    fonts: local.filter(u=>u.includes("/fonts/")).map(u=>u.split("/").pop()),
    img: [...new Set(local.filter(u=>u.includes("/img/")).map(u=>u.split("/").pop()))],
    thirdParty: reqs.filter(u=>!u.startsWith(BASE)&&!u.includes("supabase.co")),
    loadedFonts: [...new Set(await page.evaluate(()=>[...document.fonts].filter(f=>f.status==="loaded").map(f=>f.family)))],
    errs, page, ctx };
}

for (const [n,p,w,h,t,s] of [["login","/login",390,844,"dark",false],
                             ["notes-desktop","/notes",1440,900,"dark",true],
                             ["notes-light","/notes",1440,900,"light",true],
                             ["edit","/notes/n1/edit",1440,900,"dark",true]]) {
  const r = await run(n,p,w,h,t,s);
  console.log(`\n── ${r.name} ─────────────────────────`);
  console.log("  js chunks   :", r.chunks.join(", ") || "(none)");
  console.log("  fonts       :", r.fonts.join(", ") || "(none)");
  if (r.img.length) console.log("  hero        :", r.img.join(", "));
  console.log("  loaded fonts:", r.loadedFonts.join(", ") || "(none)");
  console.log("  third-party :", r.thirdParty.length ? r.thirdParty : "none");
  console.log("  errors      :", r.errs.length ? r.errs.slice(0,4) : "none");
  await r.ctx.close();
}
await browser.close();
