const categories = [
  "core_resolution",
  "narrative_authority",
  "game_structure",
  "player_focus",
  "mechanical_philosophy",
  "character_mechanics",
  "dice_philosophy",
  "temporal_scale",
  "resolution_focus",
  "genre_scope"
];

const categoryTitles = {
  core_resolution: "Core Resolution",
  narrative_authority: "Narrative Authority",
  game_structure: "Game Structure",
  player_focus: "Player Focus",
  mechanical_philosophy: "Mechanical Philosophy",
  character_mechanics: "Character Mechanics",
  dice_philosophy: "Dice Philosophy",
  temporal_scale: "Temporal Scale",
  resolution_focus: "Resolution Focus",
  genre_scope: "Genre Scope"
};

const palette = d3.schemeTableau10;
const categoryColor = d3
  .scaleOrdinal()
  .domain(categories)
  .range(palette);

const svg = d3
  .select("#graph")
  .append("svg")
  .attr("viewBox", [0, 0, window.innerWidth, window.innerHeight])
  .attr("preserveAspectRatio", "xMidYMid slice")
  .call(
    d3
      .zoom()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      })
  );

const g = svg.append("g");

const linkGroup = g.append("g").attr("stroke-linecap", "round");
const nodeGroup = g.append("g");
const labelGroup = g.append("g");

const detailsEl = document.getElementById("details");

function renderDetails(node, neighbors, dataById) {
  if (!node) {
    detailsEl.innerHTML = `
      <h2>Select a node</h2>
      <p>Choose a system or tag in the graph to see more context.</p>
    `;
    return;
  }

  if (node.type === "system") {
    const system = dataById.get(node.id);
    const lists = categories
      .map((category) => {
        const values = system[category];
        if (!values || !values.length) return "";
        return `
          <section>
            <h3>${categoryTitles[category]}</h3>
            <ul>
              ${values.map((value) => `<li>${value}</li>`).join("")}
            </ul>
          </section>
        `;
      })
      .join("\n");

    detailsEl.innerHTML = `
      <h2>${system.system}</h2>
      <p>This system is connected to ${neighbors.size} design element${
      neighbors.size === 1 ? "" : "s"
    }.</p>
      ${lists}
    `;
  } else {
    const relatedSystems = Array.from(neighbors)
      .map((id) => dataById.get(id).system)
      .sort((a, b) => d3.ascending(a, b));
    detailsEl.innerHTML = `
      <h2>${node.label}</h2>
      <p>${categoryTitles[node.category]} tag shared by ${relatedSystems.length} system${
      relatedSystems.length === 1 ? "" : "s"
    }.</p>
      <h3>Systems</h3>
      <ul>
        ${relatedSystems.map((name) => `<li>${name}</li>`).join("")}
      </ul>
    `;
  }
}

function buildGraph(data) {
  const nodes = [];
  const links = [];
  const systemNodes = new Map();
  const tagNodes = new Map();
  const neighborMap = new Map();

  function registerNeighbor(a, b) {
    if (!neighborMap.has(a)) neighborMap.set(a, new Set());
    neighborMap.get(a).add(b);
  }

  data.forEach((systemEntry) => {
    const systemNode = {
      id: systemEntry.system,
      label: systemEntry.system,
      type: "system"
    };
    nodes.push(systemNode);
    systemNodes.set(systemNode.id, systemEntry);

    categories.forEach((category) => {
      const values = systemEntry[category] || [];
      values.forEach((value) => {
        const tagId = `${category}:${value}`;
        if (!tagNodes.has(tagId)) {
          const tagNode = {
            id: tagId,
            label: value,
            category,
            type: "tag"
          };
          tagNodes.set(tagId, tagNode);
          nodes.push(tagNode);
        }
        links.push({ source: systemNode.id, target: tagId, category });
        registerNeighbor(systemNode.id, tagId);
        registerNeighbor(tagId, systemNode.id);
      });
    });
  });

  return { nodes, links, neighborMap, systemNodes };
}

