// Detect continuous map redraws and growing DOM/listener retention after focus toggles.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.GAKIT_PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GAKIT_BASE_URL || 'http://localhost:3000';
const profileOnly = process.env.GAKIT_PROFILE_ONLY === '1';

(async () => {
  const browser = await chromium.launch({channel:process.platform === 'win32' ? 'msedge' : undefined,headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('gakit:onboarding-v1',JSON.stringify({version:1,locationChoice:'skipped',completedAt:new Date().toISOString()}));
      window.mapProfile = {raf:0,draws:0};
      const raf = window.requestAnimationFrame;
      window.requestAnimationFrame = callback => raf.call(window,time => {window.mapProfile.raf++; callback(time);});
      for (const Context of [window.WebGLRenderingContext,window.WebGL2RenderingContext]) {
        if (!Context) continue;
        for (const name of ['drawElements','drawArrays']) {
          const draw = Context.prototype[name];
          Context.prototype[name] = function(...args) {window.mapProfile.draws++; return draw.apply(this,args);};
        }
      }
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(6500);
    const begin = await page.evaluate(() => ({...window.mapProfile}));
    await page.waitForTimeout(3000);
    const end = await page.evaluate(() => ({...window.mapProfile}));
    const idle = {seconds:3,animationCallbacks:end.raf-begin.raf,webglDrawCalls:end.draws-begin.draws};
    console.log('Idle rendering: '+JSON.stringify(idle));
    if (!profileOnly) assert(idle.animationCallbacks < 90,'Idle map must not run continuous frame animations');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const memory = async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      const {metrics} = await cdp.send('Performance.getMetrics');
      const heap = metrics.find(metric => metric.name === 'JSHeapUsedSize').value;
      const dom = await cdp.send('Memory.getDOMCounters');
      return {heapMB:Number((heap/1024/1024).toFixed(1)),nodes:dom.nodes,listeners:dom.jsEventListeners};
    };
    const cycle = async () => {
      const search = page.getByRole('textbox',{name:'Search for a location in Iligan City',exact:true}).first();
      await search.fill('');
      await search.fill('MSU-IIT');
      await page.getByRole('button',{name:/Mindanao State University – Iligan Institute of Technology/}).first().click();
      await page.getByRole('button',{name:'Enable focus view',exact:true}).click();
      await page.getByRole('button',{name:'Exit campus focus',exact:true}).click();
      await page.waitForTimeout(800);
    };
    await cycle();
    const warm = await memory();
    for (let index=0;index<5;index++) await cycle();
    const middle = await memory();
    for (let index=0;index<5;index++) await cycle();
    await page.waitForTimeout(1000);
    const after = await memory();
    console.log('Focus memory: '+JSON.stringify({warm,middle,after}));
    if (!profileOnly) {
      assert(after.listeners <= warm.listeners+20,'Focus cycles must not accumulate map event listeners');
      assert(after.nodes <= warm.nodes+150,'Focus cycles must release their DOM');
      assert(after.heapMB <= warm.heapMB+20,'Focus cycles must not retain unbounded application data');
    }
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
