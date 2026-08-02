declare module "*.scss" {
  const classes: Record<string, string>;
  export default classes;
}
declare module "*.svg" { const src: string; export default src; }
declare module "mod.json" {
  const value: { id: string; author: string; version: string; dependencies: string[] };
  export default value;
}
declare module "cs2/api" {
  export interface ValueBinding<T> { value: T }
  export function bindValue<T>(group: string, name: string, fallback?: T): ValueBinding<T>;
  export function useValue<T>(binding: ValueBinding<T>): T;
  export function trigger(group: string, name: string, ...args: unknown[]): void;
}
declare module "cs2/modding" {
  import type { ComponentType } from "react";
  export interface ModuleRegistry {
    append(target: string, component: ComponentType<any>, index?: number): void;
    extend(path: string, exportName: string, callback: (original: any) => any): void;
    registry: { get(path: string): Record<string, any> | undefined };
  }
  export type ModRegistrar = (registry: ModuleRegistry) => void;
}
declare module "cs2/ui" {
  import type { ComponentType, ReactNode } from "react";
  export const Button: ComponentType<any>;
  export const Panel: ComponentType<any>;
  export const Tooltip: ComponentType<{ tooltip: ReactNode; children: ReactNode }>;
  export const Portal: ComponentType<{ children: ReactNode }>;
}
declare module "cs2/l10n" {
  export function useLocalization(): { translate(key: string, fallback?: string): string };
}
