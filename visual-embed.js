// THE TERMINAL — visual recognition via DINOv2 image embeddings, shared by
// index.html and admin.html.
//
// phash.js only recognises a re-photograph of the same catalogue image —
// same framing, background, just resized or recompressed. This module
// covers the case that matters most for "scan a photo taken out in the
// wild": the same physical product, photographed from a different angle,
// against a different background, in different light.
//
// This originally used MobileNetV2's classification embeddings, but testing
// against the real catalogue showed the problem with that: unrelated
// products scored 0.58-0.63 cosine similarity, crowded right at the match
// threshold, because MobileNet was trained to tell a chair from a dog, not
// to tell one sofa apart from a similar-looking one. DINOv2 (Meta's
// self-supervised vision transformer) is trained for exactly this kind of
// instance-level similarity instead, and the same test spread scores from
// ~0.04 to ~0.72 for different products vs ~1.0 for the same photo — enough
// separation to threshold on.
//
// Runs entirely in the browser via transformers.js + ONNX Runtime Web
// (the model is ~90MB, fetched from a CDN on first use and cached in
// IndexedDB after that, so only the very first scan or backfill on a given
// device pays the download).
(function () {
  const MODEL_ID = 'Xenova/dinov2-small';
  const DIM = 384; // dinov2-small's hidden size — the length of every stored embedding

  let extractorPromise = null;

  // Resolves once; every later call reuses the same loaded pipeline rather
  // than re-fetching or re-initialising it. A failed attempt (slow
  // connection, CDN blocked, tab backgrounded mid-fetch) clears the cached
  // promise rather than pinning the failure for the rest of the page's
  // life — the next scan gets a fresh try instead of being stuck on pHash
  // alone with no way to recover short of a reload.
  function load() {
    if (!extractorPromise) {
      extractorPromise = import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3')
        .then(({ pipeline }) => pipeline('image-feature-extraction', MODEL_ID))
        .catch((e) => { extractorPromise = null; throw e; });
    }
    return extractorPromise;
  }

  // src: anything transformers.js can fetch — a remote URL (e.g. a public
  // Supabase storage URL) or a local object URL (URL.createObjectURL(file)).
  // Returns a 384-number Float32Array: the CLS token of DINOv2's last
  // hidden state, which is its standard whole-image descriptor (the model
  // also returns 256 per-patch tokens, describing sub-regions rather than
  // the image as a whole — those are dropped here).
  async function compute(src) {
    const extractor = await load();
    const out = await extractor(src);
    return Float32Array.from(out.data.slice(0, DIM));
  }

  // -1..1, higher is more similar. -Infinity for anything that can't be
  // compared (missing, wrong length — e.g. a stale embedding from a
  // previous model — or a stored all-zero vector).
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

  window.VisualEmbed = { DIM, load, compute, cosineSimilarity, toArray };
})();
