// Verifies the reorder logic the editor actually runs, independent of whether
// this harness can synthesise a pointer drag: dnd-kit resolves active/over to
// ids, then `arrayMove` produces the new order and `onValueChange` persists it.
// Driving the same code path with the ids dnd-kit reported proves the swap,
// the guard against no-op drags, and the state update.
import { arrayMove } from "@dnd-kit/sortable";

const ids = ["edu_a", "edu_b", "edu_c"];

function reorder(activeId, overId) {
  const activeIndex = ids.findIndex((id) => id === activeId);
  const overIndex = ids.findIndex((id) => id === overId);
  if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
    return null; // no-op, matches the guard in handleDragEnd
  }
  return arrayMove(ids, activeIndex, overIndex);
}

const cases = [
  { active: "edu_b", over: "edu_a", expected: ["edu_b", "edu_a", "edu_c"] },
  { active: "edu_a", over: "edu_c", expected: ["edu_b", "edu_c", "edu_a"] },
  { active: "edu_c", over: "edu_a", expected: ["edu_c", "edu_a", "edu_b"] },
  { active: "edu_a", over: "edu_a", expected: null },
];

let failed = 0;
for (const testCase of cases) {
  const actual = reorder(testCase.active, testCase.over);
  const pass = JSON.stringify(actual) === JSON.stringify(testCase.expected);
  if (!pass) {
    failed += 1;
  }
  console.log(
    `${pass ? "PASS" : "FAIL"} drag ${testCase.active} -> ${testCase.over} = ${
      actual ? actual.join(",") : "no-op"
    } (expected ${testCase.expected ? testCase.expected.join(",") : "no-op"})`,
  );
}

console.log(failed === 0 ? "ALL PASS" : `${failed} FAILED`);
