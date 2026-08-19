// THE TERMINAL — visual recognition via MobileNet embeddings, shared by
// index.html and admin.html.
//
// phash.js only recognises a re-photograph of the same catalogue image —
// same framing, same background, just resized or recompressed. This module
// covers the case that matters most for "scan a photo taken out in the
// wild": the same physical product, photographed from a different angle,
// against a different background, in different light.
//
// It does that with MobileNetV2, an open-source convolutional network run
// entirely in the browser via TensorFlow.js. Rather than its normal
// 1000-category classification output, it's read in embedding mode: the
// 1280-number vector from the layer just before classification. Photos of
// the same object produce nearby vectors in that space (compared by cosine
// similarity), even though the pixels look very different.
//
// TensorFlow.js and the model (~16MB total) are fetched from a CDN lazily,
// on first use — admin.html and index.html both load this file unconditionally,
// but nothing downloads until a photo is actually fingerprinted or scanned.
(function () {
  let modelPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function ensureLibs() {
    if (!window.tf) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4/dist/tf.min.js');
    }
    if (!window.mobilenet) {
      await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2/dist/mobilenet.min.js');
    }
  }

  // Resolves once; every later call reuses the same loaded model rather than
  // re-fetching or re-initialising it.
  function load() {
    if (!modelPromise) {
      modelPromise = ensureLibs().then(() => window.mobilenet.load({ version: 2, alpha: 1.0 }));
    }
    return modelPromise;
  }

  function fileToImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Not a readable image')); };
      img.src = url;
    });
  }

  // img: anything MobileNet's infer() accepts (HTMLImageElement, canvas,
  // ImageData). Returns a 1280-number Float32Array — the embedding, not the
  // classification. Loads the model first if this is the first call.
  async function compute(img) {
    const model = await load();
    const tensor = model.infer(img, true); // true = embedding, not classification
    const data = await tensor.data();
    tensor.dispose();
    return Float32Array.from(data);
  }

  // -1..1, higher is more similar. -Infinity for anything that can't be
  // compared (missing, wrong length, or a stored all-zero vector).
  function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return -Infinity;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return -Infinity;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // Plain array, for round-tripping through a Postgres real[] column.
  function toArray(embedding) { return Array.from(embedding); }

  window.MobileEmbed = { load, fileToImage, compute, cosineSimilarity, toArray };
})();
