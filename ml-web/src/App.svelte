<script>
  import { onMount, onDestroy } from 'svelte';
  import * as d3 from 'd3';
  import graph from './data/graph.json'; // <= here


  // --- Sample data (from your message) ---
  const nodes = graph.nodes;
  const links = graph.links;

  // --- Svelte refs & state ---
  let container;      // div that holds the SVG
  let svg, gRoot, gLinks, gNodes, gLabels;
  let width = 800, height = 500;
  let simulation;

  // Color by first group (fallback if none)
  const allGroups = Array.from(
    new Set(nodes.flatMap(n => (n.groups && n.groups.length ? [n.groups[0]] : ['other'])))
  );
  const color = d3.scaleOrdinal().domain(allGroups).range(d3.schemeSet2);

  // Node radius from "size"
  const r = d => 6 + d.size * 3;

  // Tooltip
  let tooltip;

  function init() {
    // Build SVG
    svg = d3.select(container)
      .append('svg')
      .attr('class', 'net-svg')
      .attr('width', width)
      .attr('height', height);

    // A root group so we can easily transform if needed later
    gRoot = svg.append('g');

    // Links below nodes
    gLinks = gRoot.append('g').attr('class', 'links');
    gNodes = gRoot.append('g').attr('class', 'nodes');
    gLabels = gRoot.append('g').attr('class', 'labels');

    // Simple absolute tooltip
    tooltip = d3.select(container)
      .append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    // Draw
    const linkSel = gLinks
      .selectAll('line')
      .data(links, d => d.source + '->' + d.target)
      .join('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => 1 + 3 * (d.strength ?? 0.5));

    const nodeSel = gNodes
      .selectAll('circle')
      .data(nodes, d => d.id)
      .join('circle')
      .attr('r', r)
      .attr('fill', d => color(d.groups?.[0] ?? 'other'))
      .attr('stroke', '#333')
      .attr('stroke-width', 1)
      .call(drag());

    // Tooltip handlers
    nodeSel
      .on('mouseover', (event, d) => {
        tooltip
          .style('opacity', 1)
          .html(`
            <strong>${d.label}</strong><br/>
            Groups: ${d.groups?.join(', ') || '—'}<br/>
          `);
      })
      .on('mousemove', (event) => {
        const { offsetX, offsetY } = event;
        tooltip.style('left', offsetX + 12 + 'px').style('top', offsetY + 12 + 'px');
      })
      .on('mouseout', () => tooltip.style('opacity', 0));

    const labelSel = gLabels
      .selectAll('text')
      .data(nodes, d => d.id)
      .join('text')
      .attr('class', 'n-label')
      .attr('text-anchor', 'middle')
      .attr('dy', d => r(d) + 12)
      .text(d => d.label);

    // Force simulation
    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).strength(d => d.strength ?? 0.5).distance(90))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('collide', d3.forceCollide().radius(d => r(d) + 4))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .on('tick', () => {
        linkSel
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        nodeSel
          .attr('cx', d => d.x)
          .attr('cy', d => d.y);

        labelSel
          .attr('x', d => d.x)
          .attr('y', d => d.y);
      });

    resize(); // set initial size and recenter
  }

  function resize() {
    if (!container) return;
    const w = container.clientWidth || 800;
    const h = Math.max(360, Math.round(w * 0.6)); // responsive aspect
    width = w;
    height = h;

    svg.attr('width', width).attr('height', height);
    simulation
      ?.force('center', d3.forceCenter(width / 2, height / 2))
      .alpha(0.1)
      .restart();
  }

  function drag() {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
  }

  onMount(() => {
    init();
    window.addEventListener('resize', resize);
  });

  onDestroy(() => {
    window.removeEventListener('resize', resize);
    simulation?.stop();
  });
</script>

<div class="chart" bind:this={container}>
  <!-- SVG + tooltip are injected here -->
</div>

<style>
  .chart {
    width: min(900px, 95vw);
    margin: 24px auto;
    font-family: Barlow, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    position: relative; /* tooltip positioning */
  }

  :global(.net-svg) {
    display: block;
    width: 100%;
    height: auto;
    background: #fafafa;
    border: 1px solid #e6e6e6;
    border-radius: 12px;
  }

  :global(.nodes circle:hover) { stroke-width: 2; }

  :global(.n-label) {
    font-size: 12px;
    fill: #222;
    pointer-events: none;
  }

  :global(.tooltip) {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    box-shadow: 0 2px 10px rgba(0,0,0,.08);
  }
</style>
