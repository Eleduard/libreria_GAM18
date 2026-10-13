import { GamStorage } from './types';

/**
 * Adaptador de almacenamiento para navegadores web.
 * Utiliza sessionStorage como almacenamiento primario y sincroniza con localStorage
 * para tolerar redirecciones en nuevas pestañas o ventanas.
 */
export class BrowserStorage implements GamStorage {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const fromSession = window.sessionStorage.getItem(key);
      if (fromSession) return fromSession;
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Ignorar si sessionStorage está deshabilitado
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignorar si localStorage está deshabilitado
    }
  }

  removeItem(key: string): void {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignorar
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignorar
    }
  }
}

/**
 * Adaptador en memoria para entornos Node.js, SSR (Next.js/Remix) o tests unitarios.
 */
export class MemoryStorage implements GamStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export function getDefaultStorage(): GamStorage {
  if (typeof window !== 'undefined' && (window.localStorage || window.sessionStorage)) {
    return new BrowserStorage();
  }
  return new MemoryStorage();
}
