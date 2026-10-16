import assert from "node:assert/strict";
import test from "node:test";
import { fieldTop, fitPdfFieldToPage, movePdfField, resizePdfField } from "../src/lib/pdf-field-coordinates.ts";

const field = { pageNumber: 1, x: 200, y: 40, width: 180, height: 60 };

test("transferring a signature preserves its position on equal-sized pages", () => {
  const transferred = { ...fitPdfFieldToPage(field, 792, 612, 792), pageNumber: 5 };
  assert.deepEqual(transferred, { ...field, pageNumber: 5 });
  const moved = movePdfField(transferred, 30, -100, 612, 792);
  assert.equal(moved.pageNumber, 5);
  assert.equal(moved.x, 230);
  assert.equal(moved.y, 140);
  assert.equal(resizePdfField(moved, 20, 10, 612, 792).pageNumber, 5);
});

test("different page heights preserve the distance from the top", () => {
  const transferred = fitPdfFieldToPage(field, 792, 800, 1000);
  assert.equal(fieldTop(transferred, 1000), fieldTop(field, 792));
});

test("a smaller target page keeps the entire field within its bounds", () => {
  const transferred = fitPdfFieldToPage(field, 792, 300, 400);
  assert.equal(transferred.x, 120);
  assert.equal(transferred.y, 0);
  assert.equal(fieldTop(transferred, 400) + transferred.height, 400);
});

test("a page smaller than the field reduces the field dimensions", () => {
  const transferred = fitPdfFieldToPage(field, 792, 100, 40);
  assert.deepEqual(transferred, { ...field, x: 0, y: 0, width: 100, height: 40 });
});
