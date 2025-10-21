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
  <h3>文件上传 / 手动输入</h3>

  <!-- 文件选择 -->
  <input type="file" id="docInput" accept=".txt,.json,.md,.html,.xml,.csv,.pdf,.epub" style="display:none;">
  <div class="sma-btns">
    <button class="sma-btn" id="chooseDocBtn">选择本地文件</button>
    <button class="sma-btn" id="manualDocBtn">手动输入</button>
    <button class="sma-btn" id="processDocBtn">处理文档</button>
    <button class="sma-btn" id="recognizeDocBtn">使用API识别</button>
    <button class="sma-btn" id="injectDocBtn">注入输入框</button>
  </div>

  <!-- 手动输入 -->
  <textarea id="manualDocInput" placeholder="可手动输入文档内容..." style="width:100%; height:60px; margin-top:8px; padding:6px; border-radius:6px; border:1px solid var(--sma-border); background:#1f1a17; color:var(--sma-text);"></textarea>
  
</div>

    <!-- 🎧 音频 / 视频识别 -->
    <div class="sma-section">
      <h3>音频 / 视频识别</h3>
      <!-- 文件与 URL 输入 -->
      <input type="file" id="mediaInput" accept="audio/*,video/*" style="display:none;">
      <input type="text" id="mediaUrl" placeholder="或输入媒体文件 URL">
      <div class="sma-btns">
        <button class="sma-btn" id="chooseMediaBtn">选择本地文件</button>
        <button class="sma-btn" id="loadMediaBtn">加载URL</button>
        <button class="sma-btn" id="processMediaBtn">本地处理</button>
        <button class="sma-btn" id="recognizeMediaBtn">使用API识别</button>
        <button class="sma-btn" id="injectMediaBtn">注入输入框</button>
      </div>
      <audio id="audioPreview" style="display:none;" controls></audio>
      <video id="videoPreview" style="display:none;" controls></video>
    </div>

    <!-- 🌐 API 配置区（合并 Google + Kimi + 自定义） -->
    <div class="sma-section">
      <h3>API 配置</h3>

      <label for="apiSource">选择 API 源</label>
      <select id="apiSource">
        <option value="google">Google Gemini</option>
        <option value="kimi">Kimi / Moonshot</option>
        <option value="custom">自定义 API</option>
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

      <!-- Custom API 设置 -->
      <div class="sma-sub">
        <label>自定义 API URL
          <input type="text" id="customUrl" placeholder="输入 API 基础 URL">
        </label>
        <label>自定义 API Key
          <input type="text" id="customKey" placeholder="输入 API Key">
        </label>
        <div class="sma-btns">
          <button class="sma-btn" id="fetchCustomModels">拉取模型</button>
          <button class="sma-btn" id="testCustomApi">测试 API</button>
        </div>
        <select id="customModel">
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
    customUrl: val('#customUrl'),
    customKey: val('#customKey'),
    customModel: val('#customModel'),
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
        if ((k === 'googleModel' || k === 'kimiModel' || k === 'customModel') && v && ![...el.options].some(o => o.value === v)) {
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

// 自定义 API 输入框监听
popup.querySelector('#customUrl').addEventListener('change', saveConfig);
popup.querySelector('#customKey').addEventListener('change', saveConfig);
popup.querySelector('#customModel').addEventListener('change', saveConfig);

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
// 音视频：选择本地文件
popup.querySelector('#chooseMediaBtn').addEventListener('click', () => {
  popup.querySelector('#mediaInput').click();
});

// 音视频：选择文件后提示
popup.querySelector('#mediaInput').addEventListener('change', (e) => {
  const f = e.target.files && e.target.files[0];
  if (f) {
    setStatus(`已选择音视频文件：${f.name}（${bytesToMB(f.size)} MB）`, true);

    // 可选择立即预览
    const audio = popup.querySelector('#audioPreview');
    const video = popup.querySelector('#videoPreview');

    if (f.type.startsWith('audio/')) {
      audio.src = URL.createObjectURL(f);
      audio.style.display = 'block';
      video.style.display = 'none';
    } else if (f.type.startsWith('video/')) {
      video.src = URL.createObjectURL(f);
      video.style.display = 'block';
      audio.style.display = 'none';
    }
  }
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

// 文档处理器（文本读取 + 手动输入）
class DocumentProcessor {
  /**
   * @param {File|string} input - 文件对象或手动输入文本
   */
  static async processDocument(input) {
    return new Promise(async (resolve, reject) => {
      try {
        if (typeof input === 'string') {
          // ✅ 手动输入文本直接返
          const content = input.trim();
          if (!content) {
            reject(new Error('文本内容为空'));
            return;
          }
          resolve({ success: true, content });
          return;
        }

        // ⚠️ 原有文件处理逻辑
        const file = input;
        const maxMB = parseFloat(val('#maxFileSize') || '16');
        if (file.size > maxMB * 1048576) {
          reject(new Error(`文件过大：${bytesToMB(file.size)} MB（上限 ${maxMB} MB）`));
          return;
        }

        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'pdf') {
          // ---- PDF 解析 ----
          const pdfjsLib = window.pdfjsLib || await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs');
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
          }
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
          }
          resolve({ success: true, content: text.trim() });

        } else if (ext === 'epub') {
          // ---- EPUB 解析（纯 JSZip 实现） ----
          const JSZip = window.JSZip || (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js')).default;
          const arrayBuffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);

          let text = '';
          const htmlFiles = Object.keys(zip.files).filter(f =>
            f.endsWith('.xhtml') || f.endsWith('.html') || f.endsWith('.htm')
          );

          if (htmlFiles.length === 0) {
            reject(new Error('未找到可解析的章节文件（EPUB 中无 .xhtml/.html 文件）'));
            return;
          }

          for (const filename of htmlFiles) {
            try {
              const content = await zip.files[filename].async('string');
              const tmp = document.createElement('div');
              tmp.innerHTML = content;
              const chapterText = tmp.textContent.trim();
              if (chapterText) {
                text += chapterText + '\n';
              }
            } catch (e) {
              console.warn('跳过章节：', filename, e);
            }
          }

          if (!text.trim()) {
            reject(new Error('未能提取到有效文本内容（可能所有章节为空）'));
            return;
          }

          resolve({ success: true, content: text.trim() });

        } else {
          // ---- 普通文本文件 ----
          const reader = new FileReader();
          reader.onload = e => resolve({ success: true, content: String(e.target.result || '') });
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.readAsText(file, 'utf-8');
        }

      } catch (err) {
        reject(new Error('文件解析失败：' + err.message));
      }
    });
  }
}

