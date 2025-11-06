<script>
  import { onMount, onDestroy } from "svelte";
  import * as d3 from "d3";

  // Data
  import graph from "./data/graph.json";
  const nodes = graph.nodes;
  const links = graph.links;
  const nodeById = new Map(nodes.map((d) => [d.id, d]));

  // ---- Pym (guarded)
  let pymChild = null;
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  const postHeight = () => { try { if (pymChild) pymChild.sendHeight(); } catch {} };

  // Avatars
  const imageFiles = import.meta.glob("./assets/avatars/*.{png,jpg,jpeg,svg}", { eager: true, as: "url" });
  function findImageUrl(id) {
    for (const ext of ["png", "jpg", "jpeg", "svg"]) {
      const key = `./assets/avatars/${id}.${ext}`;
      if (imageFiles[key]) return imageFiles[key];
    }
    return null;
  }
  const idToImg = new Map(nodes.map((n) => [n.id, findImageUrl(n.id)]));

  // Svelte refs & state
  let container;
  let infoPanelEl;            // <- bind to measure panel height
  let svg, defs, gRoot, gLinks, gNodes;
  let width = 800, height = 500;
  let simulation;
  let resizeObserver;

  // Info panel
  let pinned = false;
  let infoVisible = false;
  let infoHTML = "";

  // Colors
  const allGroups = Array.from(new Set(nodes.flatMap(n => (n.groups?.length ? [n.groups[0]] : ["other"]))));
  const color = d3.scaleOrdinal().domain(allGroups).range(d3.schemeSet2);

  // Node radius
  const r = (d) => 6 + d.size * 3;

  // Keep nodes inside the svg
  const PADDING = 4;
  function clampNode(d) {
    const rad = r(d) + PADDING;
    d.x = Math.max(rad, Math.min(width  - rad, d.x));
    d.y = Math.max(rad, Math.min(height - rad, d.y));
  }

  // Panel HTML
  const nodeHTML = (d) => `
    <div><strong>${d.label}</strong></div>
    ${d.groups?.length ? `<div>Groups: ${d.groups.join(", ")}</div>` : ""}
  `;
  function linkHTML(d) {
    const s = typeof d.source === "object" ? d.source : nodeById.get(d.source);
    const t = typeof d.target === "object" ? d.target : nodeById.get(d.target);
    const strength = d.strength ?? 0.5;
    return `
      <div><strong>${s?.label || s?.id || "—"} ⇄ ${t?.label || t?.id || "—"}</strong></div>
      <div>Strength: ${strength}</div>
      ${s?.groups?.length ? `<div>Source groups: ${s.groups.join(", ")}</div>` : ""}
      ${t?.groups?.length ? `<div>Target groups: ${t.groups.join(", ")}</div>` : ""}
    `;
  }

  function safeId(raw) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(raw);
    return String(raw).replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  // --- Reserve space equal to the panel height (prevents cropping)
  function reservePanelSpace() {
    if (!container) return;
    const pad = infoVisible && infoPanelEl ? infoPanelEl.offsetHeight + 16 : 16;
    container.style.paddingBottom = pad + "px";
    postHeight();
  }

  function showInfo(html) {
    infoHTML = html;
    infoVisible = true;
    requestAnimationFrame(reservePanelSpace);
  }
  function hideInfo() {
    if (pinned) return;
    infoVisible = false;
    reservePanelSpace();
  }

  function init() {
    svg = d3.select(container)
      .append("svg")
      .attr("class", "net-svg")
      .attr("width", width)
      .attr("height", height);

    defs  = svg.append("defs");
    gRoot = svg.append("g");
    gLinks = gRoot.append("g").attr("class", "links");
    gNodes = gRoot.append("g").attr("class", "nodes");

    // Links
    const linkSel = gLinks
      .selectAll("line")
      .data(links, d => (d.source.id ?? d.source) + "->" + (d.target.id ?? d.target))
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => 1 + 3 * (d.strength ?? 0.5))
      .style("cursor", "pointer")
      .style("pointer-events", "stroke")
      .on("pointerenter", function (event, d) {
        this.parentNode.appendChild(this);
        d3.select(this).attr("stroke-opacity", 0.95).attr("stroke", "#666")
          .attr("stroke-width", d2 => 2 + 3 * (d2.strength ?? 0.5));
        if (!pinned) showInfo(linkHTML(d));
      })
      .on("pointerleave", function () {
        d3.select(this).attr("stroke", "#999").attr("stroke-opacity", 0.6)
          .attr("stroke-width", d => 1 + 3 * (d.strength ?? 0.5));
        hideInfo();
      })
      .on("pointerdown", (event, d) => {
        pinned = !pinned;
        if (pinned) showInfo(linkHTML(d)); else hideInfo();
        event.stopPropagation();
      });

    // Nodes
    const nodeSel = gNodes
      .selectAll("circle")
      .data(nodes, d => d.id)
      .join((enter) => {
        const circles = enter.append("circle")
          .attr("r", r)
          .attr("stroke", "#333")
          .attr("stroke-width", 1);

        circles.each(function (d) {
          const url = idToImg.get(d.id);
          if (url) {
            const patId = `pat-${safeId(d.id)}`;
            const pat = defs.append("pattern")
              .attr("id", patId)
              .attr("patternUnits", "objectBoundingBox")
              .attr("patternContentUnits", "objectBoundingBox")
              .attr("width", 1).attr("height", 1);

            pat.append("image")
              .attr("href", url).attr("xlink:href", url)
              .attr("x", 0).attr("y", 0).attr("width", 1).attr("height", 1)
              .attr("preserveAspectRatio", "xMidYMid slice");

            d3.select(this).attr("fill", `url(#${patId})`);
          } else {
            d3.select(this).attr("fill", color(d.groups?.[0] ?? "other"));
          }
        });

        return circles;
      })
      .on("pointerenter", (event, d) => { if (!pinned) showInfo(nodeHTML(d)); })
      .on("pointerleave", () => { hideInfo(); })
      .on("pointerdown", (event, d) => {
        pinned = !pinned;
        if (pinned) showInfo(nodeHTML(d)); else hideInfo();
        event.stopPropagation();
      })
      .call(drag());

    // Click/tap empty space: unpin + hide
    d3.select(container).on("pointerdown", () => { pinned = false; hideInfo(); });

    // Forces
    simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).strength(d => d.strength ?? 0.9).distance(90))
      .force("charge", d3.forceManyBody().strength(-50))
      .force("collide", d3.forceCollide().radius(d => r(d) + 6))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .on("tick", () => {
        nodes.forEach(clampNode);
        linkSel.attr("x1", d => d.source.x).attr("y1", d => d.source.y)
               .attr("x2", d => d.target.x).attr("y2", d => d.target.y);
        gNodes.selectAll("circle").attr("cx", d => d.x).attr("cy", d => d.y);
      });

    // Initial sizing + reserve
    resize();
    reservePanelSpace();
  }

  function resize() {
    if (!container) return;
    const w = container.clientWidth || 800;

    // Width-based height (no vh)
    const h = Math.round(w * 0.68);
    width  = w;
    height = Math.max(420, Math.min(860, h));

    svg.attr("width", width).attr("height", height);
    simulation?.force("center", d3.forceCenter(width / 2, height / 2))
              .alpha(0.4).restart();

    reservePanelSpace();
  }

  function drag() {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) {
      const rad = r(d) + PADDING;
      d.fx = Math.max(rad, Math.min(width  - rad, event.x));
      d.fy = Math.max(rad, Math.min(height - rad, event.y));
    }
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null; d.fy = null;
    }
    return d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended);
  }

  onMount(() => {
    init();
    window.addEventListener("resize", resize);

    // Watch for width changes caused by WP editor/columns/themes
    if ("ResizeObserver" in window && container) {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(container);
    }

    // Create Pym child only if the parent included the script
    try { if (window.pym) pymChild = new window.pym.Child({ polling: 500 }); } catch {}

    // Post a few times while layout settles
    delay(200).then(postHeight);
    delay(800).then(postHeight);
    delay(1600).then(postHeight);
  });

  onDestroy(() => {
    window.removeEventListener("resize", resize);
    if (resizeObserver) resizeObserver.disconnect();
    simulation?.stop();
  });
</script>



<!-- Namespaced wrapper so global app.css styles apply -->
<div class="network-chart">
  <div class="chart" bind:this={container}>
    <div
      class="info-panel"
      aria-live="polite"
      bind:this={infoPanelEl}
      style:display={infoVisible ? "block" : "none"}
    >
      <div class="info-content">{@html infoHTML}</div>
    </div>
  </div>
</div>
