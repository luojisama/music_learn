declare module 'NeteaseCloudMusicApi' {
  type NeteaseResult = {
    body: unknown;
    status: number;
    cookie?: string[] | string;
  };

  type NeteaseApi = Record<string, (query: Record<string, unknown>) => Promise<NeteaseResult>>;

  const api: NeteaseApi;
  export = api;
}

declare module 'kuroshiro' {
  type KuroshiroOptions = {
    to?: string;
    mode?: string;
    romajiSystem?: string;
  };

  class Kuroshiro {
    init(analyzer: unknown): Promise<void>;
    convert(text: string, options?: KuroshiroOptions): Promise<string>;
  }

  export default Kuroshiro;
}

declare module 'kuroshiro-analyzer-kuromoji' {
  class KuromojiAnalyzer {
    constructor(options: { dictPath: string });
  }

  export default KuromojiAnalyzer;
}
