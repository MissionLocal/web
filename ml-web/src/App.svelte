<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

  export let src = '';
  export let data = null;
  export let size = 400;        // desired max canvas size (px)
  export let charge = -900;
  export let linkDistance = 85;
  export let showImages = false;
  export let staticTabs = ['All','Tab 1','Tab 2','Tab 3','Tab 4'];

  export let theme = {
    font: "Barlow, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    accent: "#8ad6ce",
    bg: "#f3f3f3",
    panel: "#ffffff",
    ink: "#111",
    muted: "#666",
    ring: "#cfcfcf",
    edge: "#d6d6d6",
    edgeOn: "#b6b6b6",
    label: 11,
    nodeStroke: 2
  };

  let container, svgEl;
  let canvas = size;     // actual canvas side in px (fixed once at mount)

  let activeTab = 'All';
  let query = '';
  let pinned = new Set();
  let sim, gLinks, gNodes;
  let current = { nodes: [], links: [] };

  $: groups = staticTabs?.length ? staticTabs : deriveGroups(current.nodes);

  onMount(async () => {
    // Decide final canvas size once: min(container width, requested size)
    canvas = Math.min(container?.clientWidth || size, size);

    if (!data && src) {
      const res = await fetch(src);
      data = await res.json();
    }
    if (!data) data = { nodes: [], links: [] };

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    gLinks = svg.append('g').attr('class', 'links');
    gNodes = svg.append('g').attr('class', 'nodes');

    hydrate();
  });

  function hydrate(){ current = normalizeData(data); render(); }

  function deriveGroups(nodes){
    const set = new Set(['All']);
    for (const n of nodes) (n.groups || []).forEach(g => set.add(g));
    return Array.from(set);
  }

  function normalizeData(raw){
    const nodes = (raw.nodes || []).map(n => ({
      id: String(n.id),
      label: n.label ?? String(n.id),
      img: n.img || null,
      groups: n.groups || ['All'],
      size: n.size ?? 16
    }));
    const links = (raw.links || []).map(l => ({
      source: String(l.source),
      target: String(l.target),
      strength: l.strength ?? 0.6
    }));
    return { nodes, links };
  }

  const radius = d => 10 + (d.size || 16) * 0.45;

  function render(){
    const all = current;
    const nodesF = all.nodes.filter(n => activeTab === 'All' || (n.groups || []).includes(activeTab));
    const idset  = new Set(nodesF.map(n => n.id));
    const linksF = all.links.filter(l => idset.has(l.source) && idset.has(l.target));

    const q = (query || '').trim().toLowerCase();
    const isMatch = n => !q || (n.label || '').toLowerCase().includes(q) || (n.id || '').toLowerCase().includes(q);

    const linkSel = gLinks.selectAll('line.link').data(linksF, d => `${d.source}|${d.target}`);
    linkSel.enter().append('line').attr('class','link')
      .merge(linkSel)
      .classed('active', d => isMatch(getNode(d.source, all)) || isMatch(getNode(d.target, all)));
    linkSel.exit().remove();

    const nodeSel = gNodes.selectAll('g.node').data(nodesF, d => d.id);
    const nodeEnter = nodeSel.enter().append('g').attr('class','node')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active && sim) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y; pinned.add(d.id); })
        .on('drag',  (event, d) => { d.fx=event.x; d.fy=event.y; })
        .on('end',   (event, d) => { if (!event.active && sim) sim.alphaTarget(0); }))
      .on('click', (event, d) => {
        if (pinned.has(d.id)) { pinned.delete(d.id); d.fx=d.fy=null; }
        else { pinned.add(d.id); d.fx=d.x; d.fy=d.y; }
        if (sim) sim.alpha(0.5).restart();
      });

    nodeEnter.append('circle').attr('class','bg').attr('r', d => radius(d));

    if (showImages) {
      nodeEnter.append('clipPath').attr('id', d => `clip-${d.id}`).append('circle').attr('r', d => radius(d));
      nodeEnter.append('image')
        .attr('href', d => d.img || '')
        .attr('x', d => -radius(d)).attr('y', d => -radius(d))
        .attr('width', d => radius(d)*2).attr('height', d => radius(d)*2)
        .attr('clip-path', d => `url(#clip-${d.id})`);
    }

    nodeEnter.append('text').attr('class','label bg').attr('dy', d=>radius(d)+14).text(d=>d.label||d.id);
    nodeEnter.append('text').attr('class','label').attr('dy', d=>radius(d)+14).text(d=>d.label||d.id);

    nodeSel.merge(nodeEnter).classed('match', d => isMatch(d));
    nodeSel.exit().remove();

    if (sim) sim.stop();
    sim = d3.forceSimulation(nodesF)
      .force('link', d3.forceLink(linksF).id(d=>d.id).distance(linkDistance).strength(d=>d.strength||0.6))
      .force('charge', d3.forceManyBody().strength(charge))
      .force('center', d3.forceCenter(canvas/2, canvas/2))
      .force('collide', d3.forceCollide().radius(d=>radius(d)+5).strength(0.9))
      .on('tick', () => {
        gLinks.selectAll('line.link')
          .attr('x1', d=>d.source.x).attr('y1', d=>d.source.y)
          .attr('x2', d=>d.target.x).attr('y2', d=>d.target.y);
        gNodes.selectAll('g.node').attr('transform', d=>`translate(${d.x},${d.y})`);
      });
  }

  function getNode(id, data){ return (data.nodes||[]).find(n => n.id === id) || {}; }
