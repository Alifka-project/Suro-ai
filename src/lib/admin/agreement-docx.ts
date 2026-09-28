import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  WidthType,
  type IBorderOptions,
  type ISectionOptions,
} from "docx";
import { BUSINESS } from "./business";
import type { AgreementDocument, Block, DocPart, Paragraph as DocParagraph, SignatureParty } from "./agreement-document";

/*
 * Renders the agreement document model (agreement-document.ts) as a Word
 * file: A4, SULOAI letterhead, numbered clauses, real Word bullets, a bordered
 * timeline table and signature blocks. Clean metadata — no author, company or
 * sensitivity labels carried over from any template.
 */

const FONT = "Calibri";
const INK = "0F2A3D";
const MUTED = "4A6A82";
const BRAND = "0766A3";
const PLACEHOLDER = "B45309";
const RULE = "C9D8E4";

// Twips: 1 mm = 56.7 twips. A4 with 20 mm margins.
const A4 = { width: 11906, height: 16838 };
const MARGIN = 1134;
const CONTENT_WIDTH = A4.width - MARGIN * 2;

/**
 * The mark is read from /public at request time. next.config's
 * outputFileTracingIncludes ships it with the route on Vercel; if it is ever
 * missing the letterhead falls back to the text wordmark rather than failing.
 */
async function loadMark(): Promise<Buffer | null> {
  try {
    return await readFile(path.join(process.cwd(), "public", "brand", "suloai-mark.png"));
  } catch {
    return null;
  }
}

function runs(paragraph: DocParagraph, size = 21): TextRun[] {
  return paragraph.map(
    (r) =>
      new TextRun({
        text: r.text,
        bold: r.bold,
        italics: r.placeholder,
        color: r.placeholder ? PLACEHOLDER : INK,
        font: FONT,
        size,
      }),
  );
}

function body(paragraph: DocParagraph, opts: { spacingAfter?: number } = {}): Paragraph {
  return new Paragraph({
    children: runs(paragraph),
    spacing: { after: opts.spacingAfter ?? 120, line: 288 },
    alignment: AlignmentType.JUSTIFIED,
  });
}

type Borders = { top: IBorderOptions; bottom: IBorderOptions; left: IBorderOptions; right: IBorderOptions };
const thin: IBorderOptions = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const none: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const allBorders: Borders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorders: Borders = { top: none, bottom: none, left: none, right: none };

function cell(children: Paragraph[], opts: { width: number; shade?: boolean; borders?: Borders }): TableCell {
  return new TableCell({
    children,
    width: { size: opts.width, type: WidthType.DXA },
    borders: opts.borders ?? allBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: opts.shade ? { type: ShadingType.CLEAR, color: "auto", fill: "EEF4F9" } : undefined,
  });
}

function signatureTable(parties: SignatureParty[]): Table {
  const width = Math.floor(CONTENT_WIDTH / parties.length);
  const line = (label: string, value?: string) =>
    new Paragraph({
      spacing: { before: 200, after: 0 },
      children: [
        new TextRun({ text: `${label}: `, font: FONT, size: 19, color: MUTED }),
        new TextRun({ text: value ?? "______________________________", font: FONT, size: 19, color: INK }),
      ],
    });
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: parties.map(() => width),
    borders: { ...noBorders, insideHorizontal: none, insideVertical: none },
    rows: [
      new TableRow({
        children: parties.map((p) =>
          cell(
            [
              new Paragraph({
                children: [new TextRun({ text: p.role, bold: true, font: FONT, size: 21, color: INK })],
              }),
              new Paragraph({
                children: [new TextRun({ text: p.organisation, font: FONT, size: 19, color: MUTED })],
              }),
              line("Signature"),
              line("Print name", p.printName ? `${p.printName}` : undefined),
              line("Date"),
            ],
            { width, borders: noBorders },
          ),
        ),
      }),
    ],
  });
}

