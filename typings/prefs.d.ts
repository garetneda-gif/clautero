declare namespace _ZoteroTypes {
  interface Prefs {
    PluginPrefsMap: {
      apiKey: string;
      model: string;
      proxyPort: number;
      autoContext: boolean;
      "obsidian.enabled": boolean;
      "obsidian.apiKey": string;
      "obsidian.vaultPrefix": string;
    };
  }
}
