/**
 * Bantay Barya - Unified Storage Adapter
 * Abstracts persistence across web localStorage and Chrome Extension storage.local.
 * Provides unified batch operations, plaintext cleanup, and encrypted vault detection.
 */

(function (global) {
  'use strict';

  const PLAINTEXT_LEDGER_KEYS = [
    'bb_wallets',
    'bb_transactions',
    'bb_debts',
    'bb_bills',
    'bb_save_slots',
    'bb_settings',
    'bb_categories',
    'bb_active_slot_id',
    'bb_last_saved_timestamp',
    'bb_app_pin_v7',
    'ledger_app_pin_v6',
    'ledger_tracker_transactions_v6',
    'ledger_tracker_settings_v6',
    'ledger_tracker_categories_v6',
    'ledger_tracker_theme_v6',
    'bantay_barya_wallets_v7',
    'bantay_barya_transactions_v7',
    'bantay_barya_debts_v7',
    'bantay_barya_bills_v7',
    'bantay_barya_save_slots_v7',
    'bantay_barya_settings_v7',
    'bantay_barya_categories_v7',
    'bantay_barya_active_slot_id_v7',
    'bantay_barya_last_saved_v7',
    'bantay_barya_pin_v7',
    'bantay_barya_transactions_v6',
    'bantay_barya_settings_v6',
    'bantay_barya_categories_v6',
    'bantay_barya_theme_v6',
    'bantay_barya_pin_v6'
  ];

  const STORAGE_KEY_ENCRYPTED_VAULT = 'bb_encrypted_vault_v1';
  const LEGACY_KEY_ENCRYPTED_VAULT_V7 = 'bantay_barya_encrypted_vault_v7';
  const STORAGE_KEY_MIGRATION_STAGING = 'bb_migration_staging_v1';
  const STORAGE_KEY_THROTTLE = 'bb_throttle_v1';
  const STORAGE_KEY_THEME = 'bb_theme';
  const STORAGE_KEY_FX_CACHE = 'bb_fx_rates_cache';
  const STORAGE_KEY_DONT_SHOW_WELCOME = 'bb_dont_show_welcome';

  function isChromeStorageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  function getLocalStorage() {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    if (typeof global !== 'undefined' && global.localStorage) return global.localStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
  }

  const StorageAdapter = {
    PLAINTEXT_LEDGER_KEYS,
    STORAGE_KEY_ENCRYPTED_VAULT,
    LEGACY_KEY_ENCRYPTED_VAULT_V7,
    STORAGE_KEY_MIGRATION_STAGING,
    STORAGE_KEY_THROTTLE,
    STORAGE_KEY_THEME,
    STORAGE_KEY_FX_CACHE,
    STORAGE_KEY_DONT_SHOW_WELCOME,

    getItemSync(key) {
      const ls = getLocalStorage();
      return ls ? ls.getItem(key) : null;
    },

    setItemSync(key, value) {
      const ls = getLocalStorage();
      if (ls) ls.setItem(key, value);
      if (isChromeStorageAvailable()) {
        try {
          const obj = {};
          obj[key] = value;
          chrome.storage.local.set(obj);
        } catch (e) {}
      }
    },

    removeItemSync(key) {
      const ls = getLocalStorage();
      if (ls) ls.removeItem(key);
      if (isChromeStorageAvailable()) {
        try {
          chrome.storage.local.remove(key);
        } catch (e) {}
      }
    },

    async getItem(key) {
      return new Promise((resolve, reject) => {
        if (isChromeStorageAvailable()) {
          chrome.storage.local.get(key, (res) => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message || String(chrome.runtime.lastError)));
            }
            if (res && res[key] !== undefined) {
              const val = res[key];
              resolve(typeof val === 'string' ? val : JSON.stringify(val));
            } else {
              const ls = getLocalStorage();
              resolve(ls ? ls.getItem(key) : null);
            }
          });
        } else {
          const ls = getLocalStorage();
          resolve(ls ? ls.getItem(key) : null);
        }
      });
    },

    async setItem(key, value) {
      const ls = getLocalStorage();
      if (ls) ls.setItem(key, value);

      return new Promise((resolve, reject) => {
        if (isChromeStorageAvailable()) {
          const obj = {};
          obj[key] = value;
          chrome.storage.local.set(obj, () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message || String(chrome.runtime.lastError)));
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    },

    async removeItem(key) {
      const ls = getLocalStorage();
      if (ls) ls.removeItem(key);

      return new Promise((resolve, reject) => {
        if (isChromeStorageAvailable()) {
          chrome.storage.local.remove(key, () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message || String(chrome.runtime.lastError)));
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    },

    async setBatch(keyValueMap) {
      const ls = getLocalStorage();
      if (ls) {
        for (const k of Object.keys(keyValueMap)) {
          ls.setItem(k, keyValueMap[k]);
        }
      }

      return new Promise((resolve, reject) => {
        if (isChromeStorageAvailable()) {
          chrome.storage.local.set(keyValueMap, () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message || String(chrome.runtime.lastError)));
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    },

    async removeBatch(keys) {
      const ls = getLocalStorage();
      if (ls) {
        for (const k of keys) {
          ls.removeItem(k);
        }
      }

      return new Promise((resolve, reject) => {
        if (isChromeStorageAvailable()) {
          chrome.storage.local.remove(keys, () => {
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message || String(chrome.runtime.lastError)));
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    },

    async clearPlaintextLedger() {
      await this.removeBatch(PLAINTEXT_LEDGER_KEYS);
    },

    clearPlaintextLedgerSync() {
      const ls = getLocalStorage();
      if (ls) {
        PLAINTEXT_LEDGER_KEYS.forEach(k => ls.removeItem(k));
      }
      if (isChromeStorageAvailable()) {
        try {
          chrome.storage.local.remove(PLAINTEXT_LEDGER_KEYS);
        } catch (e) {}
      }
    },

    hasEncryptedVault() {
      const val1 = this.getItemSync(STORAGE_KEY_ENCRYPTED_VAULT);
      const val2 = this.getItemSync(LEGACY_KEY_ENCRYPTED_VAULT_V7);
      return !!((val1 && val1.length > 20) || (val2 && val2.length > 20));
    },

    async hasEncryptedVaultAsync() {
      const val1 = await this.getItem(STORAGE_KEY_ENCRYPTED_VAULT);
      if (val1 && val1.length > 20) return true;
      const val2 = await this.getItem(LEGACY_KEY_ENCRYPTED_VAULT_V7);
      return !!(val2 && val2.length > 20);
    },

    hasLegacyPlaintextPin() {
      const p1 = this.getItemSync('bb_app_pin_v7');
      const p2 = this.getItemSync('ledger_app_pin_v6');
      const p3 = this.getItemSync('bantay_barya_pin_v7');
      const p4 = this.getItemSync('bantay_barya_pin_v6');
      return !!((p1 && p1.length === 7) || (p2 && p2.length === 7) || (p3 && p3.length === 7) || (p4 && p4.length === 7));
    },

    async hasLegacyPlaintextPinAsync() {
      const p1 = await this.getItem('bb_app_pin_v7');
      const p2 = await this.getItem('ledger_app_pin_v6');
      const p3 = await this.getItem('bantay_barya_pin_v7');
      const p4 = await this.getItem('bantay_barya_pin_v6');
      return !!((p1 && p1.length === 7) || (p2 && p2.length === 7) || (p3 && p3.length === 7) || (p4 && p4.length === 7));
    },

    getLegacyPlaintextPin() {
      const p1 = this.getItemSync('bb_app_pin_v7');
      if (p1 && p1.length === 7) return p1;
      const p2 = this.getItemSync('ledger_app_pin_v6');
      if (p2 && p2.length === 7) return p2;
      const p3 = this.getItemSync('bantay_barya_pin_v7');
      if (p3 && p3.length === 7) return p3;
      const p4 = this.getItemSync('bantay_barya_pin_v6');
      if (p4 && p4.length === 7) return p4;
      return null;
    },

    async getLegacyPlaintextPinAsync() {
      const p1 = await this.getItem('bb_app_pin_v7');
      if (p1 && p1.length === 7) return p1;
      const p2 = await this.getItem('ledger_app_pin_v6');
      if (p2 && p2.length === 7) return p2;
      const p3 = await this.getItem('bantay_barya_pin_v7');
      if (p3 && p3.length === 7) return p3;
      const p4 = await this.getItem('bantay_barya_pin_v6');
      if (p4 && p4.length === 7) return p4;
      return null;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StorageAdapter, PLAINTEXT_LEDGER_KEYS };
  }
  global.BB_STORAGE = StorageAdapter;
})(typeof globalThis !== 'undefined' ? globalThis : window);
