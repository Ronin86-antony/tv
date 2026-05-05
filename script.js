/* ==========================================
   Impex TV Compatibility Checker – Script
   ========================================== */

// ===== Compatibility Rules for Impex 32" Non-Smart LED TV =====
const TV_RULES = {
  containers: {
    supported:   ['mp4', 'mkv', 'avi', 'ts', 'm4v', 'mpeg'],
    conditional: ['mov', 'wmv'],     // may work but not guaranteed
    unsupported: ['flv', 'rmvb', 'rm', 'vob', 'webm', 'ogv', 'asf']
  },
  videoCodecs: {
    supported:   ['h264', 'avc', 'mpeg4', 'xvid', 'divx', 'mpeg2', 'mpeg1'],
    conditional: ['wmv', 'vc-1', 'vc1', 'wmv3', 'wvc1'],
    unsupported: ['h265', 'hevc', 'av1', 'vp9', 'vp8', 'vp6', 'theora', 'rv40']
  },
  audioCodecs: {
    supported:   ['aac', 'mp3', 'ac3', 'pcm', 'lpcm', 'mp2'],
    conditional: ['eac3', 'ec-3'],   // may or may not play
    unsupported: ['dts', 'truehd', 'atmos', 'flac', 'opus', 'vorbis', 'alac']
  },
  maxWidthPx: 1920,
  maxHeightPx: 1080,
  maxFileSizeBytes: 4 * 1024 * 1024 * 1024  // 4 GB FAT32 limit
};

// ===== Helper: classify a value against the rules =====
function classify(value, ruleSet) {
  if (!value) return 'unknown';
  const v = value.toLowerCase().trim();
  if (ruleSet.supported.some(s => v.includes(s)))   return 'ok';
  if (ruleSet.conditional.some(s => v.includes(s))) return 'warn';
  if (ruleSet.unsupported.some(s => v.includes(s))) return 'ng';
  return 'unknown';
}

// ===== Tab Switcher =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('section-' + tab).classList.add('active');
}

// ===== File size formatter =====
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ===== Render Result =====
function renderResult(containerId, checks, overallStatus, tips) {
  const container = document.getElementById(containerId);
  const statusMap = {
    pass: { emoji: '✅', title: 'Compatible! Will Play on Impex TV', cls: 'pass' },
    fail: { emoji: '❌', title: 'Not Compatible – May Not Play', cls: 'fail' },
    warn: { emoji: '⚠️', title: 'Likely Compatible – With Caution', cls: 'warn' }
  };
  const s = statusMap[overallStatus];

  let itemsHtml = checks.map(c => {
    const icon = c.status === 'ok' ? '✅' : c.status === 'ng' ? '❌' : c.status === 'warn' ? '⚠️' : 'ℹ️';
    const statusText = c.status === 'ok' ? 'Supported' : c.status === 'ng' ? 'Unsupported' : c.status === 'warn' ? 'May Work' : 'Unknown';
    return `
      <li>
        <span class="detail-icon">${icon}</span>
        <span class="detail-label">${c.label}</span>
        <span class="detail-value">${c.value || '—'}</span>
        <span class="detail-status ${c.status}">${statusText}</span>
      </li>`;
  }).join('');

  let tipsHtml = tips && tips.length > 0
    ? `<div class="result-tip"><strong>💡 Tips:</strong> ${tips.join(' | ')}</div>`
    : '';

  container.innerHTML = `
    <div class="result-panel ${s.cls}">
      <div class="result-header">
        <span class="result-badge">${s.emoji}</span>
        <span class="result-title">${s.title}</span>
      </div>
      <ul class="result-detail-list">${itemsHtml}</ul>
      ${tipsHtml}
    </div>`;
}

// ===== Determine overall status from checks =====
function deriveOverall(checks) {
  const hasNg      = checks.some(c => c.status === 'ng');
  const hasWarn    = checks.some(c => c.status === 'warn');
  const hasUnknown = checks.some(c => c.status === 'unknown');
  if (hasNg) return 'fail';
  if (hasWarn || hasUnknown) return 'warn';
  return 'pass';
}

