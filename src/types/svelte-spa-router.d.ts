declare module 'svelte-spa-router' {
  import { SvelteComponent } from "svelte";

  export interface RouteDefinition {
    [route: string]: typeof SvelteComponent;
  }

  export function link(node: HTMLElement): void;
  export function push(path: string): void;
  export function replace(path: string): void;

  export default class Router extends SvelteComponent {
    $$prop_def: {
      routes: RouteDefinition;
    };
  }
}
