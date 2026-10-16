// Browser smoke fixture: run against a running client with Playwright installed.
// All simulation JSON and PNG responses are intercepted; no forecast accuracy is asserted.

const {chromium}=require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const base=process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGNk23blLAMDAwMTiABhACOeAmF25L8LAAAAAElFTkSuQmCC','base64');
const T=new Date();T.setUTCMinutes(0,0,0);
const stamp=h=>new Date(+T+h*3600000).toISOString();
const frame=(h,kind,area,ready=true)=>({frame_id:String(h+100),valid_at:stamp(h),kind,horizon_hours:kind==='forecast'?h:0,window_start_at:stamp(h-24),window_end_at:stamp(h),window_hours:24,valid_hours:ready?24:18,missing_intervals:ready?[]:[stamp(h-12)],availability:ready?'ready':'incomplete',reason:ready?null:'incomplete_rainfall_window',rainfall_24h_mm:ready?24:null,hourly_rain_mm:ready?1:null,inundated_km2:ready?area:null,max_depth_m:ready?2:null,raster_url:ready?`/api/v1/surrogate/live/v2/snapshots/fixture/frames/${h+100}.png`:null,forecast_source:kind==='forecast'?'open_meteo':null,source_issues:[],coverage_fraction:ready?1:null});
const timeline={schema_version:2,snapshot_id:'fixture',created_at:new Date().toISOString(),evaluated_at:new Date().toISOString(),expires_at:new Date(Date.now()+3600000).toISOString(),observed_at:stamp(0),forecast_anchor_at:stamp(0),freshness:'fresh',readiness:'partial',build_state:'ready',bounds:[[124.15,8.35],[124.5,8.35],[124.5,8.1],[124.15,8.1]],frames:[frame(-1,'replay',2.34),frame(0,'latest',9.12),frame(1,'forecast',12.34),frame(3,'forecast',null,false)],available_horizons:[0,1],policy_version:'live-v2.1',rendering:'full_hann'};
(async()=>{
 const browser=await chromium.launch({channel:process.platform === 'win32' ? 'msedge' : undefined,headless:true});try { const page=await browser.newPage({viewport:{width:1440,height:1000}});let images=0;
 await page.route('**/api/v1/surrogate/live/v2/timeline',route=>route.fulfill({json:timeline,headers:{'access-control-allow-origin':'*'}}));
 await page.route('**/api/v1/surrogate/live/v2/snapshots/**',route=>{images++;return route.fulfill({body:png,contentType:'image/png',headers:{'access-control-allow-origin':'*'}})});
 await page.goto(`${base}/flood-scenarios`,{waitUntil:'domcontentloaded'});
 const notice=page.getByRole('button',{name:/I Understand/});await notice.waitFor({state:'visible'});await notice.click();
 await page.getByRole('button',{name:/Active Scenario/}).click();await page.getByText('Live inundation estimates',{exact:true}).click();console.log('Scenario selected');
 await page.locator('.hud-card .text-2xl').filter({hasText:/^9\.12/}).waitFor();console.log('Latest rendered');
 await page.getByRole('slider').first().press('Home');await page.locator('.hud-card .text-2xl').filter({hasText:/^2\.34/}).waitFor();
 await page.getByRole('slider').first().press('End');await page.getByText('Rainfall history incomplete (18/24 hours)',{exact:true}).waitFor();
 assert(!(await page.locator('.hud-card').filter({hasText:'Rainfall over 24h'}).innerText()).includes('NaN'));assert(images>=2);
 await page.goto(`${base}/`,{waitUntil:'domcontentloaded'});
 const guide=page.getByRole('button',{name:'Close guide',exact:true});try { await guide.waitFor({state:'visible',timeout:5000});await guide.click(); } catch {}
 const expand=page.getByRole('button',{name:'Expand Layers',exact:true});if(await expand.count())await expand.click();
 await page.getByText('Flood Simulation',{exact:true}).click();
 await page.getByText(/^9\.12 km/).first().waitFor();
 await page.getByRole('slider',{name:'Rolling 24-hour replay hour'}).press('Home');
 await page.getByText(/^2\.34 km/).first().waitFor();
 await page.getByRole('button',{name:'+3h',exact:true}).click();
 await page.getByText('Rainfall history incomplete (18/24 hours)',{exact:true}).waitFor();
 console.log(JSON.stringify({scenario:'latest, replay, and unavailable frames passed',publicMap:'latest, replay, and unavailable forecasts passed',decodedImageFetches:images}));
 } finally { await browser.close(); }
})().catch(e=>{console.error(e.stack);process.exit(1)});
