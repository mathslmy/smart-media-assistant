// ---- SmartMediaAssistant / index.js ----
import { getBase64Async, getStringHash, saveBase64AsFile } from "../../../utils.js";
// 完整版：包含 UI、图片/文档本地处理、Google/Kimi 真实 API 调用、模型拉取/测试、注入输入框、持久化配置

// SillyTavern 环境事件
const { eventSource, event_types } = SillyTavern.getContext();

eventSource.on(event_types.APP_READY, () => {
  initSmartMediaUI_FullReal();
});

function initSmartMediaUI_FullReal() {
  if (document.querySelector('#smartmedia_button')) return;

  // 1) “➕”按钮（输入框左侧）
  const $plusBtn = $('<div id="smartmedia_button" class="sma-plus menu_button interactable" title="打开 SmartMedia">➕</div>');
  if ($('#send_but_sheld').length === 0) {
    $('#rightSendForm').prepend($plusBtn);
  } else {
    $('#send_but_sheld').prepend($plusBtn);
  }

  // 2) 遮罩
  const overlay = document.createElement('div');
  overlay.className = 'sma-overlay';
  document.body.appendChild(overlay);

  // 3) 弹窗（整合 smartmedia.html 全功能；无 iframe）
  const popup = document.createElement('div');
  popup.className = 'sma-popup-top';
  popup.innerHTML = `
    <div class="sma-top-head">
      <div class="sma-top-title">SmartMedia Assistant</div>
      <i class="menu_button fa-solid fa-xmark sma-top-close" title="关闭"></i>
    </div>

    <div class="sma-top-body">

      <!-- 🧾 状态输出区（最上） -->
      <div class="sma-section">
        <h3>状态输出</h3>
        <div id="status" class="sma-output">等待操作...</div>
      </div>

      <!-- 🖼️ 图片上传/识别 -->
      <div class="sma-section">
        <h3>图片上传</h3>
        <input type="file" id="imageInput" accept="image/*" style="display:none;">
        <input type="text" id="imageUrl" placeholder="或输入图片 URL">
        <div class="sma-btns">
  <button class="sma-btn" id="chooseImageBtn">选择本地图片</button>
  <button class="sma-btn" id="loadImageBtn">加载URL</button>
  <button class="sma-btn" id="processImageBtn">本地处理</button>
  <button class="sma-btn" id="recognizeImageBtn">使用API识别</button>
  <button class="sma-btn" id="injectImageBtn">注入识图结果</button>
  <button class="sma-btn" id="injectImageLinkBtn">注入图片链接</button>
</div>
        <img id="imagePreview" style="display:none;" alt="预览">
      </div>

      <!-- 📄 文档上传/识别 -->
      <div class="sma-section">
        <h3>文件上传</h3>
        <input type="file" id="docInput" accept=".txt,.json,.md,.html,.xml,.csv" style="display:none;">
        <div class="sma-btns">
          <button class="sma-btn" id="chooseDocBtn">选择本地文件</button>
          <button class="sma-btn" id="processDocBtn">处理文档</button>
          <button class="sma-btn" id="recognizeDocBtn">使用API识别</button>
          <button class="sma-btn" id="injectDocBtn">注入输入框</button>
        </div>
      </div>

      <!-- 🌐 API 配置区（合并 Google + Kimi） -->
      <div class="sma-section">
        <h3>API 配置</h3>

        <label for="apiSource">选择 API 源</label>
        <select id="apiSource">
          <option value="google">Google Gemini</option>
          <option value="kimi">Kimi / Moonshot</option>
        </select>

        <!-- Google 设置 -->
        <div class="sma-sub">
          <label>Google API Key
            <input type="text" id="googleKey" placeholder="输入 Google API Key">
          </label>
          <div class="sma-btns">
            <button class="sma-btn" id="fetchGoogleModels">拉取模型</button>
            <button class="sma-btn" id="testGoogleApi">测试 API</button>
          </div>
          <select id="googleModel">
            <option value="">（默认 gemini-2.0-flash）</option>
          </select>
        </div>

        <!-- Kimi 设置 -->
        <div class="sma-sub">
          <label>Kimi API Key
            <input type="text" id="kimiKey" placeholder="输入 Kimi API Key">
          </label>
          <div class="sma-btns">
            <button class="sma-btn" id="fetchKimiModels">拉取模型</button>
            <button class="sma-btn" id="testKimiApi">测试 API</button>
          </div>
          <select id="kimiModel">
            <option value="">（请选择模型）</option>
          </select>
        </div>
      </div>

      <!-- ⚙️ 插件设置（放最底部） -->
      <div class="sma-section">
        <h3>插件设置</h3>
        <label>图片质量 (0.1 - 1.0)
          <input type="range" id="imageQuality" min="0.1" max="1.0" step="0.05" value="0.85">
        </label>
        <div class="sma-inline">当前质量：<span id="imageQualityValue">0.85</span></div>

        <label>最大边长 (px)
          <input type="range" id="maxImageDimension" min="256" max="2048" step="64" value="1024">
        </label>
        <div class="sma-inline">当前最大边长：<span id="maxImageDimensionValue">1024</span> px</div>

        <label>单个文件大小上限 (MB)
          <input type="number" id="maxFileSize" min="1" max="64" step="1" value="16">
        </label>
      </div>

    </div>
  `;
  document.body.appendChild(popup);

  const closeBtn = popup.querySelector('.sma-top-close');

  // 4) 打开/关闭
  function openPopup() {
    overlay.classList.add('open');
    popup.classList.add('open');
    restoreConfig();
  }
  function closePopup() {
    overlay.classList.remove('open');
    popup.classList.remove('open');
  }
  $plusBtn.on('click', () => popup.classList.contains('open') ? closePopup() : openPopup());
  overlay.addEventListener('click', closePopup);
  closeBtn.addEventListener('click', closePopup);

  // ========== 常量与工具 ==========
  const GOOGLE_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/';
  const KIMI_BASE = 'https://api.moonshot.cn/v1/';

  function setStatus(msg, ok=null) {
    const el = document.getElementById('status');
    el.textContent = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
    if (ok === true) { el.classList.add('ok'); el.classList.remove('err'); }
    else if (ok === false) { el.classList.add('err'); el.classList.remove('ok'); }
    else { el.classList.remove('ok','err'); }
  }

  function saveConfig() {
    const cfg = {
      apiSource: val('#apiSource'),
      googleKey: val('#googleKey'),
      googleModel: val('#googleModel'),
      kimiKey: val('#kimiKey'),
      kimiModel: val('#kimiModel'),
      imageQuality: val('#imageQuality'),
      maxImageDimension: val('#maxImageDimension'),
      maxFileSize: val('#maxFileSize')
    };
    localStorage.setItem('apiConfig', JSON.stringify(cfg));
  }
  function restoreConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');
    for (const [k,v] of Object.entries(cfg)) {
      const el = popup.querySelector('#'+k);
      if (el != null && typeof v !== 'undefined') {
  // 如果是模型选择框，但当前下拉框没有这个值 → 自动补充一个 option
  if ((k === 'googleModel' || k === 'kimiModel') && v && ![...el.options].some(o => o.value === v)) {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v + '（已保存）';
    el.appendChild(opt);
  }
  el.value = v;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
    }
    $('#imageQualityValue').text($('#imageQuality').val());
    $('#maxImageDimensionValue').text($('#maxImageDimension').val());
  } catch {}
}  
  function val(sel){ const e = popup.querySelector(sel); return e ? e.value : ''; }
  function bytesToMB(b){ return (b/1048576).toFixed(2); }
  // --- base64 -> 链接工具函数 ---

function getStringHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

async function saveBase64AsLink(base64, filename = 'image.jpg') {
  const base64Data = base64.split(',')[1];
  const extension = filename.split('.').pop() || 'jpg';
  const ctx = window.SillyTavern.getContext();
  const currentCharacterId = ctx.characterId;
  const characters = await ctx.characters;
  const character = characters[currentCharacterId];
  const characterName = character["name"];
  const fileNamePrefix = `${Date.now()}_${getStringHash(filename)}`;
  const url = await saveBase64AsFile(base64Data, characterName, fileNamePrefix, extension);
  return url;
}
  // 监听设置变化
  popup.querySelector('#imageQuality').addEventListener('input', (e)=>{
    popup.querySelector('#imageQualityValue').textContent = e.target.value;
    saveConfig();
  });
  popup.querySelector('#maxImageDimension').addEventListener('input', (e)=>{
    popup.querySelector('#maxImageDimensionValue').textContent = e.target.value;
    saveConfig();
  });
  popup.querySelector('#maxFileSize').addEventListener('change', saveConfig);
  popup.querySelector('#apiSource').addEventListener('change', saveConfig);

  // ---- 新增：显式“选择本地图片/文件”按钮 ----
  popup.querySelector('#chooseImageBtn').addEventListener('click', ()=>{
    popup.querySelector('#imageInput').click();
  });
  popup.querySelector('#chooseDocBtn').addEventListener('click', ()=>{
    popup.querySelector('#docInput').click();
  });

  // 文件选择后提示
  popup.querySelector('#imageInput').addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if (f) setStatus(`已选择图片：${f.name}（${bytesToMB(f.size)} MB）`, true);
  });
  popup.querySelector('#docInput').addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if (f) setStatus(`已选择文件：${f.name}（${bytesToMB(f.size)} MB）`, true);
  });

  // ========== 处理器 ==========
  // 图片处理器（压缩/等比缩放 => base64）
  class ImageProcessor {
    static processImage(fileOrUrl){
      return new Promise((resolve,reject)=>{
        const img=new Image(); img.crossOrigin='anonymous';
        img.onload=()=>{
          let w=img.width, h=img.height;
          const maxDim=parseInt(val('#maxImageDimension')||'1024',10);
          if(w>maxDim || h>maxDim){
            if(w>=h){ h = Math.round(h*maxDim/w); w = maxDim; }
            else { w = Math.round(w*maxDim/h); h = maxDim; }
          }
          const canvas=document.createElement('canvas');
          canvas.width=w; canvas.height=h;
          const ctx=canvas.getContext('2d');
          ctx.drawImage(img,0,0,w,h);
          const quality=parseFloat(val('#imageQuality')||'0.85');
          const base64=canvas.toDataURL('image/jpeg', quality);
          resolve({ success:true, width:w, height:h, base64 });
        };
        img.onerror=()=>reject(new Error('图片加载失败'));
        try{
          if (typeof fileOrUrl === 'string') {
            img.src = fileOrUrl;
          } else {
            img.src = URL.createObjectURL(fileOrUrl);
          }
        }catch(e){ reject(e); }
      });
    }
  }

  // 文档处理器（文本读取）
  class DocumentProcessor {
    static processDocument(file){
      return new Promise((resolve,reject)=>{
        const maxMB = parseFloat(val('#maxFileSize')||'16');
        if (file.size > maxMB*1048576) {
          reject(new Error(`文件过大：${bytesToMB(file.size)} MB（上限 ${maxMB} MB）`));
          return;
        }
        const reader=new FileReader();
        reader.onload = e => resolve({ success:true, content: String(e.target.result || '') });
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsText(file, 'utf-8');
      });
    }
  }

  // ========== 模型拉取 ==========
  async function fetchGoogleModels(){
    try{
      const key = val('#googleKey').trim();
      if(!key) throw new Error('请填写 Google API Key');
      const res = await fetch(GOOGLE_OPENAI_BASE + 'models', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + key }
      });
      const txt = await res.text();
      let data = {};
      try{ data = JSON.parse(txt); }catch{}
      if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);
      const list = Array.isArray(data.data) ? data.data : [];
      if(!list.length) throw new Error('无模型响应：' + txt);

      const sel = popup.querySelector('#googleModel');
      sel.innerHTML = `<option value="">（默认 gemini-2.0-flash）</option>`;
      list.forEach(m=>{
        const id = m.id || m.name || '';
        if(!id) return;
        const opt = document.createElement('option');
        opt.value = id; opt.textContent = id;
        sel.appendChild(opt);
      });
      saveConfig();
      setStatus('✅ Google 模型已更新', true);
    }catch(e){
      setStatus('❌ 拉取 Google 模型失败：' + e.message, false);
    }
  }

  async function fetchKimiModels(){
    try{
      const key = val('#kimiKey').trim();
      if(!key) throw new Error('请填写 Kimi API Key');
      const res = await fetch(KIMI_BASE + 'models', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + key }
      });
      const txt = await res.text();
      let data = {};
      try{ data = JSON.parse(txt); }catch{}
      if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);
      const list = Array.isArray(data.data) ? data.data : [];
      if(!list.length) throw new Error('无模型响应：' + txt);

      const sel = popup.querySelector('#kimiModel');
      sel.innerHTML = `<option value="">（请选择模型）</option>`;
      list.forEach(m=>{
        const id = m.id || m.name || '';
        if(!id) return;
        const opt = document.createElement('option');
        opt.value = id; opt.textContent = id;
        sel.appendChild(opt);
      });
      saveConfig();
      setStatus('✅ Kimi 模型已更新', true);
    }catch(e){
      setStatus('❌ 拉取 Kimi 模型失败：' + e.message, false);
    }
  }

  // ========== API 测试 ==========
  async function testGoogleApi(){
    try{
      const key = val('#googleKey').trim();
      if(!key) throw new Error('请填写 Google API Key');
      const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');
      const model = val('#googleModel') || cfg.googleModel || 'gemini-2.0-flash';
      const url = GOOGLE_OPENAI_BASE + 'chat/completions';
      const body = {
        model,
        messages: [{ role:'user', content:'ping' }]
      };
      const res = await fetch(url, {
        method:'POST',
        headers:{
          'Authorization':'Bearer ' + key,
          'Content-Type':'application/json'
        },
        body: JSON.stringify(body)
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);
      let data = {}; try{ data = JSON.parse(txt); }catch{}
      const content = data?.choices?.[0]?.message?.content || txt;
      setStatus('✅ Google 测试成功：\n' + content, true);
    }catch(e){
      setStatus('❌ Google 测试失败：' + e.message, false);
    }
  }

  async function testKimiApi(){
    try{
      const key = val('#kimiKey').trim();
      if(!key) throw new Error('请填写 Kimi API Key');
      const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');
      const model = val('#kimiModel') || cfg.kimiModel;
      if(!model) throw new Error('请选择 Kimi 模型');
      const url = KIMI_BASE + 'chat/completions';
      const body = {
        model,
        messages: [{ role:'user', content:'ping' }]
      };
      const res = await fetch(url, {
        method:'POST',
        headers:{
          'Authorization':'Bearer ' + key,
          'Content-Type':'application/json'
        },
        body: JSON.stringify(body)
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);
      let data = {}; try{ data = JSON.parse(txt); }catch{}
      const content = data?.choices?.[0]?.message?.content || txt;
      setStatus('✅ Kimi 测试成功：\n' + content, true);
    }catch(e){
      setStatus('❌ Kimi 测试失败：' + e.message, false);
    }
  }

  // ========== 识图与文档识别 ==========
  // 统一提取文本内容
  function extractContentFromChatCompletions(respObj, fallbackText='') {
    try {
      const c = respObj?.choices?.[0];
      if (!c) return fallbackText || JSON.stringify(respObj, null, 2);
      const msg = c.message;
      if (typeof msg?.content === 'string') return msg.content;
      if (Array.isArray(msg?.content)) {
        // OpenAI OAI "content" 数组可能包含多段
        const texts = msg.content.filter(x=>x?.type==='text').map(x=>x.text).filter(Boolean);
        if (texts.length) return texts.join('\n');
        return JSON.stringify(msg.content, null, 2);
      }
      return JSON.stringify(respObj, null, 2);
    } catch {
      return fallbackText || JSON.stringify(respObj, null, 2);
    }
  }

  async function recognizeImageFromAPI(base64){
    const api = val('#apiSource');
    try{
      if(api === 'google'){
        const key = val('#googleKey').trim();
        if(!key) throw new Error('请填写 Google API Key');
        const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');
        const model = val('#googleModel') || cfg.googleModel || 'gemini-2.0-flash';
        const url = GOOGLE_OPENAI_BASE + 'chat/completions';
        const messages = [{
          role: 'user',
          content: [
            { type:'text', text:'请描述这张图片的内容，并提取关键信息。' },
            { type:'image_url', image_url: { url: base64 } }
          ]
        }];
        const res = await fetch(url, {
          method:'POST',
          headers:{
            'Authorization':'Bearer ' + key,
            'Content-Type':'application/json'
          },
          body: JSON.stringify({ model, messages })
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);
        let data={raw:txt}; try{ data=JSON.parse(txt); }catch{}
        const content = extractContentFromChatCompletions(data, txt);
        setStatus('<识图>' + content + '</识图>', true);
        return data;
      } else {
        const key = val('#kimiKey').trim();
        if(!key) throw new Error('请填写 Kimi API Key');
        const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');
        const model = val('#kimiModel') || cfg.kimiModel;
        if(!model) throw new Error('请选择 Kimi 模型');
        const url = KIMI_BASE + 'chat/completions';
        const body = {
          model,
          messages: [{
            role:'user',
            content: [
              { type:'text', text:'请描述这张图片的内容，并提取关键信息。' },
              { type:'image_url', image_url: { url: base64 } }
            ]
          }]
        };
        const res = await fetch(url, {
          method:'POST',
          headers:{
            'Authorization':'Bearer ' + key,
            'Content-Type':'application/json'
          },
          body: JSON.stringify(body)
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);
        let data={raw:txt}; try{ data=JSON.parse(txt); }catch{}
        const content = extractContentFromChatCompletions(data, txt);
        setStatus('<识图>' + content + '</识图>', true);
        return data;
      }
    }catch(e){
      setStatus('❌ 图片识别失败：' + e.message, false);
      throw e;
    }
  }

  async function recognizeDocFromAPI(text){
    const api = val('#apiSource');
    try{
      const contentTrunc = text.length > 20000 ? text.slice(0,20000) : text; // 防止超长
      if(api === 'google'){
        const key = val('#googleKey').trim();
        if(!key) throw new Error('请填写 Google API Key');
        const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');
        const model = val('#googleModel') || cfg.googleModel || 'gemini-2.0-flash';
        const url = GOOGLE_OPENAI_BASE + 'chat/completions';
        const body = {
          model,
          messages: [
            { role:'system', content: '你是一个擅长从文档中提取要点与结构化信息的助手。' },
            { role:'user', content: `请总结并抽取要点：\n\n${contentTrunc}` }
          ]
        };
        const res = await fetch(url, {
          method:'POST',
          headers:{
            'Authorization':'Bearer ' + key,
            'Content-Type':'application/json'
          },
          body: JSON.stringify(body)
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);
        let data={raw:txt}; try{ data=JSON.parse(txt); }catch{}
        const content = extractContentFromChatCompletions(data, txt);
        setStatus('<识文>' + content + '</识文>', true);
        return data;
      } else {
        const key = val('#kimiKey').trim();
        if(!key) throw new Error('请填写 Kimi API Key');
        const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');
        const model = val('#kimiModel') || cfg.kimiModel;
        if(!model) throw new Error('请选择 Kimi 模型');
        const url = KIMI_BASE + 'chat/completions';
        const body = {
          model,
          messages: [
            { role:'system', content: '你是一个擅长从文档中提取要点与结构化信息的助手。' },
            { role:'user', content: `请总结并抽取要点：\n\n${contentTrunc}` }
          ]
        };
        const res = await fetch(url, {
          method:'POST',
          headers:{
            'Authorization':'Bearer ' + key,
            'Content-Type':'application/json'
          },
          body: JSON.stringify(body)
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);
        let data={raw:txt}; try{ data=JSON.parse(txt); }catch{}
        const content = extractContentFromChatCompletions(data, txt);
        setStatus('<识文>' + content + '</识文>', true);
        return data;
      }
    }catch(e){
      setStatus('❌ 文档识别失败：' + e.message, false);
      throw e;
    }
  }

  // ========== UI 交互绑定 ==========
  // 图片：URL 预览
  popup.querySelector('#loadImageBtn').addEventListener('click', ()=>{
    const url = val('#imageUrl');
    if(url){
      const img = popup.querySelector('#imagePreview');
      img.src = url; img.style.display='block';
      setStatus('已加载图片URL', true);
    } else {
      setStatus('请先输入图片 URL', false);
    }
  });

  // 图片：本地处理（压缩/缩放）
  popup.querySelector('#processImageBtn').addEventListener('click', async ()=>{
    const file = popup.querySelector('#imageInput').files[0];
    const url = val('#imageUrl');
    try{
      if(!file && !url) throw new Error('请先选择图片或输入URL');
      const result = await ImageProcessor.processImage(file || url);
      const img = popup.querySelector('#imagePreview');
      img.src = result.base64; img.style.display='block';
      setStatus(`✅ 图片处理成功：${result.width}x${result.height}，base64 长度 ${result.base64.length}`, true);
      saveConfig();
    }catch(e){ setStatus('❌ 图片处理失败：' + e.message, false); }
  });

  // 图片：API 识别
  // 图片：API 识别
popup.querySelector('#recognizeImageBtn').addEventListener('click', async ()=>{
  try{
    // 先拿到可用的 base64（优先本地压缩产物，否则直接读 file/URL）
    const file = popup.querySelector('#imageInput').files[0];
    const url = val('#imageUrl');
    let base64 = popup.querySelector('#imagePreview').src;
    if(!file && !url && !base64) {
      throw new Error('请先处理或加载一张图片');
    }
    if(!base64){
      const processed = await ImageProcessor.processImage(file || url);
      base64 = processed.base64;
      const img = popup.querySelector('#imagePreview'); // 同步预览
      img.src = base64; img.style.display='block';
    }
    await recognizeImageFromAPI(base64);
    saveConfig();
  }catch(e){ /* setStatus 已处理 */ }
});

  // 文档：API 识别
  popup.querySelector('#recognizeDocBtn').addEventListener('click', async ()=>{
    const file = popup.querySelector('#docInput').files[0];
    if(!file){ setStatus('请先选择一个文件', false); return; }
    try{
      const result = await DocumentProcessor.processDocument(file);
      await recognizeDocFromAPI(result.content);
      saveConfig();
    }catch(e){ /* setStatus 已处理 */ }
  });

  // 注入：把状态文本注入到输入框
  // 注入识图结果（文字）
popup.querySelector('#injectImageBtn').addEventListener('click', ()=>{
  const statusText = document.getElementById('status').textContent || '（空结果）';
  injectToTextarea(statusText);
});

// 注入图片链接（Markdown 格式，避免 SlashCommand 解析）
popup.querySelector('#injectImageLinkBtn').addEventListener('click', async ()=>{
  const imgSrc = popup.querySelector('#imagePreview').src;
  if (imgSrc && imgSrc.startsWith('data:image/')) {
    try {
      const url = await saveBase64AsLink(imgSrc, 'sma_image.jpg');
      injectToTextarea(`![图片](${url})`);
    } catch (e) {
      setStatus('❌ 保存图片失败：' + e.message, false);
    }
  } else {
    setStatus('❌ 未处理图片，无法注入链接', false);
  }
});
  popup.querySelector('#injectDocBtn').addEventListener('click', ()=>{
    injectToTextarea(document.getElementById('status').textContent || '（空结果）');
  });

  // 模型拉取与测试
  popup.querySelector('#fetchGoogleModels').addEventListener('click', fetchGoogleModels);
  popup.querySelector('#fetchKimiModels').addEventListener('click', fetchKimiModels);
  popup.querySelector('#testGoogleApi').addEventListener('click', testGoogleApi);
  popup.querySelector('#testKimiApi').addEventListener('click', testKimiApi);

  // API Key / 模型 变更时保存
  popup.querySelector('#googleKey').addEventListener('change', saveConfig);
  popup.querySelector('#googleModel').addEventListener('change', saveConfig);
  popup.querySelector('#kimiKey').addEventListener('change', saveConfig);
  popup.querySelector('#kimiModel').addEventListener('change', saveConfig);

  // 结果注入输入框
  function injectToTextarea(text) {
    const ta = document.querySelector('#send_textarea');
    if (ta) {
      const sep = ta.value && !ta.value.endsWith('\n') ? '\n' : '';
      ta.value = ta.value + sep + text;
      ta.classList.add('sma-injected');
      setTimeout(() => ta.classList.remove('sma-injected'), 800);
    }
  }
}