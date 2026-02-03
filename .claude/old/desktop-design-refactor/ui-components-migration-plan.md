# UI Components Cafe Theme Migration Plan

## Overview

공통 UI 컴포넌트에 cafe 테마를 적용하여 디자인 시스템의 일관성을 확보합니다.

## Target Components

| Component | Path | Priority | Status |
|-----------|------|----------|--------|
| Input | `src/renderer/components/ui/Input.tsx` | High | Pending |
| Dialog | `src/renderer/components/ui/Dialog.tsx` | Medium | Pending |
| EmptyState | `src/renderer/components/ui/EmptyState.tsx` | Low | Pending |
| Badge | `src/renderer/components/ui/Badge.tsx` | Low | Pending |
| Button | `src/renderer/components/ui/Button.tsx` | - | ✅ Already cafe-themed |
| Card | `src/renderer/components/ui/Card.tsx` | - | ✅ Already cafe-themed |

---

## Component-wise Changes

### 1. Input.tsx (High Priority)

**Current State:**
```tsx
className={cn(
  'w-full px-3 py-2 bg-background border border-border rounded text-bone',
  'focus:outline-none focus:ring-2 focus:ring-coffee/50',
  'placeholder:text-gray-500',
  className
)}
```

**Target State:**
```tsx
className={cn(
  'w-full px-3 py-2 bg-cafe-950 border border-cafe-700 rounded-lg text-cafe-200',
  'focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent',
  'placeholder:text-cafe-600 transition-colors',
  className
)}
```

**Changes:**
- `bg-background` → `bg-cafe-950`
- `border-border` → `border-cafe-700`
- `rounded` → `rounded-lg`
- `text-bone` → `text-cafe-200`
- `placeholder:text-gray-500` → `placeholder:text-cafe-600`
- `focus:ring-coffee/50` → `focus:ring-brand`

---

### 2. Dialog.tsx (Medium Priority)

**Current State:**
```tsx
'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-border bg-card p-6 shadow-lg duration-200 rounded-lg'
```

**Target State:**
```tsx
'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border border-cafe-700 bg-cafe-900 p-6 shadow-2xl duration-200 rounded-2xl'
```

**Additional Changes:**
- `text-bone` → `text-cafe-100` (DialogTitle)
- `text-muted-foreground` → `text-cafe-400` (DialogDescription)
- Close button: `text-cafe-400 hover:text-cafe-100 hover:bg-cafe-800`

---

### 3. EmptyState.tsx (Low Priority)

**Current State:**
```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  {Icon && <Icon className="w-12 h-12 text-gray-600 mb-4" />}
  <h3 className="text-lg font-semibold text-gray-400 mb-2">{displayTitle}</h3>
  {displayDescription && <p className="text-gray-500 mb-4">{displayDescription}</p>}
  {action || children}
</div>
```

**Target State:**
```tsx
<div className="flex flex-col items-center justify-center py-12 text-center">
  {Icon && <Icon className="w-12 h-12 text-cafe-600 mb-4 opacity-30" />}
  <h3 className="text-lg font-semibold text-cafe-400 mb-2">{displayTitle}</h3>
  {displayDescription && <p className="text-cafe-500 mb-4">{displayDescription}</p>}
  {action || children}
</div>
```

---

### 4. Badge.tsx (Low Priority)

**Current Status:** Already functional, uses specific semantic colors (green, red, yellow, blue).

**Optional Enhancement:** Could add cafe-themed variants for consistency:
```tsx
const BADGE_VARIANTS = {
  cafe: 'bg-cafe-800 text-cafe-300 border border-cafe-700',
  brand: 'bg-brand/10 text-brand-light border border-brand/30',
  // ... existing variants
};
```

---

## Execution Order

1. **Input.tsx** - Most widely used component
2. **Dialog.tsx** - Used in legacy dialogs
3. **EmptyState.tsx** - Limited usage
4. **Badge.tsx** - Optional, already functional

---

## Notes

- **Impact**: Legacy components still using old UI components will benefit from these changes
- **Backward Compatibility**: Changes are CSS-only, no API changes
- **Testing**: After each component update, verify rendering in existing views

---

## References

- Cafe Theme Colors: See `tailwind.config.cjs`
- Migration Examples: `OrderExecuteDialog.tsx`, `OrderSummaryView.tsx`
- Reference Designs: `docs/desktop-design-refactor/codecafe-desktop/components/`