function block(b: Block): (Paragraph | Table)[] {
  switch (b.kind) {
    case "paragraph":
      return [body(b.runs)];
    case "bullets":
      return b.items.map(
        (item) =>
          new Paragraph({
            children: runs(item.runs),
            numbering: { reference: "sa-bullets", level: item.level },
            spacing: { after: 60, line: 276 },
          }),
      );
    case "details": {
      const labelWidth = 2600;
      return [
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: [labelWidth, CONTENT_WIDTH - labelWidth],
          rows: b.rows.map(
            (row) =>
              new TableRow({
                children: [
                  cell([new Paragraph({ children: [new TextRun({ text: row.label, bold: true, font: FONT, size: 20, color: INK })] })], {
                    width: labelWidth,
                    shade: true,
                  }),
                  cell([new Paragraph({ children: runs(row.value, 20) })], { width: CONTENT_WIDTH - labelWidth }),
                ],
              }),
          ),
        }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    }
    case "table": {
      const dateWidth = 2800;
      const widths = [CONTENT_WIDTH - dateWidth, dateWidth];
      const text = (value: string, bold = false) =>
        new Paragraph({ children: [new TextRun({ text: value, bold, font: FONT, size: 20, color: INK })] });
      return [
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          layout: TableLayoutType.FIXED,
          columnWidths: widths,
          rows: [
            new TableRow({
              tableHeader: true,
              children: b.head.map((h, i) => cell([text(h, true)], { width: widths[i], shade: true })),
            }),
            ...b.rows.map((row) => new TableRow({ children: row.map((v, i) => cell([text(v)], { width: widths[i] })) })),
          ],
        }),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
      ];
    }
    case "signatures":
      return [signatureTable(b.parties)];
  }
}

function part(doc: DocPart, mark: Buffer | null, dateLine: string): ISectionOptions {
  const header = new Header({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 6 } },
        children: [
          ...(mark
            ? [new ImageRun({ type: "png", data: mark, transformation: { width: 21, height: 22 } }), new TextRun({ text: "  " })]
            : []),
          new TextRun({ text: BUSINESS.name, bold: true, font: FONT, size: 24, color: BRAND }),
          new TextRun({ text: `  ${BUSINESS.tagline}`, font: FONT, size: 16, color: MUTED }),
          new TextRun({ text: `\t${doc.reference}`, font: FONT, size: 16, color: MUTED }),
        ],
      }),
    ],
  });
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: `${BUSINESS.name} · ${BUSINESS.email} · ${BUSINESS.website}   ·   Page `, font: FONT, size: 16, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: MUTED }),
          new TextRun({ text: " of ", font: FONT, size: 16, color: MUTED }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FONT, size: 16, color: MUTED }),
        ],
      }),
    ],
  });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: doc.title.toUpperCase(), bold: true, font: FONT, size: 34, color: INK, characterSpacing: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 320 },
      children: [new TextRun({ text: `${doc.reference}  ·  ${dateLine}`, font: FONT, size: 18, color: MUTED })],
    }),
  ];

  for (const section of doc.sections) {
    children.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 220, after: 100 },
        children: [
          new TextRun({
            text: section.number === null ? section.title : `${section.number}. ${section.title}`,
            bold: true,
            font: FONT,
            size: 23,
            color: BRAND,
          }),
        ],
      }),
    );
    for (const b of section.blocks) children.push(...block(b));
  }

  return {
    properties: { page: { size: A4, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN, header: 567, footer: 567 } } },
    headers: { default: header },
    footers: { default: footer },
    children,
  };
}

/** The agreement and its SOW as one .docx (the SOW starts on a new page). */
export async function renderAgreementDocx(doc: AgreementDocument): Promise<Buffer> {
  const mark = await loadMark();
  const file = new Document({
    creator: BUSINESS.name,
    lastModifiedBy: BUSINESS.name,
    title: `${doc.agreement.title} ${doc.agreement.reference}`,
    description: `${doc.agreement.title} and ${doc.sow.title}`,
    styles: { default: { document: { run: { font: FONT, size: 21, color: INK } } } },
    numbering: {
      config: [
        {
          reference: "sa-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 400, hanging: 260 } } },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "–",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 800, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [part(doc.agreement, mark, doc.dateLabel), part(doc.sow, mark, doc.dateLabel)],
  });
  return Packer.toBuffer(file);
}
