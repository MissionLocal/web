import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';       // <- must exist


mount(App, {
  target: document.getElementById('app')
});


