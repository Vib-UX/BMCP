export interface XverseWindow extends Window {
  BitcoinProvider?: {
    request: (method: string, params?: any) => Promise<any>;
  };
}

