<script>
  import NetworkWeb from './lib/NetworkWeb.svelte';
  const dataUrl = import.meta.env.BASE_URL + 'data/network.json';

  let container;   // element we’ll observe for size/DOM changes

  // Pym child: send height on load and whenever size/content changes
  import { onMount } from 'svelte';
  onMount(() => {
    let child = null;
    try { if (window.pym) child = new window.pym.Child(); } catch {}

    const send = () => { try { child && child.sendHeight(); } catch {} };

    // initial send after fonts settle
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      requestAnimationFrame(() => { setTimeout(send, 60); });
    });

    // keep height in sync with content changes
    const ro = new ResizeObserver(send);
    const mo = new MutationObserver(send);
    if (container) {
      ro.observe(container);
      mo.observe(container, { childList: true, subtree: true, attributes: true });
    }

    return () => { ro.disconnect(); mo.disconnect(); };
  });
</script>

<div bind:this={container}>
  <NetworkWeb src={dataUrl} height={620} charge={-1100} linkDistance={120} />
</div>
