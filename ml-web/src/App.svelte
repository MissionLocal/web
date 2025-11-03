<script>
  import NetworkWeb from './lib/NetworkWeb.svelte';
  const dataUrl = import.meta.env.BASE_URL + 'data/network.json';
</script>

<h1 style="margin:0 0 12px; font-family: Barlow, system-ui">Filterable Network (Svelte + D3)</h1>
<NetworkWeb src={dataUrl} height={620} charge={-1100} linkDistance={120} />
