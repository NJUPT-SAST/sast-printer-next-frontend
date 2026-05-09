import { describe, it, expect } from "vitest";
import { getExtColor } from "./utils";

describe("getExtColor", () => {
  it("returns red color for pdf", () => {
    expect(getExtColor("pdf")).toBe("bg-red-100 text-red-700");
  });

  it("returns blue color for doc/docx", () => {
    expect(getExtColor("doc")).toBe("bg-blue-100 text-blue-700");
    expect(getExtColor("docx")).toBe("bg-blue-100 text-blue-700");
  });

  it("returns orange color for ppt/pptx", () => {
    expect(getExtColor("ppt")).toBe("bg-orange-100 text-orange-700");
    expect(getExtColor("pptx")).toBe("bg-orange-100 text-orange-700");
  });

  it("returns green color for xls/xlsx/csv", () => {
    expect(getExtColor("xls")).toBe("bg-green-100 text-green-700");
    expect(getExtColor("xlsx")).toBe("bg-green-100 text-green-700");
    expect(getExtColor("csv")).toBe("bg-green-100 text-green-700");
  });

  it("returns purple fallback for unknown extension", () => {
    expect(getExtColor("xyz")).toBe("bg-purple-100 text-purple-700");
  });

  it("returns purple fallback for empty string", () => {
    expect(getExtColor("")).toBe("bg-purple-100 text-purple-700");
  });
});
