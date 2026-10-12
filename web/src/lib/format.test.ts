import test from "node:test";
import assert from "node:assert/strict";
import { formatGen, parseGen } from "./format.ts";
import { composeRubric, emptyRubric, missingSections, splitRubric } from "./rubric.ts";

test("parseGen / formatGen round trip", () => {
  assert.equal(parseGen("1.5"), 1500000000000000000n);
  assert.equal(parseGen("0.000000000000000001"), 1n);
  assert.equal(parseGen("1e3"), null);
  assert.equal(parseGen("-1"), null);
  assert.equal(parseGen(""), null);
  assert.equal(formatGen(1500000000000000000n), "1.5");
  assert.equal(formatGen(20n * 10n ** 18n), "20");
  assert.equal(formatGen(0n), "0");
});

test("rubric needs four non-empty labeled sections", () => {
  const p = emptyRubric();
  assert.equal(missingSections(p).length, 4);
  p["In scope"] = "parser";
  p["Out of scope"] = "docs";
  p.Duplicates = "same root cause";
  assert.deepEqual(missingSections(p), ["Severity bars"]);
  p["Severity bars"] = "low: crash";
  assert.deepEqual(missingSections(p), []);
  const text = composeRubric(p);
  const parts = splitRubric(text);
  assert.deepEqual(parts.map((x) => x.label), ["In scope", "Out of scope", "Duplicates", "Severity bars"]);
  assert.equal(parts[3].body, "low: crash");
});
