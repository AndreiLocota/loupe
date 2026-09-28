declare module 'utif' {
  interface IFD {
    width?: number;
    height?: number;
    t258?: number[];
    t257?: number[];
    t256?: number[];
    [key: number]: number[] | undefined;
  }
  function decode(buffer: ArrayBuffer | Uint8Array): IFD[];
  function decodeImage(buffer: ArrayBuffer | Uint8Array, ifd: IFD, ifds?: IFD[]): void;
  function toRGBA8(ifd: IFD): Uint8Array;
  const _default: { decode: typeof decode; decodeImage: typeof decodeImage; toRGBA8: typeof toRGBA8 };
  export default _default;
}
