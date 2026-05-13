import { mount } from 'svelte';
import LogScreen from './screens/LogScreen.svelte';
import './styles/global.scss';

mount(LogScreen, { target: document.getElementById('app')! });