// ===== Tips Generator =====
function buildTips(checks, fileInfo) {
  const tips = [];
  const ng   = checks.filter(c => c.status === 'ng');
  const warn = checks.filter(c => c.status === 'warn');

  ng.forEach(c => {
    if (c.label === 'Video Codec') tips.push('Re-encode video to H.264 using HandBrake (free).');
    if (c.label === 'Audio Codec') tips.push('Convert audio to AAC or AC3 using HandBrake or FFmpeg.');
    if (c.label === 'Resolution')  tips.push('Downscale video to 1080p or lower.');
    if (c.label === 'Container')   tips.push('Convert to MP4 container using HandBrake or VLC.');
  });
  warn.forEach(c => {
    if (c.label === 'Container')   tips.push('MOV/WMV compatibility varies – consider converting to MP4.');
    if (c.label === 'Audio Codec') tips.push('EAC3 audio support is not guaranteed; test on your TV first.');
    if (c.label === 'File Size')   tips.push('File may not copy to FAT32 pendrive. Format pendrive as NTFS instead.');
  });
  if (fileInfo && fileInfo.size > TV_RULES.maxFileSizeBytes) {
    tips.push('If your pendrive is FAT32 formatted, files over 4GB cannot be stored. Format as NTFS on Windows.');
  }

  return [...new Set(tips)]; // deduplicate
}

