export const LAYOUTS = {
  "1x1": { id: "1x1", label: "1x1", rows: [1] },
  "1x2": { id: "1x2", label: "1x2", rows: [2] },
  "1x3": { id: "1x3", label: "1x3", rows: [3] },
  "1x4": { id: "1x4", label: "1x4", rows: [4] },
  "1x5": { id: "1x5", label: "1x5", rows: [5] },
  "1x6": { id: "1x6", label: "1x6", rows: [6] },
  "1x7": { id: "1x7", label: "1x7", rows: [7] },
  "2x1": { id: "2x1", label: "2x1", rows: [1, 1] },
  "2x2": { id: "2x2", label: "2x2", rows: [2, 2] },
  "2x3": { id: "2x3", label: "2x3", rows: [3, 3] },
  "2x4": { id: "2x4", label: "2x4", rows: [4, 4] },
  "3x1": { id: "3x1", label: "3x1", rows: [1, 1, 1] },
  "3x2": { id: "3x2", label: "3x2", rows: [2, 2, 2] },
  "3x3": { id: "3x3", label: "3x3", rows: [3, 3, 3] },
  "4x2": { id: "4x2", label: "4x2", rows: [2, 2, 2, 2] },
} as const;

export type LayoutId = keyof typeof LAYOUTS;

export const DEFAULT_LAYOUT: LayoutId = "1x3";

export function isLayoutId(value: string): value is LayoutId {
  return value in LAYOUTS;
}

export function getLayoutCellCount(layoutId: LayoutId) {
  return LAYOUTS[layoutId].rows.reduce((total, rowCount) => total + rowCount, 0);
}

export const ALL_LAYOUTS = Object.values(LAYOUTS);

function getLayoutRowCount(layoutId: LayoutId) {
  return LAYOUTS[layoutId].rows.length;
}

function getLayoutColumnCount(layoutId: LayoutId) {
  return Math.max(...LAYOUTS[layoutId].rows);
}

function getLayoutIdByDimensions(rows: number, columns: number) {
  const layoutId = `${rows}x${columns}`;
  return isLayoutId(layoutId) ? layoutId : null;
}

export function getBestLayoutForPanelCount(
  panelCount: number,
  preferredLayout: LayoutId = DEFAULT_LAYOUT,
) {
  const safeCount = Math.max(1, Math.floor(panelCount));
  const preferredRows = getLayoutRowCount(preferredLayout);
  const preferredColumns = getLayoutColumnCount(preferredLayout);

  if (preferredRows === 1) {
    const singleRowLayout = getLayoutIdByDimensions(1, safeCount);
    if (singleRowLayout) {
      return singleRowLayout;
    }
  }

  if (preferredColumns === 1) {
    const singleColumnLayout = getLayoutIdByDimensions(safeCount, 1);
    if (singleColumnLayout) {
      return singleColumnLayout;
    }
  }

  const sameRowFamilyLayout = getLayoutIdByDimensions(
    preferredRows,
    Math.ceil(safeCount / preferredRows),
  );
  if (sameRowFamilyLayout && getLayoutCellCount(sameRowFamilyLayout) >= safeCount) {
    return sameRowFamilyLayout;
  }

  const sameColumnFamilyLayout = getLayoutIdByDimensions(
    Math.ceil(safeCount / preferredColumns),
    preferredColumns,
  );
  if (sameColumnFamilyLayout && getLayoutCellCount(sameColumnFamilyLayout) >= safeCount) {
    return sameColumnFamilyLayout;
  }

  const preferredAspect = preferredColumns / preferredRows;
  const prefersWide = preferredColumns >= preferredRows;
  const candidateLayouts = ALL_LAYOUTS.filter((layout) => getLayoutCellCount(layout.id) >= safeCount);

  return candidateLayouts
    .slice()
    .sort((left, right) => {
      const leftRows = getLayoutRowCount(left.id);
      const leftColumns = getLayoutColumnCount(left.id);
      const leftAspect = leftColumns / leftRows;
      const leftScore =
        (getLayoutCellCount(left.id) - safeCount) * 40 +
        (((leftColumns >= leftRows) === prefersWide ? 0 : 1) * 100) +
        Math.abs(leftRows - preferredRows) * 20 +
        Math.abs(leftColumns - preferredColumns) * 16 +
        Math.abs(leftAspect - preferredAspect) * 10;

      const rightRows = getLayoutRowCount(right.id);
      const rightColumns = getLayoutColumnCount(right.id);
      const rightAspect = rightColumns / rightRows;
      const rightScore =
        (getLayoutCellCount(right.id) - safeCount) * 40 +
        (((rightColumns >= rightRows) === prefersWide ? 0 : 1) * 100) +
        Math.abs(rightRows - preferredRows) * 20 +
        Math.abs(rightColumns - preferredColumns) * 16 +
        Math.abs(rightAspect - preferredAspect) * 10;

      return leftScore - rightScore;
    })[0].id;
}
