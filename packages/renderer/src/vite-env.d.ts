/// <reference types="vite/client" />

declare module '*.properties?raw' {
  const value: string;
  export default value;
}
