import { bowditchAdjust, parseAngle, traverseCoordinates } from "./core/SurveyEngine";
import type { TraverseLeg } from "./core/SurveyEngine";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const legsBody = $("legs").querySelector("tbody")!;

const EXAMPLE = [
  ["1", "2", "000-00-00", "100.00"],
  ["2", "3", "090-00-00", "100.00"],
  ["3", "4", "180-00-00", "100.00"],
  ["4", "1", "270-00-00", "99.90"],
];

function addRow(values: string[] = ["", "", "", ""]) {
  const tr = document.createElement("tr");
  values.forEach((v) => {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.value = v;
    input.addEventListener("input", compute);
    td.append(input);
    tr.append(td);
  });
  const del = document.createElement("td");
  const btn = document.createElement("button");
  btn.textContent = "×";
  btn.addEventListener("click", () => { tr.remove(); compute(); });
  del.append(btn);
  tr.append(del);
  legsBody.append(tr);
}

function readLegs(): TraverseLeg[] {
  return [...legsBody.rows].map((tr, i) => {
    const [from, to, bearing, length] = [...tr.querySelectorAll("input")].map((x) => x.value.trim());
    const len = Number(length);
    if (!from || !to || !bearing || !Number.isFinite(len) || len <= 0) {
      throw new Error(`Leg ${i + 1}: fill in every field with a positive length.`);
    }
    return { fromId: Number(from), toId: Number(to), bearingDeg: parseAngle(bearing), length: len };
  });
}

function compute() {
  const error = $("error");
  const results = $("results");
  error.textContent = "";
  try {
    if (legsBody.rows.length < 3) throw new Error("Enter at least 3 legs.");
    const legs = readLegs();
    const start = { northing: Number($<HTMLInputElement>("n0").value), easting: Number($<HTMLInputElement>("e0").value), elevation: 0 };
    const r = bowditchAdjust(legs);
    const pts = traverseCoordinates(start, r.adjustedLegs);

    $("summary").textContent =
      `Perimeter ${r.perimeter.toFixed(3)} m · linear misclosure ${r.linearMisclosure.toFixed(4)} m · ` +
      (Number.isFinite(r.precisionRatio) ? `precision 1:${Math.round(r.precisionRatio)}` : "perfect closure");

    const body = $("coords").querySelector("tbody")!;
    body.innerHTML = "";
    pts.forEach((p) => {
      const tr = body.insertRow();
      tr.insertCell().textContent = String(p.id);
      tr.insertCell().textContent = p.northing.toFixed(3);
      tr.insertCell().textContent = p.easting.toFixed(3);
      tr.querySelectorAll("td").forEach((td) => td.classList.add("num"));
    });
    drawPlan(pts);
    results.hidden = false;
  } catch (e) {
    error.textContent = (e as Error).message;
    results.hidden = true;
  }
}

function drawPlan(pts: { id: number; northing: number; easting: number }[]) {
  const svg = $("plan");
  const ns = Math.min(...pts.map((p) => p.northing)), nx = Math.max(...pts.map((p) => p.northing));
  const es = Math.min(...pts.map((p) => p.easting)), ex = Math.max(...pts.map((p) => p.easting));
  const pad = 40;
  const scale = (400 - 2 * pad) / Math.max(nx - ns, ex - es, 1e-6);
  const X = (e: number) => pad + (e - es) * scale;
  const Y = (n: number) => 400 - pad - (n - ns) * scale; // north is up
  const poly = pts.map((p) => `${X(p.easting)},${Y(p.northing)}`).join(" ");
  svg.innerHTML =
    `<polygon points="${poly}" fill="rgba(42,125,225,.12)" stroke="#2a7de1" stroke-width="2"/>` +
    pts.slice(0, -1).map((p) =>
      `<circle cx="${X(p.easting)}" cy="${Y(p.northing)}" r="4" fill="#2a7de1"/>` +
      `<text x="${X(p.easting) + 7}" y="${Y(p.northing) - 7}" font-size="14" fill="currentColor">${p.id}</text>`).join("") +
    `<text x="12" y="24" font-size="16" fill="currentColor">N↑</text>`;
}

$("add").addEventListener("click", () => { addRow(); });
$("example").addEventListener("click", () => {
  legsBody.innerHTML = "";
  EXAMPLE.forEach((row) => addRow(row));
  compute();
});
$<HTMLInputElement>("n0").addEventListener("input", compute);
$<HTMLInputElement>("e0").addEventListener("input", compute);

EXAMPLE.forEach((row) => addRow(row));
compute();
