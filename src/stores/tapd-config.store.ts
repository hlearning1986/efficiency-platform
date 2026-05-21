import { create } from 'zustand';

export interface TapdApiConfig {
  apiUser: string;
  apiPassword: string;
}

interface TapdConfigState {
  /** TAPD API 连接配置 */
  config: TapdApiConfig;
  /** 是否已配置（有值） */
  isConfigured: boolean;
  /** 是否正在加载 */
  loading: boolean;
  /** 更新配置（仅内存） */
  setConfig: (config: TapdApiConfig) => void;
  /** 从数据库加载 */
  loadFromDB: () => Promise<void>;
  /** 保存到数据库 */
  saveToDB: () => Promise<boolean>;
  /** 清除配置 */
  clearConfig: () => Promise<void>;
}

const TAPD_CONFIG_KEY = 'tapd_api_config';

export const useTapdConfigStore = create<TapdConfigState>((set, get) => ({
  config: {
    apiUser: '',
    apiPassword: '',
  },
  isConfigured: false,
  loading: false,

  setConfig: (config) => {
    const isConfigured = !!(config.apiUser && config.apiPassword);
    set({ config, isConfigured });
  },

  loadFromDB: async () => {
    set({ loading: true });
    try {
      const resp = await fetch(`/api/v1/settings/system?key=${TAPD_CONFIG_KEY}`);
      const result = await resp.json();
      if (result.success && result.data) {
        const parsed = JSON.parse(result.data) as TapdApiConfig;
        const isConfigured = !!(parsed.apiUser && parsed.apiPassword);
        set({ config: parsed, isConfigured });
      }
    } catch {
      // 加载失败时尝试从 localStorage 兼容迁移
      try {
        const saved = localStorage.getItem(TAPD_CONFIG_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as TapdApiConfig;
          if (parsed.apiUser && parsed.apiPassword) {
            // 自动迁移到数据库
            await fetch('/api/v1/settings/system', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ settings: { [TAPD_CONFIG_KEY]: saved } }),
            });
            const isConfigured = !!(parsed.apiUser && parsed.apiPassword);
            set({ config: parsed, isConfigured });
            localStorage.removeItem(TAPD_CONFIG_KEY);
          }
        }
      } catch {
        // 忽略
      }
    } finally {
      set({ loading: false });
    }
  },

  saveToDB: async () => {
    const { config } = get();
    if (!config.apiUser || !config.apiPassword) return false;
    try {
      const resp = await fetch('/api/v1/settings/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { [TAPD_CONFIG_KEY]: JSON.stringify(config) },
        }),
      });
      const result = await resp.json();
      return result.success;
    } catch {
      return false;
    }
  },

  clearConfig: async () => {
    try {
      await fetch('/api/v1/settings/system', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { [TAPD_CONFIG_KEY]: '' },
        }),
      });
    } catch {
      // 忽略
    }
    set({
      config: { apiUser: '', apiPassword: '' },
      isConfigured: false,
    });
  },
}));