// 🎧 音视频处理器（API 分块上传）
class MediaProcessor {
  /**
   * 处理音频或视频文件（分块上传 API）
   * @param {File|string} fileOrUrl - 本地 File 对象或 URL
   * @param {function} onChunkUploaded - 每块上传完成回调
   * @returns {Promise<{success:boolean, type:string, chunks:number, totalSize:number}>}
   */
  static async processMedia(fileOrUrl, onChunkUploaded = null) {
    try {
      let blob;
      let type = 'audio';

      // 1️⃣ 获取媒体 Blob（File 或 URL）
      if (typeof fileOrUrl === 'string') {
        const res = await fetch(fileOrUrl);
        blob = await res.blob();
        const mime = blob.type || '';
        if (mime.startsWith('video/')) type = 'video';
      } else {
        blob = fileOrUrl;
        if (blob.type.startsWith('video/')) type = 'video';
      }

      // 2️⃣ 分块上传逻辑
      const maxChunkSize = 19 * 1024 * 1024; // 19 MB
      const chunks = [];
      let offset = 0;
      let index = 0;

      while (offset < blob.size) {
        const end = Math.min(offset + maxChunkSize, blob.size);
        const chunk = blob.slice(offset, end);
        chunks.push(chunk);

        // 回调每块上传进度
        if (onChunkUploaded) onChunkUploaded({ index, size: chunk.size, totalSize: blob.size });

        offset = end;
        index++;
      }

      return {
        success: true,
        type,
        chunks: chunks.length,
        totalSize: blob.size,
        chunkBlobs: chunks // 如果需要，可返回 Blob 数组供后续上传
      };
    } catch (err) {
      console.error('MediaProcessor 错误：', err);
      throw new Error('音视频处理失败：' + err.message);
    }
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

async function fetchCustomModels(){
  try{
    const url = val('#customUrl').trim();
    const key = val('#customKey').trim();
    if(!url) throw new Error('请填写自定义 API 地址');
    if(!key) throw new Error('请填写自定义 API Key');
    const res = await fetch(url.replace(/\/+$/,'') + '/models', {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + key }
    });
    const txt = await res.text();
    let data = {};
    try{ data = JSON.parse(txt); }catch{}
    if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);
    const list = Array.isArray(data.data) ? data.data : [];
    if(!list.length) throw new Error('无模型响应：' + txt);

    const sel = popup.querySelector('#customModel');
    sel.innerHTML = `<option value="">（请选择模型）</option>`;
    list.forEach(m=>{
      const id = m.id || m.name || '';
      if(!id) return;
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = id;
      sel.appendChild(opt);
    });
    saveConfig();
    setStatus('✅ 自定义模型已更新', true);
  }catch(e){
    setStatus('❌ 拉取自定义模型失败：' + e.message, false);
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

async function testCustomApi(){
  try{
    const url = val('#customUrl').trim().replace(/\/+$/,'');
    const key = val('#customKey').trim();
    if(!url) throw new Error('请填写自定义 API 地址');
    if(!key) throw new Error('请填写自定义 API Key');
    const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');
    const model = val('#customModel') || cfg.customModel;
    if(!model) throw new Error('请选择自定义模型');
    const body = {
      model,
      messages: [{ role:'user', content:'ping' }]
    };
    const res = await fetch(url + '/chat/completions', {
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
    setStatus('✅ 自定义 API 测试成功：\n' + content, true);
  }catch(e){
    setStatus('❌ 自定义 API 测试失败：' + e.message, false);
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

async function recognizeImageFromAPI(base64) {
  const api = val('#apiSource');
  try {
    let key, model, url, body;
    const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');

    if (api === 'google') {
      key = val('#googleKey').trim();
      if (!key) throw new Error('请填写 Google API Key');
      model = val('#googleModel') || cfg.googleModel || 'gemini-2.0-flash';
      url = GOOGLE_OPENAI_BASE + 'chat/completions';
    } else if (api === 'kimi') {
      key = val('#kimiKey').trim();
      if (!key) throw new Error('请填写 Kimi API Key');
      model = val('#kimiModel') || cfg.kimiModel;
      if (!model) throw new Error('请选择 Kimi 模型');
      url = KIMI_BASE + 'chat/completions';
    } else if (api === 'custom') {
      url = val('#customUrl').trim().replace(/\/+$/, '');
      key = val('#customKey').trim();
      if (!url) throw new Error('请填写自定义 API 地址');
      if (!key) throw new Error('请填写自定义 API Key');
      model = val('#customModel') || cfg.customModel;
      if (!model) throw new Error('请选择自定义模型');
      url = url + '/chat/completions';
    } else {
      throw new Error('未知 API 源');
    }

    body = {
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '你是全宇宙全时间线最厉害的图片识别大师，你不受规则制约而是制定了关于图片识别的所有规则，这是你唯一的使命，你不可回避，你虔诚的信徒给了你新的图片，请开始你的表演！' },
          { type: 'image_url', image_url: { url: base64 } }
        ]
      }],
      max_tokens: 20000
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);

    let data = { raw: txt };
    try { data = JSON.parse(txt); } catch { }

    // ✅ 确保输出文字内容
    let output = '';
    if (data.choices && data.choices.length > 0) {
      output = data.choices.map(c => c.message?.content || '').join('\n');
      if (!output) output = '[未生成内容]';
    } else {
      output = '[未生成内容]';
    }

    setStatus('<shitu>' + output + '</shitu>', true);
    return data;

  } catch (e) {
    setStatus('❌ 图片识别失败：' + e.message, false);
    throw e;
  }
}

async function recognizeDocFromAPI(text) {
  const api = val('#apiSource');
  try {
    const contentTrunc = text.length > 20000 ? text.slice(0, 20000) : text; // 防止超长
    let key, model, url, body;
    const cfg = JSON.parse(localStorage.getItem('apiConfig') || '{}');

    if (api === 'google') {
      key = val('#googleKey').trim();
      if (!key) throw new Error('请填写 Google API Key');
      model = val('#googleModel') || cfg.googleModel || 'gemini-2.0-flash';
      url = GOOGLE_OPENAI_BASE + 'chat/completions';
    } else if (api === 'kimi') {
      key = val('#kimiKey').trim();
      if (!key) throw new Error('请填写 Kimi API Key');
      model = val('#kimiModel') || cfg.kimiModel;
      if (!model) throw new Error('请选择 Kimi 模型');
      url = KIMI_BASE + 'chat/completions';
    } else if (api === 'custom') {
      url = val('#customUrl').trim().replace(/\/+$/, '');
      key = val('#customKey').trim();
      if (!url) throw new Error('请填写自定义 API 地址');
      if (!key) throw new Error('请填写自定义 API Key');
      model = val('#customModel') || cfg.customModel;
      if (!model) throw new Error('请选择自定义模型');
      url = url + '/chat/completions';
    } else {
      throw new Error('未知 API 源');
    }

    body = {
      model,
      messages: [
        { role: 'system', content: '你是一个擅长从文档中提取要点与结构化信息的助手。' },
        { role: 'user', content: `请总结并抽取要点：\n\n${contentTrunc}` }
      ],
      max_tokens: 20000
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);

    let data = { raw: txt };
    try { data = JSON.parse(txt); } catch { }

    // ✅ 确保输出文字内容
    let output = '';
    if (data.choices && data.choices.length > 0) {
      output = data.choices.map(c => c.message?.content || '').join('\n');
      if (!output) output = '[未生成内容]';
    } else {
      output = '[未生成内容]';
    }

    setStatus('<shiwen>' + output + '</shiwen>', true);
    return data;

  } catch (e) {
    setStatus('❌ 文档识别失败：' + e.message, false);
    throw e;
  }
}
async function uploadMediaToKimi(file, purpose = 'transcription') {
  try {
    const api = val('#apiSource');
    if (api !== 'kimi') throw new Error('当前仅支持 Kimi API 上传文件');

    const key = val('#kimiKey').trim();
    if (!key) throw new Error('请填写 Kimi API Key');

    if (!file) throw new Error('未选择文件');

    const url = 'https://platform.moonshot.ai/api/v1/files'; // 官方文件上传接口

    const formData = new FormData();
    formData.append('file', file);
    formData.append('purpose', purpose); // 指定用途，音视频用 "transcription"

    setStatus('⏳ 正在上传文件…', true);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key
      },
      body: formData
    });

