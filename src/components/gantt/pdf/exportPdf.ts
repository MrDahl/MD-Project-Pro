import { layoutPages, type Measure, type PdfInput, type PdfOptions, type PdfPage, type Prim } from "./layout";

type Doc = import("jspdf").jsPDF;

function drawPrim(doc: Doc, p: Prim): void {
  switch (p.k) {
    case "rect": {
      const style = p.fill && p.stroke ? "FD" : p.fill ? "F" : "S";
      if (p.fill) doc.setFillColor(p.fill);
      if (p.stroke) {
        doc.setDrawColor(p.stroke);
        doc.setLineWidth(p.lw ?? 0.2);
      }
      doc.setLineDashPattern(p.dash ?? [], 0);
      doc.rect(p.x, p.y, p.w, p.h, style);
      if (p.dash) doc.setLineDashPattern([], 0);
      return;
    }
    case "line":
      doc.setDrawColor(p.color);
      doc.setLineWidth(p.lw);
      doc.setLineDashPattern(p.dash ?? [], 0);
      doc.line(p.x1, p.y1, p.x2, p.y2);
      if (p.dash) doc.setLineDashPattern([], 0);
      return;
    case "text":
      doc.setFont("helvetica", p.bold ? "bold" : "normal");
      doc.setFontSize(p.size);
      doc.setTextColor(p.color);
      doc.text(p.s, p.x, p.y, { align: p.align ?? "left" });
      return;
    case "poly": {
      doc.setFillColor(p.fill);
      const [first, ...rest] = p.pts;
      const vectors = rest.map(([x, y], i) => [x - (i === 0 ? first[0] : rest[i - 1][0]), y - (i === 0 ? first[1] : rest[i - 1][1])]);
      doc.lines(vectors, first[0], first[1], [1, 1], "F", true);
      return;
    }
    case "circle":
      doc.setFillColor(p.fill);
      doc.circle(p.x, p.y, p.r, "F");
      return;
  }
}

function drawPage(doc: Doc, page: PdfPage): void {
  for (const p of page.prims) drawPrim(doc, p);
}

/** Lays out and renders the PDF (jsPDF is loaded on demand). */
export async function buildPdf(input: PdfInput, opts: PdfOptions): Promise<{ blob: Blob; pages: number; sizes: [number, number][] }> {
  const { jsPDF } = await import("jspdf");

  const probe = new jsPDF({ unit: "mm" });
  const measure: Measure = (text, size, bold) => {
    probe.setFont("helvetica", bold ? "bold" : "normal");
    probe.setFontSize(size);
    return probe.getTextWidth(text);
  };

  const pages = layoutPages(input, opts, measure);
  const orient = (p: PdfPage) => (p.w >= p.h ? "landscape" : "portrait");
  const doc = new jsPDF({ unit: "mm", format: [pages[0].w, pages[0].h], orientation: orient(pages[0]), compress: true });
  pages.forEach((page, i) => {
    if (i > 0) doc.addPage([page.w, page.h], orient(page));
    drawPage(doc, page);
  });
  return { blob: doc.output("blob"), pages: pages.length, sizes: pages.map((p) => [p.w, p.h]) };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