// ===== Manual Check =====
function checkManual() {
  const container  = document.getElementById('sel-container').value;
  const vCodec     = document.getElementById('sel-vcodec').value;
  const aCodec     = document.getElementById('sel-acodec').value;
  const resolution = document.getElementById('sel-resolution').value;
  const fileSize   = document.getElementById('sel-filesize').value;

  if (!container && !vCodec && !aCodec && !resolution) {
    alert('Please select at least one field to check compatibility.');
    return;
  }

  const checks = [];
  const tips   = [];

  // Container
  if (container) {
    const st = classify(container, TV_RULES.containers);
    checks.push({ label: 'Container', value: container.toUpperCase(), status: st });
  }

  // Video Codec
  if (vCodec) {
    const st = classify(vCodec, TV_RULES.videoCodecs);
    const displayName = {
      h264: 'H.264 / AVC', h265: 'H.265 / HEVC', mpeg4: 'MPEG-4 / Xvid',
      mpeg2: 'MPEG-2', av1: 'AV1', vp9: 'VP9', vp8: 'VP8',
      wmv: 'WMV / VC-1', other: 'Unknown'
    }[vCodec] || vCodec;
    checks.push({ label: 'Video Codec', value: displayName, status: st });
  }

  // Audio Codec
  if (aCodec) {
    const st = classify(aCodec, TV_RULES.audioCodecs);
    const displayName = {
      aac: 'AAC', mp3: 'MP3', ac3: 'AC3 / Dolby Digital', dts: 'DTS',
      truehd: 'Dolby TrueHD', flac: 'FLAC', pcm: 'PCM / LPCM',
      eac3: 'EAC3 / DD+', opus: 'Opus', other: 'Unknown'
    }[aCodec] || aCodec;
    checks.push({ label: 'Audio Codec', value: displayName, status: st });
  }

  // Resolution
  if (resolution) {
    const res = parseInt(resolution);
    let st = 'ok';
    let val = resolution + 'p';
    if (res > 1080) { st = 'ng'; val = resolution + 'p (Too High)'; }
    checks.push({ label: 'Resolution', value: val, status: st });
  }

  // File Size
  if (fileSize) {
    let st = 'ok';
    const val = { small: '< 2 GB', medium: '2–4 GB', large: '> 4 GB' }[fileSize];
    if (fileSize === 'large') { st = 'warn'; }
    checks.push({ label: 'File Size', value: val, status: st });
  }

  const overall = deriveOverall(checks);
  renderResult('manualResult', checks, overall, buildTips(checks, null));

  // Scroll to result
  setTimeout(() => {
    document.getElementById('manualResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

// ===== File Drop Logic =====
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', e => {
  if (e.target.files.length) processFile(e.target.files[0]);
});

function clearFile() {
  fileInput.value = '';
  document.getElementById('fileInfoStrip').classList.add('hidden');
  document.getElementById('dropZone').classList.remove('hidden');
  document.getElementById('fileResult').innerHTML = '';
  document.getElementById('loadingState').classList.add('hidden');
}

async function processFile(file) {
  // Show loading state
  dropZone.classList.add('hidden');
  document.getElementById('loadingState').classList.remove('hidden');
  document.getElementById('fileResult').innerHTML = '';

  // Short delay for UX
  await new Promise(r => setTimeout(r, 150));

  // Show file info
  document.getElementById('fileName').textContent = file.name;
  document.getElementById('fileSize').textContent = formatBytes(file.size);
  document.getElementById('fileInfoStrip').classList.remove('hidden');
  document.getElementById('loadingState').classList.add('hidden');

  // Extract extension
  const ext = (file.name.split('.').pop() || '').toLowerCase();

  // Try MediaInfo.js to read full metadata
  if (typeof MediaInfo !== 'undefined') {
    try {
      await analyzeWithMediaInfo(file, ext);
      return;
    } catch (e) {
      console.warn('MediaInfo failed, falling back to basic check:', e);
    }
  }

  // Fallback: basic extension + size check
  analyzeBasic(file, ext);
}

// ===== Full Analysis with MediaInfo.js =====
async function analyzeWithMediaInfo(file, ext) {
  return new Promise((resolve, reject) => {
    MediaInfo({ format: 'JSON' }, (mediainfo, error) => {
      if (error) { reject(error); return; }

      const chunkSize = 1024 * 1024; // 1MB chunks
      let offset = 0;

      const readChunk = (size, _offset) => {
        return new Promise(res => {
          const reader = new FileReader();
          const blob = file.slice(_offset, _offset + size);
          reader.onload = e => res(new Uint8Array(e.target.result));
          reader.readAsArrayBuffer(blob);
        });
      };

      mediainfo.analyzeData(
        () => file.size,
        async (chunkSize, currentOffset) => {
          const chunk = await readChunk(chunkSize, currentOffset);
          return chunk;
        }
      ).then(result => {
        try {
          const info = typeof result === 'string' ? JSON.parse(result) : result;
          const tracks = (info.media && info.media.track) ? info.media.track : [];

          const generalTrack = tracks.find(t => t['@type'] === 'General') || {};
          const videoTrack   = tracks.find(t => t['@type'] === 'Video')   || {};
          const audioTrack   = tracks.find(t => t['@type'] === 'Audio')   || {};

          // Extract info
          const containerFmt  = (generalTrack.Format || ext || '').toLowerCase();
          const videoCodecRaw = (videoTrack.Format || '').toLowerCase();
          const audioCodecRaw = (audioTrack.Format || '').toLowerCase();
          const width         = parseInt(videoTrack.Width)  || 0;
          const height        = parseInt(videoTrack.Height) || 0;
          const durSec        = parseFloat(generalTrack.Duration) || 0;
          const bitrate       = parseInt(generalTrack.OverallBitRate) || 0;

          const checks = buildChecks({
            container:  containerFmt,
            vCodecRaw:  videoCodecRaw,
            aCodecRaw:  audioCodecRaw,
            width, height,
            fileSize: file.size,
            ext,
            videoProfile: (videoTrack.Format_Profile || '').toLowerCase(),
            videoLevel:   videoTrack.Format_Level || ''
          });

          const overall = deriveOverall(checks);
          const tipList = buildTips(checks, { size: file.size });
          renderResult('fileResult', checks, overall, tipList);
        } catch (parseErr) {
          console.warn('MediaInfo parse error, falling back:', parseErr);
          analyzeBasic(file, ext);
        }
        resolve();
      }).catch(err => {
        reject(err);
      });
    });
  });
}

// ===== Build Checks from Extracted Info =====
function buildChecks({ container, vCodecRaw, aCodecRaw, width, height, fileSize, ext, videoProfile, videoLevel }) {
  const checks = [];

  // Container / File Format
  const containerName = container || ext;
  const containerStatus = classify(containerName, TV_RULES.containers);
  checks.push({ label: 'Container', value: (container || ext).toUpperCase(), status: containerStatus });

  // Video codec
  let vStatus = 'unknown';
  let vDisplay = vCodecRaw || 'Unknown';
  if (vCodecRaw) {
    if (vCodecRaw.includes('avc') || vCodecRaw.includes('h264') || vCodecRaw.includes('h.264')) {
      // Check for High 10-bit profile
      if (videoProfile && (videoProfile.includes('10') || videoProfile.includes('high 10'))) {
        vStatus = 'warn'; vDisplay = 'H.264 (10-bit – may not play)';
      } else {
        vStatus = 'ok'; vDisplay = 'H.264 / AVC';
      }
    } else if (vCodecRaw.includes('hevc') || vCodecRaw.includes('h265') || vCodecRaw.includes('h.265')) {
      vStatus = 'ng'; vDisplay = 'H.265 / HEVC';
    } else if (vCodecRaw.includes('xvid') || vCodecRaw.includes('divx') || vCodecRaw.includes('dx50') || vCodecRaw.includes('mp4v') || vCodecRaw.includes('mpeg-4')) {
      vStatus = 'ok'; vDisplay = 'MPEG-4 / Xvid';
    } else if (vCodecRaw.includes('mpeg-2') || vCodecRaw.includes('mpeg2')) {
      vStatus = 'ok'; vDisplay = 'MPEG-2';
    } else if (vCodecRaw.includes('av1')) {
      vStatus = 'ng'; vDisplay = 'AV1';
    } else if (vCodecRaw.includes('vp9')) {
      vStatus = 'ng'; vDisplay = 'VP9';
    } else if (vCodecRaw.includes('vp8')) {
      vStatus = 'ng'; vDisplay = 'VP8';
    } else if (vCodecRaw.includes('wmv') || vCodecRaw.includes('vc-1') || vCodecRaw.includes('vc1')) {
      vStatus = 'warn'; vDisplay = 'WMV / VC-1';
    } else {
      vStatus = 'unknown'; vDisplay = vCodecRaw;
    }
  }
  if (vCodecRaw) checks.push({ label: 'Video Codec', value: vDisplay, status: vStatus });

  // Audio codec
  let aStatus = 'unknown';
  let aDisplay = aCodecRaw || 'Unknown';
  if (aCodecRaw) {
    if (aCodecRaw.includes('aac')) {
      aStatus = 'ok'; aDisplay = 'AAC';
    } else if (aCodecRaw.includes('mp3') || aCodecRaw.includes('mpeg audio')) {
      aStatus = 'ok'; aDisplay = 'MP3';
    } else if (aCodecRaw.includes('ac-3') || aCodecRaw.includes('ac3') || (aCodecRaw.includes('dolby') && !aCodecRaw.includes('truehd') && !aCodecRaw.includes('atmos'))) {
      aStatus = 'ok'; aDisplay = 'AC3 / Dolby Digital';
    } else if (aCodecRaw.includes('pcm') || aCodecRaw.includes('lpcm')) {
      aStatus = 'ok'; aDisplay = 'PCM / LPCM';
    } else if (aCodecRaw.includes('e-ac-3') || aCodecRaw.includes('eac3') || aCodecRaw.includes('ec-3')) {
      aStatus = 'warn'; aDisplay = 'EAC3 / Dolby Digital+';
    } else if (aCodecRaw.includes('dts')) {
      aStatus = 'ng'; aDisplay = 'DTS';
    } else if (aCodecRaw.includes('truehd') || aCodecRaw.includes('atmos')) {
      aStatus = 'ng'; aDisplay = 'Dolby TrueHD / Atmos';
    } else if (aCodecRaw.includes('flac')) {
      aStatus = 'ng'; aDisplay = 'FLAC';
    } else if (aCodecRaw.includes('opus')) {
      aStatus = 'ng'; aDisplay = 'Opus';
    } else if (aCodecRaw.includes('vorbis')) {
      aStatus = 'ng'; aDisplay = 'Vorbis';
    } else {
      aStatus = 'unknown'; aDisplay = aCodecRaw;
    }
  }
  if (aCodecRaw) checks.push({ label: 'Audio Codec', value: aDisplay, status: aStatus });

  // Resolution
  if (width > 0 && height > 0) {
    let rStatus = 'ok';
    let rDisplay = `${width} × ${height}`;
    if (height > 1080 || width > 1920) {
      rStatus = 'ng'; rDisplay += ' (Too High)';
    } else if (height >= 1080) {
      rDisplay += ' (1080p Full HD)';
    } else if (height >= 720) {
      rDisplay += ' (720p HD)';
    } else {
      rDisplay += ' (SD)';
    }
    checks.push({ label: 'Resolution', value: rDisplay, status: rStatus });
  }

  // File Size
  const sizeDisplay = formatBytes(fileSize);
  let sizeStatus = 'ok';
  if (fileSize > TV_RULES.maxFileSizeBytes) sizeStatus = 'warn';
  checks.push({ label: 'File Size', value: sizeDisplay, status: sizeStatus });

  return checks;
}

// ===== Fallback: Basic Check using only file extension + size =====
function analyzeBasic(file, ext) {
  const containerStatus = classify(ext, TV_RULES.containers);
  const sizeStatus = file.size > TV_RULES.maxFileSizeBytes ? 'warn' : 'ok';

  const checks = [
    { label: 'Container', value: ext.toUpperCase(), status: containerStatus },
    { label: 'Video Codec', value: 'Could not read', status: 'unknown' },
    { label: 'Audio Codec', value: 'Could not read', status: 'unknown' },
    { label: 'File Size', value: formatBytes(file.size), status: sizeStatus }
  ];

  const tips = [
    'Full codec info could not be read. For detailed analysis, try a file with standard headers.',
    ...buildTips(checks, { size: file.size })
  ];

  const overall = deriveOverall(checks);
  renderResult('fileResult', checks, overall, tips);

  setTimeout(() => {
    document.getElementById('fileResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}


// ==========================================================
// ===== SCREENSHOT / OCR SECTION ===========================
// ==========================================================

let lastOcrText = '';  // store for re-check
let globalOcrWorker = null;
let ocrInitPromise = null;

// Initialize worker once and reuse it to massively speed up OCR
async function getOcrWorker() {
  if (globalOcrWorker) return globalOcrWorker;
  if (ocrInitPromise) {
    await ocrInitPromise;
    return globalOcrWorker;
  }
  
  ocrInitPromise = (async () => {
    if (typeof Tesseract === 'undefined') throw new Error('Tesseract.js not loaded');
    globalOcrWorker = await Tesseract.createWorker('eng', 1, {
      logger: m => {
        const statusText = document.getElementById('ocrStatusText');
        const progressFill = document.getElementById('ocrProgressFill');
        // Only update UI if the loading state is actually visible
        if (statusText && statusText.offsetParent !== null) {
          if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            progressFill.style.width = pct + '%';
            statusText.textContent = `Reading screenshot… ${pct}%`;
          } else if (m.status) {
            const friendly = {
              'loading tesseract core': 'Loading OCR engine…',
              'initializing tesseract': 'Starting up…',
              'loading language traineddata': 'Loading language data…',
              'initializing api': 'Preparing analyzer…',
            };
            statusText.textContent = friendly[m.status] || m.status;
          }
        }
      }
    });
  })();
  
  await ocrInitPromise;
  return globalOcrWorker;
}

// Pre-load in background after a short delay so it doesn't block main UI thread
window.addEventListener('load', () => {
  setTimeout(() => {
    if (typeof Tesseract !== 'undefined') {
      getOcrWorker().catch(e => console.warn('Background OCR init failed:', e));
    }
  }, 1500);
});

// ----- Wire up image drop zone -----
const imgDropZone  = document.getElementById('imgDropZone');
const imgFileInput = document.getElementById('imgFileInput');

imgDropZone.addEventListener('dragover', e => { e.preventDefault(); imgDropZone.classList.add('dragover'); });
imgDropZone.addEventListener('dragleave', () => imgDropZone.classList.remove('dragover'));
imgDropZone.addEventListener('drop', e => {
  e.preventDefault();
  imgDropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) processScreenshot(e.dataTransfer.files[0]);
});
imgFileInput.addEventListener('change', e => {
  if (e.target.files.length) processScreenshot(e.target.files[0]);
});

// Also allow clicking the drop zone itself
imgDropZone.addEventListener('click', () => imgFileInput.click());

function clearScreenshot() {
  imgFileInput.value = '';
  document.getElementById('imgPreviewStrip').classList.add('hidden');
  document.getElementById('imgDropZone').classList.remove('hidden');
  document.getElementById('ocrLoadingState').classList.add('hidden');
  document.getElementById('ocrTextCard').classList.add('hidden');
  document.getElementById('screenshotResult').innerHTML = '';
  lastOcrText = '';
}

// ----- Process screenshot image -----
async function processScreenshot(file) {
  if (!file.type.startsWith('image/')) {
    alert('Please drop an image file (PNG, JPG, WebP, etc.)');
    return;
  }

  // Show preview
  const url = URL.createObjectURL(file);
  const imgEl = document.getElementById('imgPreview');
  imgEl.src = url;

  // Get image dimensions once loaded
  imgEl.onload = () => {
    document.getElementById('imgDimensions').textContent =
      `${imgEl.naturalWidth} × ${imgEl.naturalHeight} px`;
  };

  document.getElementById('imgFileName').textContent = file.name;
  document.getElementById('imgPreviewStrip').classList.remove('hidden');
  document.getElementById('imgDropZone').classList.add('hidden');
  document.getElementById('ocrTextCard').classList.add('hidden');
  document.getElementById('screenshotResult').innerHTML = '';

  // Show OCR loading
  document.getElementById('ocrLoadingState').classList.remove('hidden');
  document.getElementById('ocrProgressFill').style.width = '0%';
  document.getElementById('ocrStatusText').textContent = 'Loading OCR engine…';

  try {
    const text = await runTesseractOcr(file);
    lastOcrText = text;
    showOcrResult(text);
  } catch (err) {
    console.error('OCR failed:', err);
    document.getElementById('ocrLoadingState').classList.add('hidden');
    document.getElementById('screenshotResult').innerHTML = `
      <div class="result-panel fail">
        <div class="result-header">
          <span class="result-badge">❌</span>
          <span class="result-title">OCR Failed</span>
        </div>
        <p style="font-size:0.88rem;color:var(--text-muted);margin-top:8px;">
          Could not read text from the image. Make sure the screenshot has clear, readable text.<br>
          Try the <strong>Manual</strong> tab instead.
        </p>
      </div>`;
  }
}

// ----- Run Tesseract OCR -----
function runTesseractOcr(imageFile) {
  return new Promise(async (resolve, reject) => {
    try {
      document.getElementById('ocrStatusText').textContent = 'Preparing image…';
      document.getElementById('ocrProgressFill').style.width = '0%';
      
      const worker = await getOcrWorker();
      const { data: { text } } = await worker.recognize(imageFile);
      
      // We do NOT terminate the worker here so it can be reused for subsequent checks
      resolve(text);
    } catch (e) {
      reject(e);
    }
  });
}

// ----- Show OCR text and run analysis -----
function showOcrResult(text) {
  document.getElementById('ocrLoadingState').classList.add('hidden');

  // Show raw extracted text
  const textCard = document.getElementById('ocrTextCard');
  textCard.classList.remove('hidden');
  document.getElementById('ocrRawText').textContent = text.trim() || '(No readable text detected)';

  // Parse and check
  const parsed = parseOcrText(text);
  runOcrCompatibilityCheck(parsed);
}

// ----- Re-check button -----
function recheckOcrText() {
  if (lastOcrText) {
    const parsed = parseOcrText(lastOcrText);
    runOcrCompatibilityCheck(parsed);
  }
}

// ----- Parse OCR text for media info -----
function parseOcrText(text) {
  const t = text.toLowerCase();
  const result = {
    container:  null,
    vCodec:     null,
    aCodec:     null,
    width:      0,
    height:     0,
    fileSize:   null,
    rawMatches: []
  };

  // --- Container detection ---
  if (/\b(matroska|mkv)\b/.test(t))           { result.container = 'mkv';  result.rawMatches.push('MKV'); }
  else if (/\bmp4\b|mpeg-4 base/.test(t))     { result.container = 'mp4';  result.rawMatches.push('MP4'); }
  else if (/\bavi\b|audio video interleav/.test(t)) { result.container = 'avi'; result.rawMatches.push('AVI'); }
  else if (/\bwmv\b|windows media/.test(t))   { result.container = 'wmv';  result.rawMatches.push('WMV'); }
  else if (/\bmov\b|quicktime/.test(t))        { result.container = 'mov';  result.rawMatches.push('MOV'); }
  else if (/\bflv\b|flash video/.test(t))      { result.container = 'flv';  result.rawMatches.push('FLV'); }
  else if (/\bwebm\b/.test(t))                 { result.container = 'webm'; result.rawMatches.push('WebM'); }
  else if (/\b(ts|mpeg.?ts|transport stream)\b/.test(t)) { result.container = 'ts'; result.rawMatches.push('TS'); }

  // Extension in filename (e.g. "Movie.mkv" in title bar)
  const extMatch = text.match(/\.(mkv|mp4|avi|mov|wmv|flv|ts|m4v|webm)\b/i);
  if (extMatch && !result.container) {
    result.container = extMatch[1].toLowerCase();
    result.rawMatches.push(extMatch[0].toUpperCase());
  }

  // --- Video codec detection ---
  if (/\bhevc\b|h\.?265\b|h265\b/.test(t))          { result.vCodec = 'hevc';  result.rawMatches.push('H.265/HEVC'); }
  else if (/\bavc\b|h\.?264\b|h264\b/.test(t))       { result.vCodec = 'h264';  result.rawMatches.push('H.264/AVC'); }
  else if (/\bav1\b/.test(t))                          { result.vCodec = 'av1';   result.rawMatches.push('AV1'); }
  else if (/\bvp9\b/.test(t))                          { result.vCodec = 'vp9';   result.rawMatches.push('VP9'); }
  else if (/\bvp8\b/.test(t))                          { result.vCodec = 'vp8';   result.rawMatches.push('VP8'); }
  else if (/\b(xvid|divx|mpeg.?4|mp4v)\b/.test(t))   { result.vCodec = 'mpeg4'; result.rawMatches.push('MPEG-4/Xvid'); }
  else if (/\bmpeg.?2\b/.test(t))                      { result.vCodec = 'mpeg2'; result.rawMatches.push('MPEG-2'); }
  else if (/\b(vc.?1|wmv3|wmv)\b/.test(t))            { result.vCodec = 'wmv';   result.rawMatches.push('WMV/VC-1'); }

  // --- Audio codec detection ---
  if (/\bdts.?hd\b|dts.?ma\b/.test(t))               { result.aCodec = 'dts';     result.rawMatches.push('DTS-HD'); }
  else if (/\bdts\b/.test(t))                          { result.aCodec = 'dts';     result.rawMatches.push('DTS'); }
  else if (/\btruehd\b|true.?hd\b|atmos\b/.test(t))  { result.aCodec = 'truehd';  result.rawMatches.push('TrueHD/Atmos'); }
  else if (/\be.?ac.?3\b|eac3\b|ec.?3\b|dd\+\b|dolby digital plus\b/.test(t)) { result.aCodec = 'eac3'; result.rawMatches.push('EAC3/DD+'); }
  else if (/\bac.?3\b|dolby digital\b/.test(t))       { result.aCodec = 'ac3';     result.rawMatches.push('AC3'); }
  else if (/\baac\b/.test(t))                          { result.aCodec = 'aac';     result.rawMatches.push('AAC'); }
  else if (/\bmp3\b|mpeg audio\b/.test(t))             { result.aCodec = 'mp3';     result.rawMatches.push('MP3'); }
  else if (/\bflac\b/.test(t))                         { result.aCodec = 'flac';    result.rawMatches.push('FLAC'); }
  else if (/\bopus\b/.test(t))                         { result.aCodec = 'opus';    result.rawMatches.push('Opus'); }
  else if (/\bpcm\b|lpcm\b/.test(t))                  { result.aCodec = 'pcm';     result.rawMatches.push('PCM'); }
  else if (/\bvorbis\b/.test(t))                       { result.aCodec = 'vorbis';  result.rawMatches.push('Vorbis'); }

  // --- Resolution detection ---
  // Look for patterns like "1920x1080", "1280 x 720", "3840×2160", "3840 x 2160"
  const resMatch = text.match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
  if (resMatch) {
    result.width  = parseInt(resMatch[1]);
    result.height = parseInt(resMatch[2]);
    // Swap if height > width (portrait screenshots listing H first)
    if (result.height > result.width) {
      [result.width, result.height] = [result.height, result.width];
    }
    result.rawMatches.push(`${result.width}×${result.height}`);
  }

  // Also look for "4K", "1080p", "720p" text
  if (!result.height) {
    if (/\b4k\b|2160p\b/.test(t))  { result.height = 2160; result.width = 3840; result.rawMatches.push('4K'); }
    else if (/\b1080p\b/.test(t))  { result.height = 1080; result.width = 1920; result.rawMatches.push('1080p'); }
    else if (/\b720p\b/.test(t))   { result.height = 720;  result.width = 1280; result.rawMatches.push('720p'); }
    else if (/\b480p\b/.test(t))   { result.height = 480;  result.width = 854;  result.rawMatches.push('480p'); }
  }

  // --- File size detection ---
  // Patterns: "4.2 GB", "2,456 MB", "1.8gb"
  const sizeMatch = text.match(/([\d,.]+)\s*(gb|mb|tb|kb)/i);
  if (sizeMatch) {
    const val  = parseFloat(sizeMatch[1].replace(',', ''));
    const unit = sizeMatch[2].toLowerCase();
    let bytes = val;
    if (unit === 'tb') bytes = val * 1024 * 1024 * 1024 * 1024;
    else if (unit === 'gb') bytes = val * 1024 * 1024 * 1024;
    else if (unit === 'mb') bytes = val * 1024 * 1024;
    else if (unit === 'kb') bytes = val * 1024;
    result.fileSize = bytes;
    result.rawMatches.push(`${val} ${unit.toUpperCase()}`);
  }

  return result;
}

// ----- Build checks from parsed OCR data and render -----
function runOcrCompatibilityCheck(parsed) {
  const checks = [];
  const noInfo = !parsed.container && !parsed.vCodec && !parsed.aCodec && !parsed.height;

  if (noInfo) {
    document.getElementById('screenshotResult').innerHTML = `
      <div class="result-panel warn">
        <div class="result-header">
          <span class="result-badge">⚠️</span>
          <span class="result-title">Couldn't Detect Media Info</span>
        </div>
        <p style="font-size:0.88rem;color:var(--text-muted);margin-top:8px;line-height:1.6;">
          The screenshot didn't contain recognisable codec or format text.<br>
          For best results, take a screenshot of <strong>VLC → Tools → Codec Information</strong>,
          or open the file in <strong>MediaInfo app</strong> and screenshot the summary view.<br>
          Alternatively, use the <strong>Manual tab</strong> to enter details directly.
        </p>
      </div>`;
    return;
  }

  // Container
  if (parsed.container) {
    const st = classify(parsed.container, TV_RULES.containers);
    checks.push({ label: 'Container', value: parsed.container.toUpperCase(), status: st });
  }

  // Video Codec
  if (parsed.vCodec) {
    const nameMap = {
      hevc: 'H.265 / HEVC', h264: 'H.264 / AVC', av1: 'AV1',
      vp9: 'VP9', vp8: 'VP8', mpeg4: 'MPEG-4 / Xvid',
      mpeg2: 'MPEG-2', wmv: 'WMV / VC-1'
    };
    const st = classify(parsed.vCodec, TV_RULES.videoCodecs);
    checks.push({ label: 'Video Codec', value: nameMap[parsed.vCodec] || parsed.vCodec, status: st });
  }

  // Audio Codec
  if (parsed.aCodec) {
    const nameMap = {
      aac: 'AAC', mp3: 'MP3', ac3: 'AC3 / Dolby Digital',
      dts: 'DTS', truehd: 'Dolby TrueHD / Atmos',
      flac: 'FLAC', opus: 'Opus', pcm: 'PCM / LPCM',
      eac3: 'EAC3 / DD+', vorbis: 'Vorbis'
    };
    const st = classify(parsed.aCodec, TV_RULES.audioCodecs);
    checks.push({ label: 'Audio Codec', value: nameMap[parsed.aCodec] || parsed.aCodec, status: st });
  }

  // Resolution
  if (parsed.width > 0 && parsed.height > 0) {
    let rStatus = 'ok';
    let rDisplay = `${parsed.width} × ${parsed.height}`;
    if (parsed.height > 1080 || parsed.width > 1920) {
      rStatus = 'ng'; rDisplay += ' (Too High)';
    } else if (parsed.height >= 1080) {
      rDisplay += ' (1080p Full HD)';
    } else if (parsed.height >= 720) {
      rDisplay += ' (720p HD)';
    } else {
      rDisplay += ' (SD)';
    }
    checks.push({ label: 'Resolution', value: rDisplay, status: rStatus });
  }

  // File size
  if (parsed.fileSize !== null) {
    const sizeStatus = parsed.fileSize > TV_RULES.maxFileSizeBytes ? 'warn' : 'ok';
    checks.push({ label: 'File Size', value: formatBytes(parsed.fileSize), status: sizeStatus });
  }

  const overall = deriveOverall(checks);
  const tips    = buildTips(checks, parsed.fileSize ? { size: parsed.fileSize } : null);
  renderResult('screenshotResult', checks, overall, tips);

  setTimeout(() => {
    document.getElementById('screenshotResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, 100);
}