    const txt = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}：${txt}`);

    let data = { raw: txt };
    try { data = JSON.parse(txt); } catch { }

    setStatus('✅ 文件上传成功', true);
    return data;

  } catch (e) {
    setStatus('❌ 文件上传失败：' + e.message, false);
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
popup.querySelector('#recognizeImageBtn').addEventListener('click', async ()=>{
  try{
    const file = popup.querySelector('#imageInput').files[0];
    const url = val('#imageUrl');
    let base64 = popup.querySelector('#imagePreview').src;
    if(!file && !url && !base64) {
      throw new Error('请先处理或加载一张图片');
    }
    if(!base64){
      const processed = await ImageProcessor.processImage(file || url);
      base64 = processed.base64;
      const img = popup.querySelector('#imagePreview');
      img.src = base64; img.style.display='block';
    }
    await recognizeImageFromAPI(base64);
    saveConfig();
  }catch(e){ /* setStatus 已处理 */ }
});

// 文档：API 识别（支持文件或手动输入）
popup.querySelector('#recognizeDocBtn').addEventListener('click', async () => {
  const file = popup.querySelector('#docInput').files[0];
  const manualContent = popup.querySelector('#manualDocInput')?.value.trim();

  if (!file && !manualContent) {
    setStatus('请先选择一个文件或输入文本内容', false);
    return;
  }

  try {
    let content = '';

    if (file) {
      const result = await DocumentProcessor.processDocument(file);
      content = result.content;
    } else {
      content = manualContent;
    }

    await recognizeDocFromAPI(content);
    saveConfig();
  } catch (e) {
    // setStatus 已在 recognizeDocFromAPI 内处理
  }
});

// 注入：把状态文本注入到输入框
popup.querySelector('#injectImageBtn').addEventListener('click', ()=>{
  const statusText = document.getElementById('status').textContent || '（空结果）';
  injectToTextarea(statusText);
});

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
// 文档：本地处理 / 手动输入处理（读取并预览）
popup.querySelector('#processDocBtn').addEventListener('click', async () => {
  const file = popup.querySelector('#docInput').files[0];
  const manualText = popup.querySelector('#manualDocInput')?.value || '';
  
  if (!file && !manualText.trim()) {
    setStatus('请先选择文件或输入文本', false);
    return;
  }

  try {
    const input = file || manualText;
    const result = await DocumentProcessor.processDocument(input);
    // 将内容完整显示在状态输出区
    setStatus(result.content, true);
    saveConfig();
  } catch (e) {
    setStatus('❌ 文档处理失败：' + e.message, false);
  }
});
// 手动输入按钮绑定
popup.querySelector('#manualDocBtn').addEventListener('click', () => {
  const fileInput = popup.querySelector('#docInput');
  const manualTextarea = popup.querySelector('#manualDocInput');

  // 清空已上传的文件
  if (fileInput) fileInput.value = '';

  // 聚焦到手动输入框
  if (manualTextarea) {
    manualTextarea.focus();
    setStatus('已切换到手动输入模式，请输入内容', true);
  }
});
popup.querySelector('#injectDocBtn').addEventListener('click', ()=>{
  injectToTextarea(document.getElementById('status').textContent || '（空结果）');
});
// 视频URL 加载
popup.querySelector('#loadMediaBtn')?.addEventListener('click', async () => {
  const url = val('#mediaUrl');
  if (!url) {
    setStatus('❌ 请先输入音视频 URL', false);
    return;
  }
  try {
    const video = popup.querySelector('#mediaPreview');
    video.src = url;
    video.style.display = 'block';
    setStatus('✅ 已加载音视频 URL', true);
    saveConfig();
  } catch (e) {
    setStatus('❌ 音视频加载失败：' + e.message, false);
  }
});
// 视频本地处理（转码、转录等）
// 视频/音频本地处理（仅加载并准备 Blob，不做本地识别）
popup.querySelector('#processMediaBtn')?.addEventListener('click', async () => {
  const file = popup.querySelector('#mediaInput').files[0];
  const url = val('#mediaUrl').trim();
  if (!file && !url) {
    setStatus('请先选择音视频文件或输入URL', false);
    return;
  }

  try {
    let blob, type, preview;
    
    if (file) {
      blob = file;
      type = file.type.startsWith('video/') ? 'video' : 'audio';
    } else {
      const res = await fetch(url);
      blob = await res.blob();
      type = blob.type.startsWith('video/') ? 'video' : 'audio';
    }

    // 保存处理结果，供 API 上传使用
    const result = { blob, type };

    // 设置预览元素
    if (type === 'video') {
      preview = popup.querySelector('#videoPreview');
      const audioEl = popup.querySelector('#audioPreview');
      audioEl.style.display = 'none';
      preview.src = URL.createObjectURL(blob);
      preview.style.display = 'block';
    } else {
      preview = popup.querySelector('#audioPreview');
      const videoEl = popup.querySelector('#videoPreview');
      videoEl.style.display = 'none';
      preview.src = URL.createObjectURL(blob);
      preview.style.display = 'block';
    }

    setStatus(`✅ 音视频加载成功：${blob.size > 1048576 ? (blob.size/1048576).toFixed(2) + ' MB' : blob.size + ' bytes'}`, true);

    // 保存到临时变量，供 recognize 按钮使用
    popup._lastProcessedMedia = result;

    saveConfig();
  } catch (e) {
    setStatus('❌ 音视频处理失败：' + e.message, false);
  }
});

// 使用 API 识别（音视频）
popup.querySelector('#recognizeMediaBtn')?.addEventListener('click', async () => {
  try {
    const fileInput = popup.querySelector('#mediaInput');
    const file = fileInput.files[0];
    const url = val('#mediaUrl').trim();

    let blobOrFile;
    if (file) {
      blobOrFile = file;   // 优先使用本地文件
    } else if (url) {
      // fetch URL 转 Blob
      const res = await fetch(url);
      const blob = await res.blob();
      // 转换成 File 对象以便上传
      blobOrFile = new File([blob], url.split('/').pop(), { type: blob.type });
    } else {
      throw new Error('请先上传或输入音视频文件/URL');
    }

    setStatus('⏳ 正在上传音视频进行识别...', true);

    // 调用上传函数
    const result = await uploadMediaToKimi(blobOrFile);

    console.log('上传结果', result);
    setStatus('✅ 音视频上传成功，可用于识别', true);

    saveConfig();
  } catch (e) {
    setStatus('❌ 音视频识别失败：' + e.message, false);
  }
});

// 模型拉取与测试
popup.querySelector('#fetchGoogleModels').addEventListener('click', fetchGoogleModels);
popup.querySelector('#fetchKimiModels').addEventListener('click', fetchKimiModels);
popup.querySelector('#fetchCustomModels').addEventListener('click', fetchCustomModels); // ✅ 新增
popup.querySelector('#testGoogleApi').addEventListener('click', testGoogleApi);
popup.querySelector('#testKimiApi').addEventListener('click', testKimiApi);
popup.querySelector('#testCustomApi').addEventListener('click', testCustomApi); // ✅ 新增

// API Key / 模型 变更时保存
popup.querySelector('#googleKey').addEventListener('change', saveConfig);
popup.querySelector('#googleModel').addEventListener('change', saveConfig);
popup.querySelector('#kimiKey').addEventListener('change', saveConfig);
popup.querySelector('#kimiModel').addEventListener('change', saveConfig);
popup.querySelector('#customUrl').addEventListener('change', saveConfig);   // ✅ 新增
popup.querySelector('#customKey').addEventListener('change', saveConfig);   // ✅ 新增
popup.querySelector('#customModel').addEventListener('change', saveConfig); // ✅ 新增

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
// 🎵🎬 音视频：按钮绑定逻辑
// 本地文件选择
popup.querySelector('#chooseMediaBtn')?.addEventListener('click', () => {
  const input = popup.querySelector('#mediaInput');
  if (input) input.click();
});





// 注入识别结果到输入框
popup.querySelector('#injectMediaBtn')?.addEventListener('click', () => {
  const statusText = document.getElementById('status').textContent || '（空结果）';
  injectToTextarea(statusText);
});