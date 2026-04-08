declare const crypto: {
  subtle: {
    digest(algorithm: string, data: BufferSource): Promise<ArrayBuffer>;
    importKey(format: string, keyData: BufferSource, algorithm: string, extractable: boolean, keyUsages: string[]): Promise<CryptoKey>;
    decrypt(algorithm: string, key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer>;
    encrypt(algorithm: string, key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer>;
    sign(algorithm: string, key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer>;
    verify(algorithm: string, key: CryptoKey, signature: ArrayBuffer, data: ArrayBuffer): Promise<boolean>;
  };
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  randomUUID(): string;
};

declare class TextEncoder {
  encode(input?: string): Uint8Array;
}

declare class TextDecoder {
  decode(input?: ArrayBuffer, options?: { stream?: boolean }): string;
}