</script>

<!-- Theme vars scoped to wrapper -->
<div
  class="wrap"
  bind:this={container}
  style={`
    --font:${theme.font};
    --bg:${theme.bg};
    --ink:${theme.ink};
    --muted:${theme.muted};
    --tabOn:${theme.accent};
    --tab:#e2e2e2;
    --nodeBg:${theme.panel};
    --ring:${theme.ring};
    --edge:${theme.edge};
    --edgeOn:${theme.edgeOn};
    --label:${theme.label}px;
    --nodeStroke:${theme.nodeStroke}px;
  `}
>
  <div class="header">
    <div class="tabs">
      {#each groups as g}
        <button class="tab {g===activeTab ? 'is-active':''}" on:click={() => activeTab = g}>{g}</button>
      {/each}
    </div>
    <div class="search">
      <label for="q">Search</label>
      <input id="q" type="search" bind:value={query} placeholder="Search…" />
    </div>
  </div>

  <!-- Fixed pixel dimensions set once (no aspect-ratio, no observers) -->
  <svg
    bind:this={svgEl}
    class="stage"
    width={canvas}
    height={canvas}
    viewBox={`0 0 ${canvas} ${canvas}`}
    preserveAspectRatio="xMidYMid meet"
  ></svg>

  <div class="legend">Blank template · Add nodes/links in <code>public/data/network.json</code>.</div>
</div>

<style>
  .wrap{ background:var(--bg); padding:12px; border-radius:12px; font-family:var(--font) }
  .header{ display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:10px }
  .tabs{ display:flex; gap:8px; flex-wrap:wrap }
  .tab{ border:0; background:#ffffff; color:#111; padding:6px 12px; border-radius:999px; cursor:pointer; font:600 13px/1 var(--font) }
  .tab.is-active{ background:var(--tabOn); color:#fff }
  .search{ margin-left:auto; display:flex; gap:8px; align-items:center }
  .search label{ font:12px var(--font); color:var(--muted) }
  .search input{ padding:7px 10px; border-radius:10px; border:1px solid #ffffff; min-width:200px; font:400 14px var(--font) }

  /* No aspect-ratio; size is from width/height attributes immediately */
  .stage{
    display:block;
    max-width: 100%;
    background:var(--nodeBg);
    border:1px solid #e6e6e6; border-radius:14px; box-shadow:0 2px 10px rgba(0,0,0,.04)
  }

  .links line.link{ stroke:var(--edge); stroke-opacity:.6 }
  .links line.link.active{ stroke:var(--edgeOn); stroke-width:2 }
  .nodes .node{ cursor:pointer }
  .nodes .node circle.bg{ fill:var(--nodeBg); stroke:var(--ring); stroke-width:var(--nodeStroke) }
  .nodes .node image{ pointer-events:none }
  .nodes .node text.label{ font:400 var(--label)/1.2 var(--font); fill:var(--ink); text-anchor:middle; pointer-events:none }
  .nodes .node text.label.bg{ fill:#fff; stroke:#fff; stroke-width:3 }
  .legend{ margin-top:8px; font:12px/1.4 var(--font); color:var(--muted) }
</style>
