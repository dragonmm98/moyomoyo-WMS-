"use client";

import Link from "next/link";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { API_URL } from "@/lib/api-url";
import { apiFetch } from "@/lib/api";
import { createEan13 } from "@/lib/barcode";
import styles from "./product-import.module.css";

type TrackingPolicy = "NONE" | "LOT" | "SERIAL";
type ImportProduct = {
  code: string;
  name: string;
  description?: string;
  trackingPolicy: TrackingPolicy;
  expiryTracked: boolean;
  weightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  active: boolean;
  barcodes?: { value: string; symbology: string; primary: boolean }[];
};
type PreviewRow = {
  row: number;
  product: ImportProduct;
  errors: string[];
  barcodeSource: "file" | "generated" | "none";
};
type ImportResult = {
  createdCount: number;
  skippedCount: number;
  created: { id: string; code: string; name: string }[];
  skipped: { code: string; reasons: string[] }[];
};

const TEMPLATE_HEADERS = [
  "sku",
  "name",
  "description",
  "barcode",
  "symbology",
  "tracking_policy",
  "expiry_tracked",
  "weight_kg",
  "length_cm",
  "width_cm",
  "height_cm",
  "active",
];

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function text(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function optionalNumber(value: string, field: string, errors: string[]) {
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    errors.push(`${field} must be a number greater than or equal to zero`);
    return undefined;
  }
  return number;
}

function booleanValue(value: string, fallback: boolean, field: string, errors: string[]) {
  if (!value) return fallback;
  if (["true", "yes", "1", "active"].includes(value.toLowerCase())) return true;
  if (["false", "no", "0", "inactive"].includes(value.toLowerCase())) return false;
  errors.push(`${field} must be yes/no or true/false`);
  return fallback;
}

function responseMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join(" ");
  return typeof message === "string" ? message : fallback;
}

