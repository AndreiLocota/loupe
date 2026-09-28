import utif from 'utif';

const MAX_DIMENSION = 16384;
const MAX_OUTPUT_BYTES = 256 * 1024 * 1024;

self.onmessage = (e: MessageEvent) => {
  const { data, type } = e.data;
  if (type !== 'decode-tiff') return;

  try {
    const bytes = new Uint8Array(data);
    const ifds = utif.decode(bytes);

    if (ifds.length === 0) {
      self.postMessage({ error: 'TIFF contains no images' });
      return;
    }

    const frames: { data: ArrayBuffer; width: number; height: number }[] = [];

    for (let i = 0; i < ifds.length; i++) {
      const ifd = ifds[i];
      if (!ifd) continue;

      // Validate the *declared* dimensions (t256 = ImageWidth, t257 = ImageLength)
      // read by decode() BEFORE decodeImage(), which allocates the full raster.
      // A TIFF declaring e.g. 200000×200000 would otherwise attempt a multi-GB
      // allocation before this guard ever ran.
      const declaredW = ifd.t256?.[0] ?? 0;
      const declaredH = ifd.t257?.[0] ?? 0;

      if (declaredW > MAX_DIMENSION || declaredH > MAX_DIMENSION) {
        self.postMessage({
          error: `TIFF dimensions (${declaredW}x${declaredH}) exceed max ${MAX_DIMENSION}`,
        });
        return;
      }

      const outputBytes = declaredW * declaredH * 4;
      if (outputBytes > MAX_OUTPUT_BYTES) {
        self.postMessage({
          error: `TIFF output size ${outputBytes} exceeds max ${MAX_OUTPUT_BYTES}`,
        });
        return;
      }

      utif.decodeImage(bytes, ifd, ifds);

      // Prefer the actual decoded dimensions so the reported width/height match
      // the RGBA buffer length; fall back to the declared tags.
      const w = ifd.width ?? declaredW;
      const h = ifd.height ?? declaredH;

      const rgba = utif.toRGBA8(ifd);
      const buffer = (rgba.buffer as ArrayBuffer).slice(0);
      frames.push({ data: buffer, width: w, height: h });
    }

    self.postMessage(
      { frames, pages: ifds.length },
      { transfer: frames.map(f => f.data) },
    );
  } catch (err) {
    self.postMessage({ error: (err as Error).message || 'TIFF decode failed' });
  }
};
