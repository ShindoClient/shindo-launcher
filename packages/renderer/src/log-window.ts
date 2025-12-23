import LogWindow from './windows/LogWindow.svelte';
import './index.css';

const target = document.getElementById('app');

if (!target) {
  throw new Error('Failed to find root element #app');
}

export const app = new LogWindow({
  target,
});

export default app;