export function ProductImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [autoGenerateMissing, setAutoGenerateMissing] = useState(true);
  const [duplicateStrategy, setDuplicateStrategy] = useState<"SKIP" | "FAIL">("SKIP");
  const [status, setStatus] = useState<"idle" | "reading" | "importing" | "error" | "warning" | "success">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const counts = useMemo(() => {
    const invalid = rows.filter((row) => row.errors.length).length;
    const generated = rows.filter((row) => row.barcodeSource === "generated").length;
    return { total: rows.length, valid: rows.length - invalid, invalid, generated };
  }, [rows]);

  function uniqueEan13(existingValues: Set<string>) {
    let value = createEan13();
    while (existingValues.has(value)) value = createEan13();
    existingValues.add(value);
    return value;
  }

  function toggleAutoGeneration(enabled: boolean) {
    setAutoGenerateMissing(enabled);
    setRows((current) => {
      const existingValues = new Set(
        current.flatMap(
          (row) => row.product.barcodes?.map((barcode) => barcode.value) ?? [],
        ),
      );
      return current.map((row) => {
        if (enabled && !row.product.barcodes?.length) {
          return {
            ...row,
            barcodeSource: "generated",
            product: {
              ...row.product,
              barcodes: [
                {
                  value: uniqueEan13(existingValues),
                  symbology: "EAN13",
                  primary: true,
                },
              ],
            },
          };
        }
        if (!enabled && row.barcodeSource === "generated") {
          return {
            ...row,
            barcodeSource: "none",
            product: { ...row.product, barcodes: undefined },
          };
        }
        return row;
      });
    });
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setResult(null);
    setRows([]);
    setFileName(file.name);
    setStatus("reading");
    setMessage("");

    if (file.size > 5 * 1024 * 1024) {
      setStatus("error");
      setMessage("The file is larger than the 5 MB import limit.");
      return;
    }

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) throw new Error("The workbook does not contain a worksheet.");
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], {
        defval: "",
        raw: false,
      });
      if (!records.length) throw new Error("The first worksheet has no product rows.");
      if (records.length > 1000) throw new Error("A single import can contain at most 1,000 products.");

      const parsed = records.map((raw, index): PreviewRow => {
        const record = Object.fromEntries(
          Object.entries(raw).map(([key, value]) => [normalizeHeader(key), value]),
        );
        const errors: string[] = [];
        const code = text(record, "sku", "sku_code", "code").toUpperCase();
        const name = text(record, "name", "product_name");
        const barcode = text(record, "barcode", "primary_barcode");
        const trackingRaw = text(record, "tracking_policy", "tracking").toUpperCase() || "NONE";
        const trackingPolicy: TrackingPolicy = ["NONE", "LOT", "SERIAL"].includes(trackingRaw)
          ? (trackingRaw as TrackingPolicy)
          : "NONE";
        if (!code) errors.push("SKU is required");
        else if (!/^[A-Z0-9-]+$/.test(code) || code.length > 40)
          errors.push("SKU must use A-Z, 0-9, and hyphens only (maximum 40 characters)");
        if (!name) errors.push("Product name is required");
        else if (name.length > 160) errors.push("Product name exceeds 160 characters");
        if (!["NONE", "LOT", "SERIAL"].includes(trackingRaw))
          errors.push("Tracking policy must be NONE, LOT, or SERIAL");
        if (barcode && (barcode.length < 3 || barcode.length > 100))
          errors.push("Barcode must contain 3 to 100 characters");
        const expiryTracked = booleanValue(
          text(record, "expiry_tracked", "expiry"),
          false,
          "Expiry tracked",
          errors,
        );
        if (expiryTracked && trackingPolicy !== "LOT")
          errors.push("Expiry tracking requires the LOT tracking policy");
        const symbology = text(record, "symbology", "barcode_type") ||
          (/^\d{13}$/.test(barcode) ? "EAN13" : "CODE128");
        return {
          row: index + 2,
          errors,
          barcodeSource: barcode ? "file" : "none",
          product: {
            code,
            name,
            description: text(record, "description") || undefined,
            trackingPolicy,
            expiryTracked,
            weightKg: optionalNumber(text(record, "weight_kg", "weight"), "Weight", errors),
            lengthCm: optionalNumber(text(record, "length_cm", "length"), "Length", errors),
            widthCm: optionalNumber(text(record, "width_cm", "width"), "Width", errors),
            heightCm: optionalNumber(text(record, "height_cm", "height"), "Height", errors),
            active: booleanValue(text(record, "active", "status"), true, "Active", errors),
            barcodes: barcode ? [{ value: barcode, symbology, primary: true }] : undefined,
          },
        };
      });

      if (autoGenerateMissing) {
        const existingValues = new Set(
          parsed.flatMap(
            (row) => row.product.barcodes?.map((barcode) => barcode.value) ?? [],
          ),
        );
        for (const row of parsed) {
          if (row.product.barcodes?.length) continue;
          row.product.barcodes = [
            {
              value: uniqueEan13(existingValues),
              symbology: "EAN13",
              primary: true,
            },
          ];
          row.barcodeSource = "generated";
        }
      }

      const codeRows = new Map<string, number[]>();
      const barcodeRows = new Map<string, number[]>();
      for (const row of parsed) {
        if (row.product.code) codeRows.set(row.product.code, [...(codeRows.get(row.product.code) ?? []), row.row]);
        const barcode = row.product.barcodes?.[0]?.value;
        if (barcode) barcodeRows.set(barcode, [...(barcodeRows.get(barcode) ?? []), row.row]);
      }
      for (const row of parsed) {
        if ((codeRows.get(row.product.code)?.length ?? 0) > 1) row.errors.push("Duplicate SKU inside this file");
        const barcode = row.product.barcodes?.[0]?.value;
        if (barcode && (barcodeRows.get(barcode)?.length ?? 0) > 1)
          row.errors.push("Duplicate barcode inside this file");
      }

      setRows(parsed);
      const invalid = parsed.filter((row) => row.errors.length).length;
      const generated = parsed.filter(
        (row) => row.barcodeSource === "generated",
      ).length;
      setStatus(invalid ? "error" : "idle");
      setMessage(
        invalid
          ? `${invalid} row${invalid === 1 ? " has" : "s have"} validation errors. Fix the file and upload it again.`
          : `${parsed.length} product${parsed.length === 1 ? " is" : "s are"} ready to import.${generated ? ` ${generated} missing barcode${generated === 1 ? " was" : "s were"} generated.` : ""}`,
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not read this spreadsheet.");
    }
  }

  async function importProducts() {
    if (!rows.length) {
      setMessage("");
      setStatus("idle");
      inputRef.current?.click();
      return;
    }
    if (counts.invalid) {
      setStatus("error");
      setMessage(
        `Fix the ${counts.invalid} invalid row${counts.invalid === 1 ? "" : "s"} shown in the preview, then upload the corrected file.`,
      );
      return;
    }
    setStatus("importing");
    setMessage("");
    setResult(null);
    try {
      const response = await apiFetch(`${API_URL}/skus/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duplicateStrategy,
          items: rows.map((row) => row.product),
        }),
      });
      const body = (await response.json()) as ImportResult & { message?: unknown };
      if (!response.ok) throw new Error(responseMessage(body, "The product import failed."));
      setResult(body);
      if (body.createdCount === 0) {
        setStatus("warning");
        setMessage(
          `No new products were created. ${body.skippedCount} row${body.skippedCount === 1 ? " was" : "s were"} skipped because the SKU code or barcode already exists.`,
        );
      } else {
        setStatus("success");
        setMessage(
          `${body.createdCount} product${body.createdCount === 1 ? "" : "s"} imported` +
            (body.skippedCount ? ` and ${body.skippedCount} duplicate${body.skippedCount === 1 ? " was" : "s were"} skipped.` : "."),
        );
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The product import failed.");
    }
  }

  function downloadTemplate() {
    const example = [
      "SKU-TEA-001",
      "Organic Green Tea 20ct",
      "Demo product",
      "880000000001",
      "EAN13",
      "LOT",
      "yes",
      "0.25",
      "12",
      "8",
      "6",
      "yes",
    ];
    const csv = [TEMPLATE_HEADERS, example]
      .map((line) => line.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wms-product-import-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={`page-stack ${styles.page}`}>
      <header className="page-header">
        <div>
          <Link className="back-link" href="/catalog">← Back to catalog</Link>
          <p className="eyebrow">Master data</p>
          <h1>Import products</h1>
          <p className="subtitle">Validate and add up to 1,000 SKUs from a CSV or Excel worksheet.</p>
        </div>
        <div className="header-actions">
          <button className="button button-secondary" type="button" onClick={downloadTemplate}>Download template</button>
          <Link className="button button-secondary" href="/catalog">Cancel</Link>
          <button className="button button-primary" type="button" disabled={status === "importing"} onClick={() => void importProducts()}>
            {status === "importing"
              ? "Importing…"
              : rows.length
                ? `Import ${counts.valid} products`
                : "Import products"}
          </button>
        </div>
      </header>

      {message && (
        <div className={`form-banner ${status === "success" ? "success" : status === "error" ? "error" : status === "warning" ? "warning" : "idle"}`} role={status === "error" ? "alert" : "status"}>
          <strong>{status === "success" ? "✓ Import complete" : status === "warning" ? "Nothing imported" : status === "error" ? "Check the spreadsheet" : "Preview ready"}</strong>
          <span>{message}</span>
          {status === "success" && <Link href="/catalog">View product catalog →</Link>}
        </div>
      )}

      <section className={`panel ${styles.uploadPanel}`}>
        <div className="panel-heading">
          <div><h2>1. Upload spreadsheet</h2><p>Use the first worksheet. Supported formats: .xlsx, .xls, and .csv.</p></div>
          <span className="detail-count">5 MB max</span>
        </div>
        <input ref={inputRef} className={styles.visuallyHidden} type="file" accept=".xlsx,.xls,.csv" onChange={(event) => void readFile(event)} />
        <button className={styles.dropzone} type="button" onClick={() => inputRef.current?.click()}>
          <span className={styles.fileIcon}>⇧</span>
          <strong>{fileName || "Choose a product spreadsheet"}</strong>
          <small>{fileName ? "Select another file" : "Click to browse from your device"}</small>
        </button>
        <div className={styles.generationOption}>
          <label>
            <input
              type="checkbox"
              checked={autoGenerateMissing}
              onChange={(event) => toggleAutoGeneration(event.target.checked)}
            />
            <span>
              <strong>Auto-generate missing barcodes</strong>
              <small>Creates a unique, valid EAN-13 barcode when the spreadsheet barcode cell is empty.</small>
            </span>
          </label>
          <b>EAN-13</b>
        </div>
        <div className={styles.requiredColumns}>
          <strong>Required columns</strong><span>sku</span><span>name</span>
          <small>Optional: description, barcode, symbology, tracking_policy, expiry_tracked, dimensions, weight, active</small>
        </div>
      </section>

      {rows.length > 0 && (
        <>
          <section className="metric-grid" aria-label="Import validation summary">
            <article className="metric-card compact"><div className="metric-icon blue" /><p>Rows found</p><strong>{counts.total}</strong><span>First worksheet</span></article>
            <article className="metric-card compact"><div className="metric-icon green" /><p>Ready</p><strong>{counts.valid}</strong><span>Valid products</span></article>
            <article className="metric-card compact"><div className="metric-icon amber" /><p>Errors</p><strong>{counts.invalid}</strong><span>{counts.invalid ? "Import blocked" : "No corrections needed"}</span></article>
            <article className="metric-card compact"><div className="metric-icon violet" /><p>Generated barcodes</p><strong>{counts.generated}</strong><span>{autoGenerateMissing ? "Missing values filled" : "Generation disabled"}</span></article>
          </section>

          <section className={`panel ${styles.previewPanel}`}>
            <div className="panel-heading">
              <div><h2>2. Review and import</h2><p>Values shown below are exactly what will be sent to the catalog.</p></div>
              <label className={styles.strategy}><span>Existing SKU or barcode</span><select value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value as "SKIP" | "FAIL")}><option value="SKIP">Skip duplicate row</option><option value="FAIL">Stop the entire import</option></select></label>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Row</th><th>SKU / product</th><th>Barcode</th><th>Tracking</th><th>Validation</th></tr></thead>
                <tbody>{rows.map((row) => <tr className={row.errors.length ? styles.rowError : undefined} key={row.row}><td>{row.row}</td><td><strong>{row.product.code || "Missing SKU"}</strong><small>{row.product.name || "Missing product name"}</small></td><td>{row.product.barcodes?.[0]?.value ?? "—"}<small>{row.product.barcodes?.[0]?.symbology ?? "No barcode"}{row.barcodeSource === "generated" && <em className={styles.generatedBadge}>Generated</em>}</small></td><td>{row.product.trackingPolicy}<small>{row.product.expiryTracked ? "Expiry tracked" : row.product.active ? "Active" : "Inactive"}</small></td><td>{row.errors.length ? <ul className={styles.errors}>{row.errors.map((error) => <li key={error}>{error}</li>)}</ul> : <span className="status active">Ready</span>}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {result && result.skipped.length > 0 && (
        <section className={`panel ${styles.resultPanel}`}>
          <div className="panel-heading"><div><h2>Skipped duplicates</h2><p>These existing records were left unchanged.</p></div><span className="detail-count">{result.skippedCount}</span></div>
          <ul>{result.skipped.map((item) => <li key={item.code}><strong>{item.code}</strong><span>{item.reasons.join(" · ")}</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
