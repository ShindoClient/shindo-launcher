import App from './App.svelte';
import './index.scss';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Failed to find root element #app');
}

export const app = new App({
  target,
});

export default app;
