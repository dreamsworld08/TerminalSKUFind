// THE TERMINAL — perceptual image hashing, shared by index.html and admin.html.
//
// A photo maps to a fixed-length bit string such that visually similar
// photos produce similar strings (small Hamming distance) even after
// resizing, mild recompression, or a slightly different angle or light.
// admin.html computes this once, at upload time, and stores it on the row;
// index.html computes it once, for a scanned photo, and compares.
//
// Algorithm: resize to a fixed working resolution -> grayscale -> 2D DCT
// (separable, with a precomputed cosine table) -> keep the low-frequency
// corner of the result -> threshold each coefficient against the median of
// the set -> a bit string. The DC term is dropped; it reflects overall
// brightness, not shape, and would just add noise to the comparison.
//
// The 2D DCT is done as two 1D passes (rows, then columns of the result)
// rather than one full four-nested-loop pass. That is not an approximation —
// the DCT is mathematically separable — but it turns an O(N^4) computation
// into O(N^3), which is the difference between a noticeable freeze on a
// phone and something that finishes before the next frame.
(function () {
  const N = 32; // working resolution for the DCT
  const M = 8;  // keep the top-left M x M low-frequency block

  // cos((2x+1) * u * PI / (2N)) for every (x, u) pair, built once and reused
  // by every hash computed on this page. Precomputing this is what keeps the
  // transform fast — recomputing cos() inside the inner loop is the single
  // biggest cost in a naive implementation.
  const COS = (() => {
    const t = new Float64Array(N * N);
    for (let x = 0; x < N; x++) {
      for (let u = 0; u < N; u++) {
        t[x * N + u] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N));
      }
    }
    return t;
  })();
  const scale = (u) => (u === 0 ? 1 / Math.SQRT2 : 1);
  const NORM = Math.sqrt(2 / N);

  // 1D DCT-II applied to every row of an N x N matrix.
  function dct1dRows(mat) {
    const out = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
      const rowOff = y * N;
      for (let u = 0; u < N; u++) {
        let sum = 0;
        for (let x = 0; x < N; x++) sum += mat[rowOff + x] * COS[x * N + u];
        out[rowOff + u] = sum * scale(u) * NORM;
      }
    }
    return out;
  }

  function transpose(mat) {
    const out = new Float64Array(N * N);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) out[x * N + y] = mat[y * N + x];
    }
    return out;
  }

  // Full 2D DCT as two 1D passes: transform each row, transpose, transform
  // each row again (now the original columns), transpose back.
  function dct2d(mat) {
    const rows = dct1dRows(mat);
    const cols = dct1dRows(transpose(rows));
    return transpose(cols);
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

  // img: anything drawImage() accepts (HTMLImageElement, canvas, ImageBitmap).
  // Returns a 63-character string of '0'/'1'.
  function compute(img) {
    const canvas = document.createElement('canvas');
    canvas.width = N; canvas.height = N;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, N, N);
    const px = ctx.getImageData(0, 0, N, N).data;

    const gray = new Float64Array(N * N);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
    }

    const dct = dct2d(gray);
    const low = [];
    for (let u = 0; u < M; u++) for (let v = 0; v < M; v++) low.push(dct[u * N + v]);

    const ac = low.slice(1); // drop the DC term
    const sorted = ac.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return ac.map((v) => (v > median ? '1' : '0')).join('');
  }

  function hammingDistance(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
    return n;
  }

  window.PHash = { fileToImage, compute, hammingDistance, BITS: M * M - 1 };
})();
