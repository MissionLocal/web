<script>
  import { onMount, onDestroy } from "svelte";
  import * as d3 from "d3";

  // Data path as you provided
  import graph from "./data/graph.json";

  // ---- Data ----
  const nodes = graph.nodes;
  const links = graph.links;
  const nodeById = new Map(nodes.map((d) => [d.id, d]));

  // ---- Dynamic image registry: src/assets/avatars/<id>.(png|jpg|jpeg|svg)
  const imageFiles = import.meta.glob("./assets/avatars/*.{png,jpg,jpeg,svg}", {
    eager: true,
    as: "url",
  });

  function findImageUrl(id) {
    const exts = ["png", "jpg", "jpeg", "svg"];
    for (const ext of exts) {
      const key = `./assets/avatars/${id}.${ext}`;
      if (imageFiles[key]) return imageFiles[key];
    }
    return null;
  }
  const idToImg = new Map(nodes.map((n) => [n.id, findImageUrl(n.id)]));

  // ---- Svelte refs & state ----
  let container;
  let svg, defs, gRoot, gLinks, gNodes;
  let width = 800, height = 500;
  let simulation;
  let tooltip;
  let pinned = false;

  // Optional Pym
  let pymChild = null;
  const debounce = (fn, wait = 150) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };
  const sendHeightNow = () => { try { if (pymChild) pymChild.sendHeight(); } catch {} };
  const sendHeightDebounced = debounce(sendHeightNow, 120);

  // Color by first group (fallback if none)
  const allGroups = Array.from(
    new Set(nodes.flatMap((n) => (n.groups?.length ? [n.groups[0]] : ["other"])))
  );
  const color = d3.scaleOrdinal().domain(allGroups).range(d3.schemeSet2);

  // Node radius
  const r = (d) => 6 + d.size * 3;

  // ---- Clamp to SVG bounds (keeps nodes fully inside)
  const PADDING = 4;
  function clampNode(d) {
    const rad = r(d) + PADDING;
    d.x = Math.max(rad, Math.min(width  - rad, d.x));
    d.y = Math.max(rad, Math.min(height - rad, d.y));
  }

  function linkHTML(d) {
    const s = typeof d.source === "object" ? d.source : nodeById.get(d.source);
    const t = typeof d.target === "object" ? d.target : nodeById.get(d.target);
    const strength = d.strength ?? 0.5;
    return `
      <div style="min-width:200px">
        <div><strong>Connection</strong></div>
        <div>${s?.label || s?.id || "—"} ⇄ ${t?.label || t?.id || "—"}</div>
        <div>Strength: ${strength}</div>
        ${s?.groups?.length ? `<div>Source groups: ${s.groups.join(", ")}</div>` : ""}
        ${t?.groups?.length ? `<div>Target groups: ${t.groups.join(", ")}</div>` : ""}
      </div>
    `;
  }

  function safeId(raw) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(raw);
    return String(raw).replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function init() {
    svg = d3
      .select(container)
      .append("svg")
      .attr("class", "net-svg")
      .attr("width", width)
      .attr("height", height);

    defs = svg.append("defs");

    gRoot  = svg.append("g");
    gLinks = gRoot.append("g").attr("class", "links");
    gNodes = gRoot.append("g").attr("class", "nodes");

    tooltip = d3
      .select(container)
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("pointer-events", "none")
      .style("opacity", 0);

    // ---- Links with hover tooltip (fixed reset on mouseout)
    const linkSel = gLinks
      .selectAll("line")
      .data(links, (d) => (d.source.id ?? d.source) + "->" + (d.target.id ?? d.target))
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => 1 + 3 * (d.strength ?? 0.5))
      .style("cursor", "pointer")
      .style("pointer-events", "stroke")
      .on("mouseover", function (event, d) {
        this.parentNode.appendChild(this);
        d3.select(this)
          .attr("stroke-opacity", 0.95)
          .attr("stroke", "#666")
          .attr("stroke-width", (d2) => 2 + 3 * (d2.strength ?? 0.5));
        tooltip.style("opacity", 1).html(linkHTML(d));
      })
      .on("mousemove", (event) => {
        const { offsetX, offsetY } = event;
        tooltip.style("left", offsetX + 12 + "px").style("top", offsetY + 12 + "px");
      })
      .on("mouseout", function (event, d) {
        d3.select(this)
          .attr("stroke", "#999")
          .attr("stroke-opacity", 0.6)
          .attr("stroke-width", (d) => 1 + 3 * (d.strength ?? 0.5));
        if (!pinned) tooltip.style("opacity", 0);
      })
      .on("mouseleave", function (event, d) {
        d3.select(this)
          .attr("stroke", "#999")
          .attr("stroke-opacity", 0.6)
          .attr("stroke-width", (d) => 1 + 3 * (d.strength ?? 0.5));
        if (!pinned) tooltip.style("opacity", 0);
      })
      .on("click", (event, d) => {
        pinned = !pinned;
        if (pinned) {
          const { offsetX, offsetY } = event;
          tooltip
            .style("left", offsetX + 12 + "px")
            .style("top", offsetY + 12 + "px")
            .style("opacity", 1)
            .html(linkHTML(d));
        } else {
          tooltip.style("opacity", 0);
        }
        event.stopPropagation();
      });

    d3.select(container).on("click", () => {
      pinned = false;
      tooltip.style("opacity", 0);
    });

    // ---- Nodes (image pattern if available; else color)
    const nodeSel = gNodes
      .selectAll("circle")
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const circles = enter
          .append("circle")
          .attr("r", r)
          .attr("stroke", "#333")
          .attr("stroke-width", 1);

        circles.each(function (d) {
          const url = idToImg.get(d.id);
          if (url) {
            const patId = `pat-${safeId(d.id)}`;
            const pat = defs
              .append("pattern")
              .attr("id", patId)
              .attr("patternUnits", "objectBoundingBox")
              .attr("width", 1)
              .attr("height", 1);

            pat
              .append("image")
              .attr("href", url)
              .attr("width", 1)
              .attr("height", 1)
              .attr("preserveAspectRatio", "xMidYMid slice");

            d3.select(this).attr("fill", `url(#${patId})`);
          } else {
            d3.select(this).attr("fill", color(d.groups?.[0] ?? "other"));
          }
        });

        return circles;
      })
      .on("mouseover", (event, d) => {
        if (pinned) return;
        tooltip
          .style("opacity", 1)
          .html(`<strong>${d.label}</strong><br/>Groups: ${d.groups?.join(", ") || "—"}`);
      })
      .on("mousemove", (event) => {
        if (pinned) return;
        const { offsetX, offsetY } = event;
        tooltip.style("left", offsetX + 12 + "px").style("top", offsetY + 12 + "px");
      })
      .on("mouseout", () => {
        if (pinned) return;
        setTimeout(() => { if (!pinned) tooltip.style("opacity", 0); }, 80);
      })
      .call(drag());

    // ---- Force simulation
    simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3.forceLink(links)
          .id((d) => d.id)
          .strength((d) => d.strength ?? 0.9)
          .distance(90)
      )
      .force("charge", d3.forceManyBody().strength(-50))
      .force("collide", d3.forceCollide().radius((d) => r(d) + 6))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .on("tick", () => {
        // Keep everything in-bounds each tick
        nodes.forEach(clampNode);

        linkSel
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        nodeSel.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      });

    // Initial size + first height post
    resize();
    sendHeightDebounced();
  }

  function resize() {
    if (!container) return;

    const w = container.clientWidth || 800;
    // Taller on mobile: ~90% of viewport height, clamped 500–900px
    const isMobile = (w <= 640);
    const mobileH = Math.max(500, Math.min(900, Math.round((window.innerHeight || 700) * 0.9)));
    const desktopH = Math.max(360, Math.round(w * 0.6));

    width  = w;
    height = isMobile ? mobileH : desktopH;

    svg.attr("width", width).attr("height", height);
    simulation?.force("center", d3.forceCenter(width / 2, height / 2)).alpha(0.4).restart();

    // Only send on resize event or init: debounce to avoid spamming
    sendHeightDebounced();
  }

  function drag() {
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x; d.fy = d.y;
    }
    function dragged(event, d) {
      // clamp the *fixed* position to keep the node inside during drag
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
    // Optional Pym: only if the host included the script
    try { if (window.pym) pymChild = new window.pym.Child(); } catch {}

    init();
    window.addEventListener("resize", resize);
  });

  onDestroy(() => {
    window.removeEventListener("resize", resize);
    simulation?.stop();
  });
</script>

<div class="chart" bind:this={container}></div>

<style>
  .chart {
    width: min(900px, 95vw);
    margin: 24px auto;
    font-family: Barlow, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
    position: relative; /* tooltip positioning */
  }

  @media (max-width: 640px) {
    .chart { width: 88vw; }
  }

  :global(.net-svg) {
    display: block;
    width: 100%;
    height: auto;
    background: #fafafa;
    border: 1px solid #e6e6e6;
    border-radius: 4px;
  }

  :global(.nodes circle) { stroke: #333; stroke-width: 1; }
  :global(.nodes circle:hover) { stroke-width: 2; }

  :global(.links line) {
    transition: stroke 120ms ease, stroke-width 120ms ease, stroke-opacity 120ms ease;
  }

  :global(.tooltip) {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 12px;
    line-height: 1.3;
    box-shadow: 0 2px 10px rgba(0,0,0,0.08);
  }
</style>