function init() {
  d3.json("rpg_systems.json").then((data) => {
    const { nodes, links, neighborMap, systemNodes } = buildGraph(data);

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance((d) => (d.source.type === "system" ? 110 : 90))
          .strength(0.2)
      )
      .force(
        "charge",
        d3
          .forceManyBody()
          .strength((d) => (d.type === "system" ? -220 : -80))
      )
      .force(
        "center",
        d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2)
      )
      .force("collision", d3.forceCollide().radius((d) => (d.type === "system" ? 32 : 18)));

    const linksSelection = linkGroup
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => categoryColor(d.category));

    const nodesSelection = nodeGroup
      .selectAll("g")
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const group = enter
          .append("g")
          .attr("class", (d) => `node ${d.type}`)
          .call(
            d3
              .drag()
              .on("start", (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
              })
              .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
              })
              .on("end", (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
              })
          );

        group
          .append("circle")
          .attr("r", (d) => (d.type === "system" ? 18 : 10))
          .attr("fill", (d) =>
            d.type === "system"
              ? "#f2545b"
              : d3.color(categoryColor(d.category)).brighter(0.6)
          );

        group
          .append("title")
          .text((d) =>
            d.type === "system"
              ? d.label
              : `${d.label} (${categoryTitles[d.category]})`
          );

        return group;
      });

    const labelsSelection = labelGroup
      .selectAll("text")
      .data(nodes, (d) => d.id)
      .join("text")
      .attr("class", "node-label")
      .attr("text-anchor", "middle")
      .attr("dy", (d) => (d.type === "system" ? "1.35em" : "1.3em"))
      .text((d) => d.label);

    let activeNode = null;

    function highlightNode(nodeDatum) {
      if (!nodeDatum) {
        nodesSelection.classed("dimmed", false).classed("highlight", false);
        labelsSelection.classed("dimmed", false);
        linksSelection.classed("dimmed", false).classed("highlight", false);
        renderDetails(null);
        return;
      }

      const neighbors = neighborMap.get(nodeDatum.id) || new Set();
      const relatedIds = new Set(neighbors);
      relatedIds.add(nodeDatum.id);

      nodesSelection
        .classed("dimmed", (d) => !relatedIds.has(d.id))
        .classed("highlight", (d) => d.id === nodeDatum.id);

      labelsSelection.classed("dimmed", (d) => !relatedIds.has(d.id));

      linksSelection
        .classed("dimmed", (link) => {
          const sourceId = link.source.id || link.source;
          const targetId = link.target.id || link.target;
          return !(
            (sourceId === nodeDatum.id && neighbors.has(targetId)) ||
            (targetId === nodeDatum.id && neighbors.has(sourceId))
          );
        })
        .classed("highlight", (link) => {
          const sourceId = link.source.id || link.source;
          const targetId = link.target.id || link.target;
          return (
            (sourceId === nodeDatum.id && neighbors.has(targetId)) ||
            (targetId === nodeDatum.id && neighbors.has(sourceId))
          );
        });

      if (nodeDatum.type === "system") {
        renderDetails(nodeDatum, neighbors, systemNodes);
      } else {
        const systems = new Set(neighbors);
        renderDetails(nodeDatum, systems, systemNodes);
      }
    }

    nodesSelection.on("click", (event, d) => {
      event.stopPropagation();
      if (activeNode && activeNode.id === d.id) {
        activeNode = null;
        highlightNode(null);
      } else {
        activeNode = d;
        highlightNode(d);
      }
    });

    svg.on("click", () => {
      activeNode = null;
      highlightNode(null);
    });

    renderDetails(null);

    simulation.on("tick", () => {
      linksSelection
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      nodesSelection.attr("transform", (d) => `translate(${d.x}, ${d.y})`);

      labelsSelection.attr("x", (d) => d.x).attr("y", (d) => d.y);
    });

    window.addEventListener("resize", () => {
      svg.attr("viewBox", [0, 0, window.innerWidth, window.innerHeight]);
      simulation.force(
        "center",
        d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2)
      );
      simulation.alpha(0.3).restart();
    });
  });
}

init();
